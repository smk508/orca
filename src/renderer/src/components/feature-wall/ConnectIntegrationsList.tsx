import { useState } from 'react'
import {
  AzureDevOpsIntegrationCard,
  BitbucketIntegrationCard,
  GiteaIntegrationCard,
  GitHubIntegrationCard,
  GitLabIntegrationCard
} from '@/components/settings/source-control-integration-cards'
import {
  JiraIntegrationCard,
  LinearIntegrationCard
} from '@/components/settings/task-tracker-integration-cards'
import { useIntegrationProviderStatusRefresh } from '@/components/settings/use-integration-provider-status-refresh'
import { CodeHostTaskNote, IntegrationProgress, IntegrationStep } from './connect-integration-step'
import {
  deriveIntegrationFlowState,
  useIntegrationConnectionStatus
} from './use-integration-connection-status'

// Progressive two-step integration setup: first connect a code host for review
// status, then a task source. Only one step is active at a time — connecting a
// step collapses it to a summary and promotes the next. Done-state is driven by
// real provider connection status, never an optimistic click.
export function ConnectIntegrationsList(): React.JSX.Element {
  useIntegrationProviderStatusRefresh()
  const status = useIntegrationConnectionStatus()
  // Lets a done step reopen inline via "Change" without losing its connected
  // state. Cleared once the user collapses it again.
  const [reopened, setReopened] = useState<{ review: boolean; task: boolean }>({
    review: false,
    task: false
  })

  // A code host doubles as a task source, so once it connects the parent
  // checklist already counts tasks as satisfied. Step 2 still invites a
  // dedicated tracker; it resolves when one connects or the user accepts the
  // code host via "Use … issues". This stays truthful — we never claim a
  // tracker is connected when it isn't.
  const [taskAccepted, setTaskAccepted] = useState(false)

  const flow = deriveIntegrationFlowState({
    reviewConnected: status.reviewConnected,
    trackerProviderName: status.trackerProviderName,
    taskAccepted,
    trackerChecking: status.trackerChecking
  })
  const reviewDone = status.reviewConnected
  const trackerDone = status.trackerProviderName !== null
  const taskResolved = flow.taskResolved
  const reviewExpanded = !reviewDone || reopened.review
  const reviewCanToggle = reviewDone
  // Step 2 only becomes reachable once review status is connected.
  const taskExpanded = reviewDone && (!taskResolved || reopened.task)

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] leading-snug text-muted-foreground">
          Two quick steps: connect where your code is reviewed, then where your team plans work.
        </p>
        <IntegrationProgress states={[flow.review, flow.task]} />
      </div>

      <IntegrationStep
        index={0}
        state={flow.review}
        expanded={reviewExpanded}
        title="Keep review status in view"
        description="Connect a review provider so Orca can show PR or MR status, checks, and reviews while agents work."
        summary={
          <>
            <span className="font-semibold text-foreground">{status.reviewProviderName}</span>{' '}
            connected for review status
          </>
        }
        onToggle={() => setReopened((r) => ({ ...r, review: !r.review }))}
        canToggle={reviewCanToggle}
      >
        <GitHubIntegrationCard />
        <GitLabIntegrationCard />
        <BitbucketIntegrationCard />
        <AzureDevOpsIntegrationCard />
        <GiteaIntegrationCard />
      </IntegrationStep>

      <IntegrationStep
        index={1}
        state={flow.task}
        expanded={taskExpanded}
        title="Start agents from tasks"
        description="Connect where your team tracks work. Orca starts workspaces with the issue title, link, and context already attached."
        summary={
          status.trackerProviderName ? (
            <>
              <span className="font-semibold text-foreground">{status.trackerProviderName}</span>{' '}
              connected for tasks
            </>
          ) : (
            <>
              <span className="font-semibold text-foreground">{status.reviewProviderName}</span>{' '}
              issues available as tasks
            </>
          )
        }
        onToggle={() => setReopened((r) => ({ ...r, task: !r.task }))}
        canToggle={reviewDone}
      >
        <LinearIntegrationCard />
        <JiraIntegrationCard />
        {status.reviewProviderName && !trackerDone ? (
          <CodeHostTaskNote
            providerName={status.reviewProviderName}
            onAccept={() => {
              setTaskAccepted(true)
              setReopened((r) => ({ ...r, task: false }))
            }}
          />
        ) : null}
      </IntegrationStep>
    </div>
  )
}
