import {
  AzureDevOpsIntegrationCard,
  BitbucketIntegrationCard,
  GiteaIntegrationCard,
  GitHubIntegrationCard,
  GitLabIntegrationCard
} from './source-control-integration-cards'
import { JiraIntegrationCard, LinearIntegrationCard } from './task-tracker-integration-cards'
import { useIntegrationProviderStatusRefresh } from './use-integration-provider-status-refresh'
export { INTEGRATIONS_PANE_SEARCH_ENTRIES } from './integrations-search'

export function IntegrationsPane(): React.JSX.Element {
  useIntegrationProviderStatusRefresh()

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Review providers</h3>
          <p className="text-xs text-muted-foreground">
            Connect the source hosts Orca can use for pull requests, merge requests, checks, and
            review status.
          </p>
        </div>
        <div className="space-y-3">
          <GitHubIntegrationCard />
          <GitLabIntegrationCard />
          <BitbucketIntegrationCard />
          <AzureDevOpsIntegrationCard />
          <GiteaIntegrationCard />
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Task providers</h3>
          <p className="text-xs text-muted-foreground">
            Connect issue trackers Orca can use to browse tasks and start workspaces with linked
            context.
          </p>
        </div>
        <div className="space-y-3">
          <LinearIntegrationCard />
          <JiraIntegrationCard />
        </div>
      </section>
    </div>
  )
}
