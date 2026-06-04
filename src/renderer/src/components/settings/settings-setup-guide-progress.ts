import { useEffect, useMemo } from 'react'
import type { FeatureWallSetupStepId } from '../../../../shared/feature-wall-setup-steps'
import { useAppStore } from '@/store'
import { getLocalPreflightContext, localPreflightContextKey } from '@/lib/local-preflight-context'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import { getFeatureWallSetupProgress } from '../feature-wall/feature-wall-setup-progress'
import { deriveIntegrationConnectionStatus } from '../feature-wall/use-integration-connection-status'

export const SETTINGS_SETUP_GUIDE_STEP_IDS = [
  'split-terminal',
  'two-worktrees',
  'notifications',
  'default-agent',
  'task-sources'
] as const satisfies readonly FeatureWallSetupStepId[]

export type SettingsSetupGuideProgress = {
  doneCount: number
  total: number
  firstIncompleteStepId: FeatureWallSetupStepId | null
}

export function getSettingsSetupGuideProgress(
  stepDone: Partial<Record<FeatureWallSetupStepId, boolean>>
): SettingsSetupGuideProgress {
  const doneCount = SETTINGS_SETUP_GUIDE_STEP_IDS.filter((stepId) => stepDone[stepId]).length
  const firstIncompleteStepId =
    SETTINGS_SETUP_GUIDE_STEP_IDS.find((stepId) => !stepDone[stepId]) ?? null

  return {
    doneCount,
    total: SETTINGS_SETUP_GUIDE_STEP_IDS.length,
    firstIncompleteStepId
  }
}

export function useSettingsSetupGuideProgress(
  shouldRefreshTaskSourceState: boolean
): SettingsSetupGuideProgress {
  const settings = useAppStore((s) => s.settings)
  const featureInteractions = useAppStore((s) => s.featureInteractions)
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const tabsByWorktree = useAppStore((s) => s.tabsByWorktree)
  const terminalLayoutsByTabId = useAppStore((s) => s.terminalLayoutsByTabId)
  const preflightStatus = useAppStore((s) => s.preflightStatus)
  const preflightStatusChecked = useAppStore((s) => s.preflightStatusChecked)
  const preflightStatusContextKey = useAppStore((s) => s.preflightStatusContextKey)
  const preflightStatusError = useAppStore((s) => s.preflightStatusError)
  const preflightStatusLoading = useAppStore((s) => s.preflightStatusLoading)
  const refreshPreflightStatus = useAppStore((s) => s.refreshPreflightStatus)
  const linearStatus = useAppStore((s) => s.linearStatus)
  const linearStatusChecked = useAppStore((s) => s.linearStatusChecked)
  const linearStatusContextKey = useAppStore((s) => s.linearStatusContextKey)
  const checkLinearConnection = useAppStore((s) => s.checkLinearConnection)
  const jiraStatus = useAppStore((s) => s.jiraStatus)
  const jiraStatusChecked = useAppStore((s) => s.jiraStatusChecked)
  const jiraStatusContextKey = useAppStore((s) => s.jiraStatusContextKey)
  const checkJiraConnection = useAppStore((s) => s.checkJiraConnection)
  const expectedPreflightContextKey = useAppStore((s) =>
    localPreflightContextKey(getLocalPreflightContext(s))
  )
  const providerRuntimeContextKey = getProviderRuntimeContextKey(settings)
  const linearStatusCurrent = linearStatusContextKey === providerRuntimeContextKey
  const jiraStatusCurrent = jiraStatusContextKey === providerRuntimeContextKey
  const preflightStatusCurrent = preflightStatusContextKey === expectedPreflightContextKey

  useEffect(() => {
    if (!shouldRefreshTaskSourceState) {
      return
    }
    if (!preflightStatusCurrent || !preflightStatusChecked) {
      void refreshPreflightStatus()
    }
    if (!linearStatusCurrent || !linearStatusChecked) {
      void checkLinearConnection()
    }
    if (!jiraStatusCurrent || !jiraStatusChecked) {
      void checkJiraConnection()
    }
  }, [
    checkJiraConnection,
    checkLinearConnection,
    expectedPreflightContextKey,
    jiraStatusCurrent,
    jiraStatusChecked,
    jiraStatusContextKey,
    linearStatusCurrent,
    linearStatusChecked,
    linearStatusContextKey,
    preflightStatusContextKey,
    preflightStatusCurrent,
    preflightStatusChecked,
    providerRuntimeContextKey,
    refreshPreflightStatus,
    shouldRefreshTaskSourceState
  ])

  const hasConnectedTaskSource = deriveIntegrationConnectionStatus({
    preflightStatus,
    preflightStatusChecked,
    preflightStatusContextKey,
    preflightStatusError,
    preflightStatusLoading,
    expectedPreflightContextKey,
    linearStatus,
    linearStatusChecked,
    linearStatusContextKey,
    jiraStatus,
    jiraStatusChecked,
    jiraStatusContextKey,
    providerRuntimeContextKey
  }).trackerConnected

  return useMemo(() => {
    // Why: Settings renders only five steps, so avoid the full setup guide
    // probes for setup scripts and agent skills, especially over SSH.
    const fullProgress = getFeatureWallSetupProgress({
      settings,
      featureInteractions,
      hasConnectedTaskSource,
      browserUseSkillInstalled: false,
      computerUseSkillInstalled: false,
      computerUsePermissionsReady: false,
      orchestrationSkillInstalled: false,
      gitRepoCount: 0,
      worktreesByRepo,
      tabsByWorktree,
      terminalLayoutsByTabId,
      hasSetupScript: false
    })
    return getSettingsSetupGuideProgress(fullProgress.stepDone)
  }, [
    featureInteractions,
    hasConnectedTaskSource,
    settings,
    tabsByWorktree,
    terminalLayoutsByTabId,
    worktreesByRepo
  ])
}
