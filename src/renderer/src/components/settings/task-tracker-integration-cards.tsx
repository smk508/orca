import { useState } from 'react'
import { AlertCircle, CheckCircle2, LoaderCircle, Unlink } from 'lucide-react'
import { JiraConnectDialog } from '@/components/jira-connect-dialog'
import { JiraIcon } from '@/components/icons/JiraIcon'
import { LinearIcon } from '@/components/icons/LinearIcon'
import { LinearApiKeyDialog } from '@/components/linear-api-key-dialog'
import { Button } from '@/components/ui/button'
import { useMountedRef } from '@/hooks/useMountedRef'
import {
  getProviderRuntimeContextKey,
  hasRemoteProviderRuntime
} from '@/lib/provider-runtime-context'
import { useAppStore } from '@/store'
import { IntegrationCardDetails, IntegrationCardShell } from './integration-card-shell'

type VerificationResult = { state: 'ok' | 'error'; error?: string }

export function LinearIntegrationCard(): React.JSX.Element {
  const linearStatus = useAppStore((s) => s.linearStatus)
  const linearStatusChecked = useAppStore((s) => s.linearStatusChecked)
  const linearStatusContextKey = useAppStore((s) => s.linearStatusContextKey)
  const disconnectLinear = useAppStore((s) => s.disconnectLinear)
  const disconnectLinearWorkspace = useAppStore((s) => s.disconnectLinearWorkspace)
  const checkLinearConnection = useAppStore((s) => s.checkLinearConnection)
  const testLinearConnection = useAppStore((s) => s.testLinearConnection)
  const settings = useAppStore((s) => s.settings)
  const mountedRef = useMountedRef()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [testingWorkspaceId, setTestingWorkspaceId] = useState<string | null>(null)
  const [testResultByWorkspace, setTestResultByWorkspace] = useState<
    Record<string, VerificationResult>
  >({})

  const contextMatches = linearStatusContextKey === getProviderRuntimeContextKey(settings)
  const checking = !contextMatches || !linearStatusChecked
  const connected = contextMatches && linearStatus.connected
  const workspaces = linearStatus.workspaces ?? []

  const handleDisconnect = async (workspaceId?: string): Promise<void> => {
    await (workspaceId ? disconnectLinearWorkspace(workspaceId) : disconnectLinear())
    if (mountedRef.current) {
      setTestResultByWorkspace({})
    }
  }

  // Why: explicit user-triggered verification. This is the only settings path
  // that decrypts a stored Linear key, avoiding surprise keychain prompts.
  const handleTest = async (workspaceId: string): Promise<void> => {
    setTestingWorkspaceId(workspaceId)
    setTestResultByWorkspace((prev) => {
      const next = { ...prev }
      delete next[workspaceId]
      return next
    })
    const result = await testLinearConnection(workspaceId)
    if (!mountedRef.current) {
      return
    }
    setTestResultByWorkspace((prev) => ({
      ...prev,
      [workspaceId]: result.ok ? { state: 'ok' } : { state: 'error', error: result.error }
    }))
    setTestingWorkspaceId(null)
  }

  return (
    <IntegrationCardShell
      icon={<LinearIcon className="size-5" />}
      name="Linear"
      description={
        connected
          ? `${workspaces.length} workspace${workspaces.length === 1 ? '' : 's'} connected`
          : checking
            ? 'Checking Linear access before showing setup actions.'
            : 'Add Linear access to browse and link issues.'
      }
      checking={checking}
      statusTone={connected ? 'connected' : 'attention'}
      statusLabel={connected ? 'Connected' : 'Not connected'}
      actions={
        !checking ? (
          <Button
            variant={connected ? 'outline' : 'default'}
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            {connected ? 'Add workspace access' : 'Add Linear access'}
          </Button>
        ) : null
      }
    >
      {connected ? (
        <div className="mt-3 space-y-2">
          {workspaces.map((workspace) => {
            const testResult = testResultByWorkspace[workspace.id]
            const testing = testingWorkspaceId === workspace.id
            return (
              <div
                key={workspace.id}
                className="flex items-center gap-3 rounded-md border border-border/50 bg-background/60 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {workspace.organizationName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {workspace.displayName}
                    {workspace.email ? ` · ${workspace.email}` : ''}
                  </p>
                </div>
                {testResult?.state === 'ok' ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-status-success">
                    <CheckCircle2 className="size-3.5" />
                    Verified
                  </span>
                ) : null}
                {testResult?.state === 'error' ? (
                  <span className="flex min-w-0 max-w-[220px] shrink items-center gap-1 truncate text-xs text-destructive">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span className="truncate">{testResult.error}</span>
                  </span>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleTest(workspace.id)}
                  disabled={testing}
                >
                  {testing ? (
                    <>
                      <LoaderCircle className="size-3.5 mr-1.5 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test'
                  )}
                </Button>
                <button
                  onClick={() => void handleDisconnect(workspace.id)}
                  aria-label={`Disconnect ${workspace.organizationName}`}
                  className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:text-destructive"
                >
                  <Unlink className="size-3.5" />
                </button>
              </div>
            )
          })}
          <p className="text-[11px] text-muted-foreground/70">
            Each connected Linear workspace has one key stored by the active runtime. Full-access
            keys can cover all teams the key owner can access; restricted keys can be replaced any
            time.
          </p>
        </div>
      ) : !checking ? (
        <IntegrationCardDetails>
          <p className="text-xs text-muted-foreground">
            Add access with a Personal API key from your Linear settings. Full-access keys can see
            every team the key owner can reach.
          </p>
          <Button variant="ghost" size="sm" onClick={() => void checkLinearConnection(true)}>
            Re-check
          </Button>
        </IntegrationCardDetails>
      ) : null}

      <LinearApiKeyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        connectLabel="Add Linear access"
        onConnected={() => setTestResultByWorkspace({})}
        overlayClassName="z-[110]"
        contentClassName="z-[120]"
      />
    </IntegrationCardShell>
  )
}

export function JiraIntegrationCard(): React.JSX.Element {
  const jiraStatus = useAppStore((s) => s.jiraStatus)
  const jiraStatusChecked = useAppStore((s) => s.jiraStatusChecked)
  const jiraStatusContextKey = useAppStore((s) => s.jiraStatusContextKey)
  const checkJiraConnection = useAppStore((s) => s.checkJiraConnection)
  const disconnectJira = useAppStore((s) => s.disconnectJira)
  const testJiraConnection = useAppStore((s) => s.testJiraConnection)
  const settings = useAppStore((s) => s.settings)
  const mountedRef = useMountedRef()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [testingSiteId, setTestingSiteId] = useState<string | null>(null)
  const [testResultBySite, setTestResultBySite] = useState<Record<string, VerificationResult>>({})

  const contextMatches = jiraStatusContextKey === getProviderRuntimeContextKey(settings)
  const checking = !contextMatches || !jiraStatusChecked
  const connected = contextMatches && jiraStatus.connected
  const sites = jiraStatus.sites ?? []
  const siteCount = sites.length || (connected ? 1 : 0)
  const credentialCopy = hasRemoteProviderRuntime(settings)
    ? 'Connect a Jira Cloud site with your Atlassian email and an API token. Credentials are sent to the selected remote runtime and stored there with runtime-supported encryption.'
    : 'Connect a Jira Cloud site with your Atlassian email and an API token. Credentials are stored locally and encrypted when local runtime storage supports it.'

  const handleDisconnect = async (siteId?: string): Promise<void> => {
    await disconnectJira(siteId)
    if (mountedRef.current) {
      setTestResultBySite({})
    }
  }

  const handleTest = async (siteId: string): Promise<void> => {
    setTestingSiteId(siteId)
    setTestResultBySite((prev) => {
      const next = { ...prev }
      delete next[siteId]
      return next
    })
    const result = await testJiraConnection(siteId)
    if (!mountedRef.current) {
      return
    }
    setTestResultBySite((prev) => ({
      ...prev,
      [siteId]: result.ok ? { state: 'ok' } : { state: 'error', error: result.error }
    }))
    setTestingSiteId(null)
  }

  return (
    <IntegrationCardShell
      icon={<JiraIcon className="size-5" />}
      name="Jira"
      description={
        connected
          ? `${siteCount} site${siteCount === 1 ? '' : 's'} connected`
          : checking
            ? 'Checking Jira access before showing setup actions.'
            : 'Browse, create, and start work from Jira Cloud issues.'
      }
      checking={checking}
      statusTone={connected ? 'connected' : 'attention'}
      statusLabel={connected ? 'Connected' : 'Not connected'}
      actions={
        !checking ? (
          <Button
            variant={connected ? 'outline' : 'default'}
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            {connected ? 'Add Jira site' : 'Connect Jira'}
          </Button>
        ) : null
      }
    >
      {connected && sites.length > 0 ? (
        <div className="mt-3 space-y-2">
          {sites.map((site) => {
            const testResult = testResultBySite[site.id]
            const testing = testingSiteId === site.id
            return (
              <div
                key={site.id}
                className="flex items-center gap-3 rounded-md border border-border/50 bg-background/60 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{site.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {site.siteUrl}
                    {site.email ? ` · ${site.email}` : ''}
                  </p>
                </div>
                {testResult?.state === 'ok' ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-status-success">
                    <CheckCircle2 className="size-3.5" />
                    Verified
                  </span>
                ) : null}
                {testResult?.state === 'error' ? (
                  <span className="flex min-w-0 max-w-[220px] shrink items-center gap-1 truncate text-xs text-destructive">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span className="truncate">{testResult.error}</span>
                  </span>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleTest(site.id)}
                  disabled={testing}
                >
                  {testing ? (
                    <>
                      <LoaderCircle className="size-3.5 mr-1.5 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test'
                  )}
                </Button>
                <button
                  onClick={() => void handleDisconnect(site.id)}
                  aria-label={`Disconnect ${site.displayName}`}
                  className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:text-destructive"
                >
                  <Unlink className="size-3.5" />
                </button>
              </div>
            )
          })}
          <p className="text-[11px] text-muted-foreground/70">
            Each connected Jira site has one token stored by the active runtime.
          </p>
        </div>
      ) : connected ? (
        <IntegrationCardDetails>
          <p className="text-xs text-muted-foreground">
            Jira is connected for this runtime. Re-check if the connected site list looks stale.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => void checkJiraConnection()}>
              Re-check
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void handleDisconnect()}>
              Disconnect
            </Button>
          </div>
        </IntegrationCardDetails>
      ) : !checking ? (
        <IntegrationCardDetails>
          <p className="text-xs text-muted-foreground">{credentialCopy}</p>
          <Button variant="ghost" size="sm" onClick={() => void checkJiraConnection()}>
            Re-check
          </Button>
        </IntegrationCardDetails>
      ) : null}

      <JiraConnectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConnected={() => setTestResultBySite({})}
        overlayClassName="z-[110]"
        contentClassName="z-[120]"
      />
    </IntegrationCardShell>
  )
}
