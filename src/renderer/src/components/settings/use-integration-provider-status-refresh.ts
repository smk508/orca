import { useEffect } from 'react'
import { useAppStore } from '@/store'

export function useIntegrationProviderStatusRefresh(): void {
  const checkLinearConnection = useAppStore((s) => s.checkLinearConnection)
  const checkJiraConnection = useAppStore((s) => s.checkJiraConnection)
  const refreshPreflightStatus = useAppStore((s) => s.refreshPreflightStatus)

  useEffect(() => {
    void checkLinearConnection()
    void checkJiraConnection()
    void refreshPreflightStatus()
  }, [checkJiraConnection, checkLinearConnection, refreshPreflightStatus])
}
