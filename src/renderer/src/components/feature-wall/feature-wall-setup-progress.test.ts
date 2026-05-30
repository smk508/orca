import { describe, expect, it } from 'vitest'
import type { FeatureWallSetupProgressInput } from './feature-wall-setup-progress'
import { getFeatureWallSetupProgress } from './feature-wall-setup-progress'
import { getFeatureWallSetupSteps } from '../../../../shared/feature-wall-setup-steps'
import type { Worktree } from '../../../../shared/types'

function makeInput(
  overrides: Partial<FeatureWallSetupProgressInput> = {}
): FeatureWallSetupProgressInput {
  return {
    settings: null,
    featureInteractions: {},
    hasConnectedTaskSource: false,
    browserUseSkillInstalled: false,
    computerUseSkillInstalled: false,
    computerUsePermissionsReady: false,
    orchestrationSkillInstalled: false,
    gitRepoCount: 0,
    worktreesByRepo: {},
    tabsByWorktree: {},
    agentStatusByPaneKey: {},
    hasSetupScript: false,
    ...overrides
  }
}

function makeWorktree(id: string): Worktree {
  return { id } as unknown as Worktree
}

describe('getFeatureWallSetupProgress', () => {
  it('tracks Add 2 projects from durable git repo count', () => {
    expect(getFeatureWallSetupProgress(makeInput({ gitRepoCount: 1 })).stepDone).toMatchObject({
      'add-two-repos': false
    })

    const progress = getFeatureWallSetupProgress(makeInput({ gitRepoCount: 2 }))

    expect(progress.stepDone['add-two-repos']).toBe(true)
    expect(progress.coreTotal).toBe(8)
  })

  it('keeps Add 2 projects as the final core setup task', () => {
    expect(getFeatureWallSetupSteps().map((step) => step.id)).toEqual([
      'default-agent',
      'notifications',
      'two-agents',
      'three-workspaces',
      'task-sources',
      'agent-capabilities',
      'setup-script',
      'add-two-repos'
    ])
  })

  it('does not mark two agents complete from split-pane interaction alone', () => {
    const progress = getFeatureWallSetupProgress(
      makeInput({
        featureInteractions: {
          'terminal-pane-split': { firstInteractedAt: 1_700_000_000_000, interactionCount: 1 }
        }
      })
    )

    expect(progress.stepDone['two-agents']).toBe(false)
  })

  it('does not mark two agents complete from terminal titles alone', () => {
    const progress = getFeatureWallSetupProgress(
      makeInput({
        worktreesByRepo: { 'repo-1': [makeWorktree('worktree-1')] },
        tabsByWorktree: {
          'worktree-1': [
            { id: 'tab-1', title: 'Claude' },
            { id: 'tab-2', title: 'Codex' }
          ] as never
        }
      })
    )

    expect(progress.stepDone['two-agents']).toBe(false)
  })

  it('marks two agents complete once two hook-reported agent sessions exist in one worktree', () => {
    const progress = getFeatureWallSetupProgress(
      makeInput({
        worktreesByRepo: { 'repo-1': [makeWorktree('worktree-1')] },
        tabsByWorktree: {
          'worktree-1': [
            { id: 'tab-1', title: 'Terminal' },
            { id: 'tab-2', title: 'Terminal' }
          ] as never
        },
        agentStatusByPaneKey: {
          'tab-1:00000000-0000-4000-8000-000000000001': {
            paneKey: 'tab-1:00000000-0000-4000-8000-000000000001',
            state: 'working',
            prompt: 'first task',
            updatedAt: 1,
            stateStartedAt: 1,
            agentType: 'claude',
            stateHistory: []
          },
          'tab-2:00000000-0000-4000-8000-000000000002': {
            paneKey: 'tab-2:00000000-0000-4000-8000-000000000002',
            state: 'waiting',
            prompt: 'second task',
            updatedAt: 2,
            stateStartedAt: 2,
            agentType: 'codex',
            stateHistory: []
          }
        }
      })
    )

    expect(progress.stepDone['two-agents']).toBe(true)
  })

  it('does not mark two agents complete when hook-reported agents are in separate worktrees', () => {
    const progress = getFeatureWallSetupProgress(
      makeInput({
        worktreesByRepo: {
          'repo-1': [makeWorktree('worktree-1')],
          'repo-2': [makeWorktree('worktree-2')]
        },
        tabsByWorktree: {
          'worktree-1': [{ id: 'tab-1', title: 'Terminal' }] as never,
          'worktree-2': [{ id: 'tab-2', title: 'Terminal' }] as never
        },
        agentStatusByPaneKey: {
          'tab-1:00000000-0000-4000-8000-000000000001': {
            paneKey: 'tab-1:00000000-0000-4000-8000-000000000001',
            state: 'working',
            prompt: 'first task',
            updatedAt: 1,
            stateStartedAt: 1,
            agentType: 'claude',
            stateHistory: []
          },
          'tab-2:00000000-0000-4000-8000-000000000002': {
            paneKey: 'tab-2:00000000-0000-4000-8000-000000000002',
            state: 'working',
            prompt: 'second task',
            updatedAt: 2,
            stateStartedAt: 2,
            agentType: 'codex',
            stateHistory: []
          }
        }
      })
    )

    expect(progress.stepDone['two-agents']).toBe(false)
  })

  it('marks worktrees complete once two worktrees exist', () => {
    expect(
      getFeatureWallSetupProgress(
        makeInput({ worktreesByRepo: { 'repo-1': [makeWorktree('worktree-1')] } })
      ).stepDone['three-workspaces']
    ).toBe(false)

    const progress = getFeatureWallSetupProgress(
      makeInput({
        worktreesByRepo: {
          'repo-1': [makeWorktree('worktree-1'), makeWorktree('worktree-2')]
        }
      })
    )

    expect(progress.stepDone['three-workspaces']).toBe(true)
  })

  it('marks task sources complete for any supported connected provider', () => {
    const progress = getFeatureWallSetupProgress(makeInput({ hasConnectedTaskSource: true }))

    expect(progress.stepDone['task-sources']).toBe(true)
  })

  it('does not mark agent capabilities complete from setup-start interactions alone', () => {
    const progress = getFeatureWallSetupProgress(
      makeInput({
        featureInteractions: {
          'agent-browser-setup': { firstInteractedAt: 1_700_000_000_000, interactionCount: 1 },
          'computer-use-setup': { firstInteractedAt: 1_700_000_000_001, interactionCount: 1 },
          'agent-orchestration-setup': {
            firstInteractedAt: 1_700_000_000_002,
            interactionCount: 1
          }
        }
      })
    )

    expect(progress.stepDone['agent-capabilities']).toBe(false)
  })

  it('marks agent capabilities complete only when required skills and permissions are ready', () => {
    expect(
      getFeatureWallSetupProgress(
        makeInput({
          browserUseSkillInstalled: true,
          computerUseSkillInstalled: true,
          computerUsePermissionsReady: false,
          orchestrationSkillInstalled: true
        })
      ).stepDone['agent-capabilities']
    ).toBe(false)

    const progress = getFeatureWallSetupProgress(
      makeInput({
        browserUseSkillInstalled: true,
        computerUseSkillInstalled: true,
        computerUsePermissionsReady: true,
        orchestrationSkillInstalled: true
      })
    )

    expect(progress.stepDone['agent-capabilities']).toBe(true)
  })
})
