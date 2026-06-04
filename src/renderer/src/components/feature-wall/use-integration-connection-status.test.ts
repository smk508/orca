import { describe, expect, it } from 'vitest'
import {
  deriveIntegrationConnectionStatus,
  deriveIntegrationFlowState,
  deriveIntegrationStepStates
} from './use-integration-connection-status'
import { deriveCliProviderCardState } from '@/components/settings/source-control-integration-cards'

type StatusFacts = Parameters<typeof deriveIntegrationConnectionStatus>[0]

function statusFacts(overrides: Partial<StatusFacts> = {}): StatusFacts {
  return {
    preflightStatus: {
      gh: { installed: false, authenticated: false },
      glab: { installed: false, authenticated: false }
    },
    preflightStatusChecked: true,
    preflightStatusContextKey: 'host',
    preflightStatusError: null,
    preflightStatusLoading: false,
    expectedPreflightContextKey: 'host',
    linearStatus: { connected: false },
    linearStatusChecked: true,
    linearStatusContextKey: 'local#0',
    jiraStatus: { connected: false },
    jiraStatusChecked: true,
    jiraStatusContextKey: 'local#0',
    providerRuntimeContextKey: 'local#0',
    ...overrides
  }
}

describe('deriveIntegrationStepStates', () => {
  it('starts with review active and tasks upcoming when nothing is connected', () => {
    expect(
      deriveIntegrationStepStates({
        reviewConnected: false,
        trackerConnected: false,
        taskAccepted: false
      })
    ).toEqual({ review: 'active', task: 'upcoming', complete: false })
  })

  it('promotes tasks to active once a code host connects for review', () => {
    expect(
      deriveIntegrationStepStates({
        reviewConnected: true,
        trackerConnected: false,
        taskAccepted: false
      })
    ).toEqual({ review: 'done', task: 'active', complete: false })
  })

  it('completes both steps when a dedicated tracker connects', () => {
    expect(
      deriveIntegrationStepStates({
        reviewConnected: true,
        trackerConnected: true,
        taskAccepted: false
      })
    ).toEqual({ review: 'done', task: 'done', complete: true })
  })

  it('completes the task step when the user accepts the code host for tasks', () => {
    // A code host doubles as a task source; accepting it resolves step 2
    // without a dedicated tracker, so the flow can complete.
    expect(
      deriveIntegrationStepStates({
        reviewConnected: true,
        trackerConnected: false,
        taskAccepted: true
      })
    ).toEqual({ review: 'done', task: 'done', complete: true })
  })

  it('ignores code-host acceptance until review is connected', () => {
    // Step 2 is unreachable until step 1 is done, so acceptance alone must not
    // resolve tasks or complete the flow.
    expect(
      deriveIntegrationStepStates({
        reviewConnected: false,
        trackerConnected: false,
        taskAccepted: true
      })
    ).toEqual({ review: 'active', task: 'upcoming', complete: false })
  })

  it('marks tasks done if a tracker is already connected before a code host', () => {
    // A pre-existing Linear/Jira connection is a real, truthful task source even
    // if the user has not yet connected a code host for review.
    expect(
      deriveIntegrationStepStates({
        reviewConnected: false,
        trackerConnected: true,
        taskAccepted: false
      })
    ).toEqual({ review: 'active', task: 'done', complete: false })
  })
})

describe('deriveIntegrationConnectionStatus', () => {
  it('does not expose cached GitHub review readiness while preflight is unresolved', () => {
    const cachedGitHub = {
      gh: { installed: true, authenticated: true },
      glab: { installed: false, authenticated: false }
    }
    const unresolvedFacts: Partial<StatusFacts>[] = [
      { preflightStatus: cachedGitHub, preflightStatusLoading: true },
      { preflightStatus: cachedGitHub, preflightStatusChecked: false },
      { preflightStatus: cachedGitHub, preflightStatusContextKey: 'wsl:Ubuntu' }
    ]

    for (const overrides of unresolvedFacts) {
      expect(deriveIntegrationConnectionStatus(statusFacts(overrides))).toMatchObject({
        reviewConnected: false,
        reviewProviderName: null,
        reviewChecking: true
      })
    }
  })

  it('treats current preflight errors as settled without exposing cached auth', () => {
    expect(
      deriveIntegrationConnectionStatus(
        statusFacts({
          preflightStatus: {
            gh: { installed: true, authenticated: true },
            glab: { installed: false, authenticated: false }
          },
          preflightStatusError: 'failed to check gh'
        })
      )
    ).toMatchObject({
      reviewConnected: false,
      reviewProviderName: null,
      reviewChecking: false,
      checking: false
    })
  })

  it('does not expose cached GitLab review readiness while preflight is stale', () => {
    expect(
      deriveIntegrationConnectionStatus(
        statusFacts({
          preflightStatus: {
            gh: { installed: false, authenticated: false },
            glab: { installed: true, authenticated: true }
          },
          preflightStatusContextKey: 'wsl:Debian'
        })
      )
    ).toMatchObject({
      reviewConnected: false,
      reviewProviderName: null,
      reviewChecking: true
    })
  })

  it('does not expose cached Linear or Jira tracker readiness while checks are stale', () => {
    const staleTrackerFacts: Partial<StatusFacts>[] = [
      {
        linearStatus: { connected: true },
        linearStatusContextKey: 'runtime:old#0'
      },
      {
        jiraStatus: { connected: true },
        jiraStatusChecked: false
      }
    ]

    for (const overrides of staleTrackerFacts) {
      expect(deriveIntegrationConnectionStatus(statusFacts(overrides))).toMatchObject({
        trackerProviderName: null,
        trackerChecking: true
      })
    }
  })

  it('keeps a current connected tracker usable when the other tracker is stale', () => {
    expect(
      deriveIntegrationConnectionStatus(
        statusFacts({
          linearStatus: { connected: true },
          jiraStatusContextKey: 'runtime:old#0'
        })
      )
    ).toMatchObject({
      trackerConnected: true,
      trackerProviderName: 'Linear',
      trackerChecking: false,
      checking: false
    })
  })

  it('does not report task-source checking when a tracker is usable but preflight is stale', () => {
    expect(
      deriveIntegrationConnectionStatus(
        statusFacts({
          preflightStatus: {
            gh: { installed: true, authenticated: true },
            glab: { installed: false, authenticated: false }
          },
          preflightStatusContextKey: 'wsl:Ubuntu',
          linearStatus: { connected: true }
        })
      )
    ).toMatchObject({
      reviewConnected: false,
      trackerConnected: true,
      trackerProviderName: 'Linear',
      checking: false
    })
  })

  it('exposes provider readiness once the relevant checks are resolved and current', () => {
    expect(
      deriveIntegrationConnectionStatus(
        statusFacts({
          preflightStatus: {
            gh: { installed: true, authenticated: true },
            glab: { installed: false, authenticated: false }
          },
          linearStatus: { connected: true }
        })
      )
    ).toMatchObject({
      reviewConnected: true,
      reviewProviderName: 'GitHub',
      trackerConnected: true,
      trackerProviderName: 'Linear',
      checking: false
    })
  })
})

describe('deriveCliProviderCardState', () => {
  it('does not show cached CLI auth as connected while preflight is stale or errored', () => {
    const connectedCli = { installed: true, authenticated: true }

    expect(
      deriveCliProviderCardState({
        cliStatus: connectedCli,
        preflightStatusAvailable: true,
        preflightStatusChecked: true,
        preflightStatusCurrent: false,
        preflightStatusError: null,
        preflightStatusLoading: false
      })
    ).toBe('checking')

    expect(
      deriveCliProviderCardState({
        cliStatus: connectedCli,
        preflightStatusAvailable: true,
        preflightStatusChecked: true,
        preflightStatusCurrent: true,
        preflightStatusError: 'failed to check gh',
        preflightStatusLoading: false
      })
    ).toBe('unavailable')
  })
})

describe('deriveIntegrationFlowState', () => {
  it('does not complete progress or banner state from accepted code-host tasks while tracker facts are unresolved', () => {
    const status = deriveIntegrationConnectionStatus(
      statusFacts({
        preflightStatus: {
          gh: { installed: true, authenticated: true },
          glab: { installed: false, authenticated: false }
        },
        linearStatus: { connected: true },
        linearStatusContextKey: 'runtime:old#0'
      })
    )

    expect(
      deriveIntegrationFlowState({
        reviewConnected: status.reviewConnected,
        trackerProviderName: status.trackerProviderName,
        taskAccepted: true,
        trackerChecking: status.trackerChecking
      })
    ).toMatchObject({
      review: 'done',
      task: 'active',
      complete: false
    })
  })

  it('keeps tracker-before-code-host completion scoped to the task step only', () => {
    expect(
      deriveIntegrationFlowState({
        reviewConnected: false,
        trackerProviderName: 'Jira',
        taskAccepted: false,
        trackerChecking: false
      })
    ).toMatchObject({
      review: 'active',
      task: 'done',
      complete: false
    })
  })
})
