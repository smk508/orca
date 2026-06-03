import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { isGitRepoKind } from '../../../../shared/repo-kind'
import { checkRuntimeHooks } from '@/runtime/runtime-hooks-client'
import { hasEffectiveSetupCommand } from '@/lib/setup-script-status'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'
import {
  COMPUTER_USE_SKILL_NAME,
  ORCA_CLI_SKILL_NAME,
  ORCHESTRATION_SKILL_NAME
} from '@/lib/agent-feature-install-commands'
import {
  GLOBAL_AGENT_SKILL_SOURCE_KINDS,
  useInstalledAgentSkill
} from '@/hooks/useInstalledAgentSkills'
import {
  getFeatureWallSetupProgress,
  type FeatureWallSetupProgress
} from '../feature-wall/feature-wall-setup-progress'
import type { ComputerUsePermissionStatusResult } from '../../../../shared/computer-use-permissions-types'

export function getComputerUsePermissionSetupState(
  status: ComputerUsePermissionStatusResult | null
): { ready: boolean; unavailable: boolean } {
  return {
    ready:
      status !== null &&
      status.helperUnavailableReason === null &&
      status.permissions.every((permission) => permission.status !== 'not-granted'),
    unavailable: status !== null && status.helperUnavailableReason !== null
  }
}

export function useSetupGuideProgress(
  shouldRefreshCoreState: boolean,
  orchestrationSkillInstalled: boolean,
  browserUseSkillInstalled: boolean
): FeatureWallSetupProgress {
  const settings = useAppStore((s) => s.settings)
  const featureInteractions = useAppStore((s) => s.featureInteractions)
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const tabsByWorktree = useAppStore((s) => s.tabsByWorktree)
  const terminalLayoutsByTabId = useAppStore((s) => s.terminalLayoutsByTabId)
  const preflightStatus = useAppStore((s) => s.preflightStatus)
  const preflightStatusChecked = useAppStore((s) => s.preflightStatusChecked)
  const refreshPreflightStatus = useAppStore((s) => s.refreshPreflightStatus)
  const linearStatus = useAppStore((s) => s.linearStatus)
  const linearStatusChecked = useAppStore((s) => s.linearStatusChecked)
  const linearStatusContextKey = useAppStore((s) => s.linearStatusContextKey)
  const checkLinearConnection = useAppStore((s) => s.checkLinearConnection)
  const jiraStatus = useAppStore((s) => s.jiraStatus)
  const jiraStatusChecked = useAppStore((s) => s.jiraStatusChecked)
  const jiraStatusContextKey = useAppStore((s) => s.jiraStatusContextKey)
  const checkJiraConnection = useAppStore((s) => s.checkJiraConnection)
  const repos = useAppStore((s) => s.repos)
  const activeRepoId = useAppStore((s) => s.activeRepoId)
  const [hasSetupScript, setHasSetupScript] = useState(false)
  const [computerUsePermissionsReady, setComputerUsePermissionsReady] = useState(false)
  const [computerUseUnavailable, setComputerUseUnavailable] = useState(false)
  const { installed: detectedBrowserUseSkillInstalled } = useInstalledAgentSkill(
    ORCA_CLI_SKILL_NAME,
    {
      enabled: shouldRefreshCoreState,
      sourceKinds: GLOBAL_AGENT_SKILL_SOURCE_KINDS
    }
  )
  const { installed: computerUseSkillInstalled } = useInstalledAgentSkill(COMPUTER_USE_SKILL_NAME, {
    enabled: shouldRefreshCoreState,
    sourceKinds: GLOBAL_AGENT_SKILL_SOURCE_KINDS
  })
  const { installed: detectedOrchestrationSkillInstalled } = useInstalledAgentSkill(
    ORCHESTRATION_SKILL_NAME,
    {
      enabled: shouldRefreshCoreState,
      sourceKinds: GLOBAL_AGENT_SKILL_SOURCE_KINDS
    }
  )
  const providerRuntimeContextKey = getProviderRuntimeContextKey(settings)
  const linearStatusCurrent = linearStatusContextKey === providerRuntimeContextKey
  const jiraStatusCurrent = jiraStatusContextKey === providerRuntimeContextKey

  useEffect(() => {
    if (!shouldRefreshCoreState) {
      return
    }
    if (!preflightStatusChecked) {
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
    linearStatusCurrent,
    linearStatusChecked,
    jiraStatusCurrent,
    jiraStatusChecked,
    preflightStatusChecked,
    refreshPreflightStatus,
    shouldRefreshCoreState
  ])

  useEffect(() => {
    if (!shouldRefreshCoreState || !settings) {
      return
    }
    let stale = false
    const gitRepos = repos.filter(isGitRepoKind)
    const activeRepo = activeRepoId
      ? (gitRepos.find((repo) => repo.id === activeRepoId) ?? null)
      : null
    const orderedRepos = activeRepo
      ? [activeRepo, ...gitRepos.filter((repo) => repo.id !== activeRepo.id)]
      : gitRepos

    async function refreshSetupScriptState(): Promise<void> {
      for (const repo of orderedRepos) {
        const hooksResult = await checkRuntimeHooks(settings, repo.id).catch(() => null)
        if (stale) {
          return
        }
        if (hooksResult && hasEffectiveSetupCommand(repo, hooksResult)) {
          setHasSetupScript(true)
          return
        }
      }
      setHasSetupScript(false)
    }

    void refreshSetupScriptState()
    return () => {
      stale = true
    }
  }, [activeRepoId, repos, settings, shouldRefreshCoreState])

  const readComputerUsePermissions = useCallback(async (isStale: () => boolean): Promise<void> => {
    const status = await window.api.computerUsePermissions.getStatus().catch(() => null)
    if (isStale()) {
      return
    }
    const permissionState = getComputerUsePermissionSetupState(status)
    // oxlint-disable-next-line react-doctor/no-adjust-state-on-prop-change -- Why: async permission checks update setup progress after external OS state changes.
    setComputerUsePermissionsReady(permissionState.ready)
    setComputerUseUnavailable(permissionState.unavailable)
  }, [])

  useEffect(() => {
    if (!shouldRefreshCoreState || !computerUseSkillInstalled) {
      // oxlint-disable-next-line react-doctor/no-adjust-state-on-prop-change -- Why: unavailable setup-guide steps must clear stale permission readiness.
      setComputerUsePermissionsReady(false)
      // oxlint-disable-next-line react-doctor/no-adjust-state-on-prop-change -- Why: unavailable setup-guide steps must clear stale permission warnings.
      setComputerUseUnavailable(false)
      return
    }
    let stale = false
    const refreshComputerUsePermissions = (): void => {
      void readComputerUsePermissions(() => stale)
    }
    // oxlint-disable-next-line react-doctor/no-adjust-state-on-prop-change -- Why: refresh the setup checklist when the permission step becomes active.
    refreshComputerUsePermissions()
    const handleFocus = (): void => {
      void refreshComputerUsePermissions()
    }
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        void refreshComputerUsePermissions()
      }
    }
    // Why: users grant Computer Use permissions outside the setup guide. Refresh
    // on return so the checklist updates without requiring a remount.
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      stale = true
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [computerUseSkillInstalled, readComputerUsePermissions, shouldRefreshCoreState])

  const hasConnectedTaskSource =
    (preflightStatus?.gh.installed === true && preflightStatus.gh.authenticated === true) ||
    (preflightStatus?.glab?.installed === true && preflightStatus.glab.authenticated === true) ||
    (linearStatusCurrent && linearStatus.connected === true) ||
    (jiraStatusCurrent && jiraStatus.connected === true)
  const gitRepoCount = useMemo(() => repos.filter(isGitRepoKind).length, [repos])

  return useMemo(
    () =>
      getFeatureWallSetupProgress({
        settings,
        featureInteractions,
        hasConnectedTaskSource,
        browserUseSkillInstalled: browserUseSkillInstalled || detectedBrowserUseSkillInstalled,
        computerUseSkillInstalled,
        computerUsePermissionsReady,
        computerUseUnavailable,
        orchestrationSkillInstalled:
          orchestrationSkillInstalled || detectedOrchestrationSkillInstalled,
        gitRepoCount,
        worktreesByRepo,
        tabsByWorktree,
        terminalLayoutsByTabId,
        hasSetupScript
      }),
    [
      browserUseSkillInstalled,
      computerUseUnavailable,
      computerUsePermissionsReady,
      computerUseSkillInstalled,
      detectedBrowserUseSkillInstalled,
      detectedOrchestrationSkillInstalled,
      featureInteractions,
      terminalLayoutsByTabId,
      gitRepoCount,
      hasConnectedTaskSource,
      hasSetupScript,
      orchestrationSkillInstalled,
      settings,
      tabsByWorktree,
      worktreesByRepo
    ]
  )
}
