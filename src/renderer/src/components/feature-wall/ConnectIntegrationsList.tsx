import { useState } from 'react'
import { ChevronRight, ExternalLink, Github, Gitlab, Terminal } from 'lucide-react'
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

type ProviderId = 'github' | 'gitlab' | 'linear' | 'jira'
type CliState = 'checking' | 'connected' | 'not-installed' | 'not-authenticated'

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
        className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left hover:bg-accent/40"
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

function GitHubProviderRow(props: { open: boolean; onToggle: () => void }): React.JSX.Element {
  const preflightStatus = useAppStore((s) => s.preflightStatus)
  const preflightStatusLoading = useAppStore((s) => s.preflightStatusLoading)
  const refreshPreflightStatus = useAppStore((s) => s.refreshPreflightStatus)
  const [terminalOpen, setTerminalOpen] = useState(false)

  const state: CliState = preflightStatusLoading
    ? 'checking'
    : !preflightStatus
      ? 'checking'
      : !preflightStatus.gh.installed
        ? 'not-installed'
        : preflightStatus.gh.authenticated
          ? 'connected'
          : 'not-authenticated'
  const connected = state === 'connected'

  return (
    <ProviderShell
      icon={<Github className="size-5" />}
      name="GitHub"
      copy="Pull requests, issues, and checks via the gh CLI."
      tone={connected ? 'connected' : state === 'checking' ? 'neutral' : 'attention'}
      statusLabel={
        connected
          ? 'Connected'
          : state === 'checking'
            ? 'Checking…'
            : state === 'not-installed'
              ? 'CLI not installed'
              : 'Sign-in needed'
      }
      connected={connected}
      open={props.open}
      onToggle={props.onToggle}
    >
      {connected ? (
        <div className="space-y-3">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Authenticated through the <span className="font-mono text-xs">gh</span> CLI. Orca reuses
            your existing login — nothing to enter here.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshPreflightStatus({ force: true })}
          >
            Re-check
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {state === 'not-installed' ? (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Install the GitHub CLI to start work from issues and pull requests.
            </p>
          ) : (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              The <span className="font-mono text-xs">gh</span> CLI is installed but not signed in.
              Run <span className="font-mono text-xs">gh auth login</span>, then re-check.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {state === 'not-installed' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.api.shell.openUrl('https://cli.github.com')}
              >
                <ExternalLink className="size-3.5" />
                Install gh
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={terminalOpen}
                onClick={() => setTerminalOpen(true)}
              >
                <Terminal className="size-3.5" />
                {terminalOpen ? 'Signing in' : 'Sign in'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refreshPreflightStatus({ force: true })}
            >
              Re-check
            </Button>
          </div>
          {state === 'not-authenticated' && terminalOpen ? (
            <OnboardingInlineCommandTerminal
              command="gh auth login"
              title="GitHub setup"
              ariaLabel="GitHub sign in command"
              description="Press Enter to run GitHub CLI auth. Re-check GitHub after the browser or device flow finishes."
            />
          ) : null}
        </div>
      )}
    </ProviderShell>
  )
}

function GitLabProviderRow(props: { open: boolean; onToggle: () => void }): React.JSX.Element {
  const preflightStatus = useAppStore((s) => s.preflightStatus)
  const preflightStatusLoading = useAppStore((s) => s.preflightStatusLoading)
  const refreshPreflightStatus = useAppStore((s) => s.refreshPreflightStatus)
  const [terminalOpen, setTerminalOpen] = useState(false)

  const state: CliState = preflightStatusLoading
    ? 'checking'
    : !preflightStatus?.glab
      ? !preflightStatus
        ? 'checking'
        : 'not-installed'
      : !preflightStatus.glab.installed
        ? 'not-installed'
        : preflightStatus.glab.authenticated
          ? 'connected'
          : 'not-authenticated'
  const connected = state === 'connected'

  return (
    <ProviderShell
      icon={<Gitlab className="size-5" />}
      name="GitLab"
      copy="Merge requests, issues, todos, and pipelines via the glab CLI."
      tone={connected ? 'connected' : state === 'checking' ? 'neutral' : 'attention'}
      statusLabel={
        connected
          ? 'Connected'
          : state === 'checking'
            ? 'Checking…'
            : state === 'not-installed'
              ? 'CLI not installed'
              : 'Sign-in needed'
      }
      connected={connected}
      open={props.open}
      onToggle={props.onToggle}
    >
      {connected ? (
        <div className="space-y-3">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Authenticated through the <span className="font-mono text-xs">glab</span> CLI.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshPreflightStatus({ force: true })}
          >
            Re-check
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {state === 'not-installed' ? (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Install the GitLab CLI to enable merge requests, issues, and pipelines.
            </p>
          ) : (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              The <span className="font-mono text-xs">glab</span> CLI is installed but not signed
              in. Run <span className="font-mono text-xs">glab auth login</span>, then re-check.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {state === 'not-installed' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.api.shell.openUrl('https://gitlab.com/gitlab-org/cli#installation')
                }
              >
                <ExternalLink className="size-3.5" />
                Install glab
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={terminalOpen}
                onClick={() => setTerminalOpen(true)}
              >
                <Terminal className="size-3.5" />
                {terminalOpen ? 'Signing in' : 'Sign in'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refreshPreflightStatus({ force: true })}
            >
              Re-check
            </Button>
          </div>
          {state === 'not-authenticated' && terminalOpen ? (
            <OnboardingInlineCommandTerminal
              command="glab auth login"
              title="GitLab setup"
              ariaLabel="GitLab sign in command"
              description="Press Enter to run GitLab CLI auth. Re-check GitLab after the browser or device flow finishes."
            />
          ) : null}
        </div>
      )}
    </ProviderShell>
  )
}

function LinearProviderRow(props: { open: boolean; onToggle: () => void }): React.JSX.Element {
  const linearStatus = useAppStore((s) => s.linearStatus)
  const checkLinearConnection = useAppStore((s) => s.checkLinearConnection)
  const [dialogOpen, setDialogOpen] = useState(false)

  const connected = linearStatus.connected
  const workspaceCount = linearStatus.workspaces?.length ?? (connected ? 1 : 0)

  return (
    <ProviderShell
      icon={<LinearIcon className="size-5" />}
      name="Linear"
      copy="Browse issues by team and start workspaces from them."
      tone={connected ? 'connected' : 'attention'}
      statusLabel={connected ? 'Connected' : 'Not connected'}
      connected={connected}
      open={props.open}
      onToggle={props.onToggle}
    >
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {connected
            ? `${workspaceCount} workspace${workspaceCount === 1 ? '' : 's'} linked. Add another workspace or replace a restricted key any time.`
            : 'Add access with a Personal API key from your Linear settings. Full-access keys can see every team the key owner can reach.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={connected ? 'outline' : 'default'}
            size="sm"
            onClick={() => setDialogOpen(true)}
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

function JiraProviderRow(props: { open: boolean; onToggle: () => void }): React.JSX.Element {
  const jiraStatus = useAppStore((s) => s.jiraStatus)
  const jiraStatusChecked = useAppStore((s) => s.jiraStatusChecked)
  const checkJiraConnection = useAppStore((s) => s.checkJiraConnection)
  const [dialogOpen, setDialogOpen] = useState(false)

  const connected = jiraStatus.connected
  const siteCount = jiraStatus.sites?.length ?? (connected ? 1 : 0)

  return (
    <ProviderShell
      icon={<JiraIcon className="size-5" />}
      name="Jira"
      copy="Browse, create, and start work from Jira Cloud issues."
      tone={connected ? 'connected' : !jiraStatusChecked ? 'neutral' : 'attention'}
      statusLabel={connected ? 'Connected' : !jiraStatusChecked ? 'Checking…' : 'Not connected'}
      connected={connected}
      open={props.open}
      onToggle={props.onToggle}
    >
      <div className="space-y-3">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {connected
            ? `${siteCount} site${siteCount === 1 ? '' : 's'} connected. Add another site any time.`
            : 'Connect a Jira Cloud site with your Atlassian email and an API token. Credentials are encrypted in your OS keychain.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={connected ? 'outline' : 'default'}
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            {connected ? 'Add Jira site' : 'Connect Jira'}
          </Button>
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
  const toggle = (id: ProviderId): void =>
    setOpenProvider((current) => (current === id ? null : id))

  return (
    <div className="space-y-2.5">
      <GitHubProviderRow open={openProvider === 'github'} onToggle={() => toggle('github')} />
      <GitLabProviderRow open={openProvider === 'gitlab'} onToggle={() => toggle('gitlab')} />
      <LinearProviderRow open={openProvider === 'linear'} onToggle={() => toggle('linear')} />
      <JiraProviderRow open={openProvider === 'jira'} onToggle={() => toggle('jira')} />
    </div>
  )
}
