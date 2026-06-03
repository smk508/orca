import { useEffect } from 'react'
import type { FeatureWallWorkflow } from '../../../../shared/feature-wall-workflows'
import { useAppStore } from '@/store'
import { getProviderRuntimeContextKey } from '@/lib/provider-runtime-context'

export type FeatureWallTaskSourcePresentation = {
  workflow: FeatureWallWorkflow
  hasConnectedTaskSource: boolean
  // True until the first provider status checks resolve. Callers should treat
  // unknown state as "don't show the disconnected setup affordance yet" so we
  // don't flash inline integration rows for a connected user.
  isCheckingTaskSources: boolean
}

export function useFeatureWallTaskSourcePresentation(
  isOpen: boolean,
  selected: FeatureWallWorkflow
): FeatureWallTaskSourcePresentation {
  const preflightStatus = useAppStore((s) => s.preflightStatus)
  const preflightStatusChecked = useAppStore((s) => s.preflightStatusChecked)
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
  const settings = useAppStore((s) => s.settings)
  const providerRuntimeContextKey = getProviderRuntimeContextKey(settings)
  const linearStatusCurrent = linearStatusContextKey === providerRuntimeContextKey
  const jiraStatusCurrent = jiraStatusContextKey === providerRuntimeContextKey

  useEffect(() => {
    if (!isOpen) {
      return
    }
    // Why: the Tasks tour copy depends on whether a task source is already
    // usable, so connected users should not see setup-oriented guidance.
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
    isOpen,
    jiraStatusCurrent,
    jiraStatusChecked,
    linearStatusCurrent,
    linearStatusChecked,
    preflightStatusChecked,
    refreshPreflightStatus
  ])

  const hasConnectedTaskSource =
    (preflightStatus?.gh.installed === true && preflightStatus.gh.authenticated === true) ||
    (preflightStatus?.glab?.installed === true && preflightStatus.glab.authenticated === true) ||
    (linearStatusCurrent && linearStatus.connected === true) ||
    (jiraStatusCurrent && jiraStatus.connected === true)
  const isCheckingTaskSources =
    preflightStatusLoading ||
    !preflightStatusChecked ||
    !linearStatusCurrent ||
    !linearStatusChecked ||
    !jiraStatusCurrent ||
    !jiraStatusChecked

  return { workflow: selected, hasConnectedTaskSource, isCheckingTaskSources }
}
