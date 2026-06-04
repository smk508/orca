import { ExternalLink, GitPullRequestArrow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IntegrationCardDetails, IntegrationCardShell } from './integration-card-shell'
import { usePreflightCardStatuses } from './source-control-preflight-card-status'

export function BitbucketIntegrationCard(): React.JSX.Element {
  const { statuses, unavailable, refresh } = usePreflightCardStatuses('bitbucket')
  const status = unavailable ? 'unavailable' : statuses.bitbucketStatus
  const connected = status === 'connected'

  return (
    <IntegrationCardShell
      icon={<GitPullRequestArrow className="size-5" />}
      name="Bitbucket"
      description={
        connected
          ? statuses.bitbucketAccount
            ? `${statuses.bitbucketAccount} · Pull requests and build statuses`
            : 'Pull requests and build statuses'
          : 'Pull requests and build statuses via Bitbucket Cloud API tokens.'
      }
      checking={status === 'checking'}
      statusTone={connected ? 'connected' : 'attention'}
      statusLabel={
        connected
          ? 'Connected'
          : status === 'unavailable'
            ? 'Unavailable'
            : status === 'not-configured'
              ? 'Not configured'
              : 'Auth failed'
      }
    >
      {status !== 'checking' && !connected ? (
        <IntegrationCardDetails>
          <p className="text-xs text-muted-foreground">
            {status === 'unavailable' ? (
              'Bitbucket status is not available in this runtime yet.'
            ) : status === 'not-configured' ? (
              <>
                Set <span className="font-mono text-[11px]">ORCA_BITBUCKET_EMAIL</span> and{' '}
                <span className="font-mono text-[11px]">ORCA_BITBUCKET_API_TOKEN</span>, or set{' '}
                <span className="font-mono text-[11px]">ORCA_BITBUCKET_ACCESS_TOKEN</span>.
              </>
            ) : (
              'Bitbucket credentials are configured but could not authenticate. Check the token and repository permissions, then restart Orca if environment variables changed.'
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.api.shell.openUrl(
                  'https://support.atlassian.com/bitbucket-cloud/docs/using-api-tokens/'
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
        </IntegrationCardDetails>
      ) : null}
    </IntegrationCardShell>
  )
}

export function AzureDevOpsIntegrationCard(): React.JSX.Element {
  const { statuses, unavailable, refresh } = usePreflightCardStatuses('azureDevOps')
  const status = unavailable ? 'unavailable' : statuses.azureDevOpsStatus
  const configured = status === 'configured'

  return (
    <IntegrationCardShell
      icon={<GitPullRequestArrow className="size-5" />}
      name="Azure DevOps"
      description={
        configured
          ? statuses.azureDevOpsAccount
            ? `${statuses.azureDevOpsAccount} · Pull requests and build statuses`
            : statuses.azureDevOpsBaseUrl
              ? `${statuses.azureDevOpsBaseUrl} · Pull requests and build statuses`
              : 'Pull requests and build statuses for detected Azure Repos'
          : 'Pull requests and build statuses via Azure DevOps REST API tokens.'
      }
      checking={status === 'checking'}
      statusTone={configured ? 'connected' : 'attention'}
      statusLabel={
        configured
          ? statuses.azureDevOpsAccount
            ? 'Connected'
            : 'Configured'
          : status === 'unavailable'
            ? 'Unavailable'
            : status === 'not-configured'
              ? 'Not configured'
              : 'Auth failed'
      }
    >
      {status !== 'checking' && !configured ? (
        <IntegrationCardDetails>
          <p className="text-xs text-muted-foreground">
            {status === 'unavailable' ? (
              'Azure DevOps status is not available in this runtime yet.'
            ) : status === 'not-configured' ? (
              <>
                Set <span className="font-mono text-[11px]">ORCA_AZURE_DEVOPS_TOKEN</span>, or set{' '}
                <span className="font-mono text-[11px]">ORCA_AZURE_DEVOPS_ACCESS_TOKEN</span>. Set{' '}
                <span className="font-mono text-[11px]">ORCA_AZURE_DEVOPS_API_BASE_URL</span> only
                when Orca cannot derive the API base URL from the git remote.
              </>
            ) : (
              'Azure DevOps credentials are configured but could not authenticate. Check the token, API base URL, and repository permissions, then restart Orca if environment variables changed.'
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.api.shell.openUrl(
                  status === 'not-configured'
                    ? 'https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate'
                    : 'https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get-pull-requests'
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
        </IntegrationCardDetails>
      ) : null}
    </IntegrationCardShell>
  )
}

export function GiteaIntegrationCard(): React.JSX.Element {
  const { statuses, unavailable, refresh } = usePreflightCardStatuses('gitea')
  const status = unavailable ? 'unavailable' : statuses.giteaStatus
  const configured = status === 'configured'

  return (
    <IntegrationCardShell
      icon={<GitPullRequestArrow className="size-5" />}
      name="Gitea"
      description={
        configured
          ? statuses.giteaAccount
            ? `${statuses.giteaAccount} · Pull requests and commit statuses`
            : statuses.giteaBaseUrl
              ? `${statuses.giteaBaseUrl} · Pull requests and commit statuses`
              : 'Pull requests and commit statuses for detected repositories'
          : 'Pull requests and commit statuses via the Gitea REST API.'
      }
      checking={status === 'checking'}
      statusTone={configured ? 'connected' : 'attention'}
      statusLabel={
        configured
          ? statuses.giteaAccount
            ? 'Connected'
            : 'Configured'
          : status === 'unavailable'
            ? 'Unavailable'
            : status === 'not-configured'
              ? 'Optional setup'
              : 'Auth failed'
      }
    >
      {status !== 'checking' && !configured ? (
        <IntegrationCardDetails>
          <p className="text-xs text-muted-foreground">
            {status === 'unavailable' ? (
              'Gitea status is not available in this runtime yet.'
            ) : status === 'not-configured' ? (
              <>
                Public repositories are detected from their git remote. Set{' '}
                <span className="font-mono text-[11px]">ORCA_GITEA_TOKEN</span> for private
                repositories, and set{' '}
                <span className="font-mono text-[11px]">ORCA_GITEA_API_BASE_URL</span> only when
                Orca cannot derive the API URL from the remote.
              </>
            ) : (
              'Gitea credentials are configured but could not authenticate. Check the token, API base URL, and repository permissions, then restart Orca if environment variables changed.'
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.api.shell.openUrl('https://docs.gitea.com/next/development/api-usage')
              }
            >
              <ExternalLink className="size-3.5 mr-1.5" />
              Learn more
            </Button>
            <Button variant="ghost" size="sm" onClick={refresh}>
              Re-check
            </Button>
          </div>
        </IntegrationCardDetails>
      ) : null}
    </IntegrationCardShell>
  )
}
