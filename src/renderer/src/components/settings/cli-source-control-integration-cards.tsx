import { ExternalLink, Github, Gitlab, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IntegrationCardDetails, IntegrationCardShell } from './integration-card-shell'
import { usePreflightCardStatuses } from './source-control-preflight-card-status'

export function GitHubIntegrationCard(): React.JSX.Element {
  const { statuses, unavailable, refresh } = usePreflightCardStatuses('gh')
  const status = unavailable ? 'unavailable' : statuses.ghStatus
  const connected = status === 'connected'

  return (
    <IntegrationCardShell
      icon={<Github className="size-5" />}
      name="GitHub"
      description={
        <>
          Pull requests, issues, and checks via the{' '}
          <span className="font-mono text-[11px]">gh</span> CLI.
        </>
      }
      checking={status === 'checking'}
      statusTone={connected ? 'connected' : 'attention'}
      statusLabel={
        connected
          ? 'Connected'
          : status === 'unavailable'
            ? 'Unavailable'
            : status === 'not-installed'
              ? 'Not installed'
              : 'Not authenticated'
      }
    >
      {status !== 'checking' && !connected ? (
        <IntegrationCardDetails>
          {status === 'unavailable' ? (
            <>
              <p className="text-xs text-muted-foreground">
                GitHub CLI status is not available in this runtime yet.
              </p>
              <Button variant="ghost" size="sm" onClick={refresh}>
                Re-check
              </Button>
            </>
          ) : status === 'not-installed' ? (
            <>
              <p className="text-xs text-muted-foreground">
                Install the GitHub CLI to enable pull requests, issues, and checks.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.api.shell.openUrl('https://cli.github.com')}
                >
                  <ExternalLink className="size-3.5 mr-1.5" />
                  Install GitHub CLI
                </Button>
                <Button variant="ghost" size="sm" onClick={refresh}>
                  Re-check
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                The GitHub CLI is installed but not authenticated. Run this command in a terminal:
              </p>
              <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 font-mono text-xs">
                <Terminal className="size-3.5 shrink-0 text-muted-foreground" />
                gh auth login
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.api.shell.openUrl('https://cli.github.com/manual/gh_auth_login')
                  }
                >
                  <ExternalLink className="size-3.5 mr-1.5" />
                  Learn more
                </Button>
                <Button variant="ghost" size="sm" onClick={refresh}>
                  Re-check
                </Button>
              </div>
            </>
          )}
        </IntegrationCardDetails>
      ) : null}
    </IntegrationCardShell>
  )
}

export function GitLabIntegrationCard(): React.JSX.Element {
  const { statuses, unavailable, refresh } = usePreflightCardStatuses('glab')
  const status = unavailable ? 'unavailable' : statuses.glabStatus
  const connected = status === 'connected'

  return (
    <IntegrationCardShell
      icon={<Gitlab className="size-5" />}
      name="GitLab"
      description={
        <>
          Merge requests, issues, todos, and pipelines via the{' '}
          <span className="font-mono text-[11px]">glab</span> CLI.
        </>
      }
      checking={status === 'checking'}
      statusTone={connected ? 'connected' : 'attention'}
      statusLabel={
        connected
          ? 'Connected'
          : status === 'unavailable'
            ? 'Unavailable'
            : status === 'not-installed'
              ? 'Not installed'
              : 'Not authenticated'
      }
    >
      {status !== 'checking' && !connected ? (
        <IntegrationCardDetails>
          {status === 'unavailable' ? (
            <>
              <p className="text-xs text-muted-foreground">
                GitLab CLI status is not available in this runtime yet.
              </p>
              <Button variant="ghost" size="sm" onClick={refresh}>
                Re-check
              </Button>
            </>
          ) : status === 'not-installed' ? (
            <>
              <p className="text-xs text-muted-foreground">
                Install the GitLab CLI to enable merge requests, issues, and pipelines.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.api.shell.openUrl('https://gitlab.com/gitlab-org/cli#installation')
                  }
                >
                  <ExternalLink className="size-3.5 mr-1.5" />
                  Install GitLab CLI
                </Button>
                <Button variant="ghost" size="sm" onClick={refresh}>
                  Re-check
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                The GitLab CLI is installed but not authenticated. Run this command in a terminal:
              </p>
              <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 font-mono text-xs">
                <Terminal className="size-3.5 shrink-0 text-muted-foreground" />
                glab auth login
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.api.shell.openUrl(
                      'https://gitlab.com/gitlab-org/cli/-/blob/main/docs/source/auth/login.md'
                    )
                  }
                >
                  <ExternalLink className="size-3.5 mr-1.5" />
                  Learn more
                </Button>
                <Button variant="ghost" size="sm" onClick={refresh}>
                  Re-check
                </Button>
              </div>
            </>
          )}
        </IntegrationCardDetails>
      ) : null}
    </IntegrationCardShell>
  )
}
