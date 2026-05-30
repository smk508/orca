import type { FeatureInteractionState } from '../../../../shared/feature-interactions'
import {
  FEATURE_WALL_SETUP_STEPS,
  type FeatureWallSetupStepId
} from '../../../../shared/feature-wall-setup-steps'
import type { GlobalSettings, TerminalTab, Worktree } from '../../../../shared/types'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { parsePaneKey } from '../../../../shared/stable-pane-id'

export type FeatureWallSetupProgressInput = {
  settings: GlobalSettings | null
  featureInteractions: FeatureInteractionState
  hasConnectedTaskSource: boolean
  browserUseSkillInstalled: boolean
  computerUseSkillInstalled: boolean
  computerUsePermissionsReady: boolean
  orchestrationSkillInstalled: boolean
  gitRepoCount: number
  worktreesByRepo: Record<string, Worktree[]>
  tabsByWorktree: Record<string, TerminalTab[]>
  agentStatusByPaneKey: Record<string, AgentStatusEntry>
  hasSetupScript: boolean
}

export type FeatureWallSetupProgress = {
  stepDone: Record<FeatureWallSetupStepId, boolean>
  coreDoneCount: number
  coreTotal: number
}

function hasTwoHookReportedAgentsInOneWorktree(input: FeatureWallSetupProgressInput): boolean {
  const validWorktreeIds = new Set(
    Object.values(input.worktreesByRepo)
      .flat()
      .map((worktree) => worktree.id)
  )
  const tabIdToWorktreeId = new Map<string, string>()
  for (const [worktreeId, tabs] of Object.entries(input.tabsByWorktree)) {
    if (!validWorktreeIds.has(worktreeId)) {
      continue
    }
    for (const tab of tabs) {
      tabIdToWorktreeId.set(tab.id, worktreeId)
    }
  }

  const agentCountsByWorktree = new Map<string, number>()
  for (const paneKey of Object.keys(input.agentStatusByPaneKey)) {
    const parsed = parsePaneKey(paneKey)
    if (!parsed) {
      continue
    }
    const worktreeId = tabIdToWorktreeId.get(parsed.tabId)
    if (!worktreeId) {
      continue
    }
    const count = (agentCountsByWorktree.get(worktreeId) ?? 0) + 1
    if (count >= 2) {
      return true
    }
    agentCountsByWorktree.set(worktreeId, count)
  }
  return false
}

function countWorkspaces(worktreesByRepo: Record<string, Worktree[]>): number {
  return Object.values(worktreesByRepo).reduce((sum, worktrees) => sum + worktrees.length, 0)
}

export function getFeatureWallSetupProgress(
  input: FeatureWallSetupProgressInput
): FeatureWallSetupProgress {
  const agentCapabilitiesDone =
    input.browserUseSkillInstalled &&
    input.computerUseSkillInstalled &&
    input.computerUsePermissionsReady &&
    input.orchestrationSkillInstalled
  const stepDone: Record<FeatureWallSetupStepId, boolean> = {
    'default-agent':
      Boolean(input.settings?.defaultTuiAgent) && input.settings?.defaultTuiAgent !== 'blank',
    'add-two-repos': input.gitRepoCount >= 2,
    notifications:
      input.settings?.notifications.enabled === true &&
      input.settings.notifications.agentTaskComplete === true,
    'two-agents': hasTwoHookReportedAgentsInOneWorktree(input),
    'three-workspaces': countWorkspaces(input.worktreesByRepo) >= 2,
    'task-sources': input.hasConnectedTaskSource,
    'agent-capabilities': agentCapabilitiesDone,
    'setup-script': input.hasSetupScript
  }
  return {
    stepDone,
    coreDoneCount: FEATURE_WALL_SETUP_STEPS.filter((step) => stepDone[step.id]).length,
    coreTotal: FEATURE_WALL_SETUP_STEPS.length
  }
}
