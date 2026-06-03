import { useEffect, useState } from 'react'
import { ChevronRight, ExternalLink, Terminal } from 'lucide-react'
import { LinearIcon } from '@/components/icons/LinearIcon'
import { JiraIcon } from '@/components/icons/JiraIcon'
import { Button } from '@/components/ui/button'
import { LinearApiKeyDialog } from '@/components/linear-api-key-dialog'
import { JiraConnectDialog } from '@/components/jira-connect-dialog'
import { IntegrationStatusPill } from '@/components/integration-status-pill'
import type { IntegrationStatusTone } from '@/components/integration-status-pill'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { OnboardingInlineCommandTerminal } from '../onboarding/OnboardingInlineCommandTerminal'
import {
  CLI_PROVIDERS,
  type CliAuthProviderId,
  type CliProviderConfig
} from './connect-integrations-provider-config'
import {
  getProviderRuntimeContextKey,
  hasRemoteProviderRuntime
} from '@/lib/provider-runtime-context'

type ProviderId = 'github' | 'gitlab' | 'linear' | 'jira'
type CliState = 'checking' | 'connected' | 'not-installed' | 'not-authenticated' | 'unavailable'

// Presentational shell: one calm accordion row per task source. The header
// (icon + name + copy + chevron) toggles; the status pill is non-interactive.
function ProviderShell(props: {
  icon: React.ReactNode
  name: string
  copy: string
  tone: IntegrationStatusTone
  statusLabel: string
  connected: boolean
  open: boolean
  disabled?: boolean
  onToggle: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <article
      className={cn(
        'overflow-hidden rounded-xl border border-border',
        props.connected ? 'bg-muted/30' : 'bg-card'
      )}
    >
      <button
        type="button"
        onClick={props.onToggle}
        aria-expanded={props.open}
        disabled={props.disabled}
        className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground">
          {props.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-tight text-foreground">
            {props.name}
          </span>
          <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
            {props.copy}
          </span>
        </span>
        <IntegrationStatusPill tone={props.tone}>{props.statusLabel}</IntegrationStatusPill>
        <ChevronRight
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            props.open && 'rotate-90'
          )}
        />
      </button>
      {props.open ? (
        <div className="border-t border-border bg-muted/40 px-4 py-3.5">{props.children}</div>
      ) : null}
    </article>
  )
}

function CliProviderRow(props: {
  config: CliProviderConfig
  open: boolean
  disabled?: boolean
  onToggle: () => void
  onAuthTerminalOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const { config, onAuthTerminalOpenChange } = props
  const preflightStatus = useAppStore((s) => s.preflightStatus)
  const preflightStatusChecked = useAppStore((s) => s.preflightStatusChecked)
  const preflightStatusLoading = useAppStore((s) => s.preflightStatusLoading)
  const refreshPreflightStatus = useAppStore((s) => s.refreshPreflightStatus)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const cliStatus = preflightStatus?.[config.statusKey]

  const state: CliState = preflightStatusLoading
    ? 'checking'
    : !preflightStatus || !cliStatus
      ? preflightStatusChecked
        ? 'unavailable'
        : 'checking'
      : !cliStatus.installed
        ? 'not-installed'
        : cliStatus.authenticated
          ? 'connected'
          : 'not-authenticated'
  const connected = state === 'connected'
  const terminalShouldClose = terminalOpen && (state === 'connected' || state === 'not-installed')
  useEffect(() => {
    if (!terminalShouldClose) {
      return
    }
    // oxlint-disable-next-line react-doctor/no-adjust-state-on-prop-change -- Why: auth terminal closes when CLI state proves the flow completed or cannot continue.
    setTerminalOpen(false)
    onAuthTerminalOpenChange(false)
  }, [onAuthTerminalOpenChange, terminalShouldClose])

  const handleRefresh = (): void => {
    setTerminalOpen(false)
    onAuthTerminalOpenChange(false)
    void refreshPreflightStatus({ force: true })
  }
  const handleStartAuth = (): void => {
    setTerminalOpen(true)
    onAuthTerminalOpenChange(true)
  }

  return (
    <ProviderShell
      icon={config.icon}
      name={config.name}
      copy={config.copy}
      tone={connected ? 'connected' : state === 'checking' ? 'neutral' : 'attention'}
      statusLabel={
        connected
          ? 'Connected'
          : state === 'checking'
            ? 'Checking…'
            : state === 'unavailable'
              ? 'Unavailable'
              : state === 'not-installed'
                ? 'CLI not installed'
                : 'Sign-in needed'
      }
      connected={connected}
      open={props.open}
      disabled={props.disabled}
      onToggle={props.onToggle}
    >
      {connected ? (
        <div className="space-y-3">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {config.connectedCopy}
          </p>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            Re-check
          </Button>
        </div>
      ) : state === 'checking' ? (
        <div className="space-y-3">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Checking your {config.name} CLI status before showing setup actions.
          </p>
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            Re-check
          </Button>
        </div>
      ) : state === 'unavailable' ? (
        <div className="space-y-3">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {config.name} CLI status is not available in this runtime yet.
          </p>
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            Re-check
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {state === 'not-installed' ? (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {config.installCopy}
            </p>
          ) : (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              The <span className="font-mono text-xs">{config.cliName}</span> CLI is installed but
              not signed in. Run <span className="font-mono text-xs">{config.command}</span>, then
              re-check.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {state === 'not-installed' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.api.shell.openUrl(config.installUrl)}
              >
                <ExternalLink className="size-3.5" />
                {config.installLabel}
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled={terminalOpen} onClick={handleStartAuth}>
                <Terminal className="size-3.5" />
                {terminalOpen ? 'Signing in' : 'Sign in'}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleRefresh}>
              Re-check
            </Button>
          </div>
          {terminalOpen && state !== 'not-installed' ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Finish this auth flow or use Re-check before switching providers.
              </p>
              <OnboardingInlineCommandTerminal
                command={config.command}
                title={`${config.name} setup`}
                ariaLabel={`${config.name} sign in command`}
                description={`Press Enter to run ${config.command}. Re-check ${config.name} after the browser or device flow finishes.`}
                onTerminalExit={() => {
                  setTerminalOpen(false)
                  onAuthTerminalOpenChange(false)
                }}
              />
            </div>
          ) : null}
        </div>
      )}
    </ProviderShell>
  )
}

function LinearProviderRow(props: {
  open: boolean
  disabled?: boolean
  onToggle: () => void
}): React.JSX.Element {
  const linearStatus = useAppStore((s) => s.linearStatus)
  const linearStatusChecked = useAppStore((s) => s.linearStatusChecked)
  const linearStatusContextKey = useAppStore((s) => s.linearStatusContextKey)
  const checkLinearConnection = useAppStore((s) => s.checkLinearConnection)
  const settings = useAppStore((s) => s.settings)
  const [dialogOpen, setDialogOpen] = useState(false)

  const contextMatches = linearStatusContextKey === getProviderRuntimeContextKey(settings)
  const connected = contextMatches && linearStatus.connected
  const checking = !contextMatches || !linearStatusChecked
  const workspaceCount = linearStatus.workspaces?.length ?? (connected ? 1 : 0)

  return (
    <ProviderShell
      icon={<LinearIcon className="size-5" />}
      name="Linear"
      copy="Browse issues by team and start workspaces from them."
      tone={connected ? 'connected' : checking ? 'neutral' : 'attention'}
      statusLabel={connected ? 'Connected' : checking ? 'Checking…' : 'Not connected'}
      connected={connected}
      open={props.open}
      disabled={props.disabled}
      onToggle={props.onToggle}
    >
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {connected
            ? `${workspaceCount} workspace${workspaceCount === 1 ? '' : 's'} linked. Add another workspace or replace a restricted key any time.`
            : checking
              ? 'Checking your Linear connection before showing setup actions.'
              : 'Add access with a Personal API key from your Linear settings. Full-access keys can see every team the key owner can reach.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={connected ? 'outline' : 'default'}
            size="sm"
            onClick={() => setDialogOpen(true)}
            disabled={checking}
          >
            {connected ? 'Add workspace access' : 'Add Linear access'}
          </Button>
          {!connected ? (
            <Button variant="ghost" size="sm" onClick={() => void checkLinearConnection(true)}>
              Re-check
            </Button>
          ) : null}
        </div>
      </div>

      <LinearApiKeyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        overlayClassName="z-[110]"
        contentClassName="z-[120]"
        connectLabel="Add Linear access"
      />
    </ProviderShell>
  )
}

function JiraProviderRow(props: {
  open: boolean
  disabled?: boolean
  onToggle: () => void
}): React.JSX.Element {
  const jiraStatus = useAppStore((s) => s.jiraStatus)
  const jiraStatusChecked = useAppStore((s) => s.jiraStatusChecked)
  const jiraStatusContextKey = useAppStore((s) => s.jiraStatusContextKey)
  const checkJiraConnection = useAppStore((s) => s.checkJiraConnection)
  const settings = useAppStore((s) => s.settings)
  const [dialogOpen, setDialogOpen] = useState(false)

  const contextMatches = jiraStatusContextKey === getProviderRuntimeContextKey(settings)
  const connected = contextMatches && jiraStatus.connected
  const checking = !contextMatches || !jiraStatusChecked
  const credentialCopy = hasRemoteProviderRuntime(settings)
    ? 'Connect a Jira Cloud site with your Atlassian email and an API token. Credentials are sent to the selected remote runtime and stored there with runtime-supported encryption.'
    : 'Connect a Jira Cloud site with your Atlassian email and an API token. Credentials are stored locally and encrypted when local runtime storage supports it.'
  const siteCount = jiraStatus.sites?.length ?? (connected ? 1 : 0)

  return (
    <ProviderShell
      icon={<JiraIcon className="size-5" />}
      name="Jira"
      copy="Browse, create, and start work from Jira Cloud issues."
      tone={connected ? 'connected' : checking ? 'neutral' : 'attention'}
      statusLabel={connected ? 'Connected' : checking ? 'Checking…' : 'Not connected'}
      connected={connected}
      open={props.open}
      disabled={props.disabled}
      onToggle={props.onToggle}
    >
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {connected
            ? `${siteCount} site${siteCount === 1 ? '' : 's'} connected. Add another site any time.`
            : checking
              ? 'Checking your Jira connection before showing setup actions.'
              : credentialCopy}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {!checking ? (
            <Button
              variant={connected ? 'outline' : 'default'}
              size="sm"
              onClick={() => setDialogOpen(true)}
            >
              {connected ? 'Add Jira site' : 'Connect Jira'}
            </Button>
          ) : null}
          {!connected ? (
            <Button variant="ghost" size="sm" onClick={() => void checkJiraConnection()}>
              Re-check
            </Button>
          ) : null}
        </div>
      </div>

      <JiraConnectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        overlayClassName="z-[110]"
        contentClassName="z-[120]"
      />
    </ProviderShell>
  )
}

// Accordion of the four task sources Orca can connect: GitHub, GitLab, Linear,
// and Jira. One row open at a time so provider-specific setup stays focused.
export function ConnectIntegrationsList(): React.JSX.Element {
  const [openProvider, setOpenProvider] = useState<ProviderId | null>(null)
  const [activeAuthProvider, setActiveAuthProvider] = useState<CliAuthProviderId | null>(null)
  const toggle = (id: ProviderId): void => {
    if (activeAuthProvider) {
      setOpenProvider(activeAuthProvider)
      return
    }
    setOpenProvider((current) => (current === id ? null : id))
  }

  return (
    <div className="space-y-2.5">
      <CliProviderRow
        config={CLI_PROVIDERS.github}
        open={openProvider === 'github'}
        disabled={activeAuthProvider !== null && activeAuthProvider !== 'github'}
        onToggle={() => toggle('github')}
        onAuthTerminalOpenChange={(open) => {
          setOpenProvider('github')
          setActiveAuthProvider(open ? 'github' : null)
        }}
      />
      <CliProviderRow
        config={CLI_PROVIDERS.gitlab}
        open={openProvider === 'gitlab'}
        disabled={activeAuthProvider !== null && activeAuthProvider !== 'gitlab'}
        onToggle={() => toggle('gitlab')}
        onAuthTerminalOpenChange={(open) => {
          setOpenProvider('gitlab')
          setActiveAuthProvider(open ? 'gitlab' : null)
        }}
      />
      <LinearProviderRow
        open={openProvider === 'linear'}
        onToggle={() => toggle('linear')}
        disabled={activeAuthProvider !== null}
      />
      <JiraProviderRow
        open={openProvider === 'jira'}
        onToggle={() => toggle('jira')}
        disabled={activeAuthProvider !== null}
      />
    </div>
  )
}
