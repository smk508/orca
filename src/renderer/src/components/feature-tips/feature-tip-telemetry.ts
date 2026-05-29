export type OrcaCliFeatureTipSource = 'app_open' | 'manual'
export type OrcaCliFeatureTipSetupResult =
  | 'installed'
  | 'needs_attention'
  | 'dev_preview'
  | 'failed'

type OrcaCliFeatureTipEventName =
  | 'orca_cli_feature_tip_shown'
  | 'orca_cli_feature_tip_setup_clicked'
  | 'orca_cli_feature_tip_setup_result'

type OrcaCliFeatureTipPayload =
  | { source: OrcaCliFeatureTipSource }
  | { source: OrcaCliFeatureTipSource; result: OrcaCliFeatureTipSetupResult }

export function getOrcaCliFeatureTipTelemetrySource(value: unknown): OrcaCliFeatureTipSource {
  return value === 'app_open' ? 'app_open' : 'manual'
}

function logOrcaCliFeatureTipEvent(
  eventName: OrcaCliFeatureTipEventName,
  payload: OrcaCliFeatureTipPayload
): void {
  try {
    console.log(eventName, payload)
  } catch {
    // Why: feature-tip diagnostics must not affect setup flow if logging is replaced.
  }
}

export function trackOrcaCliFeatureTipShown(source: OrcaCliFeatureTipSource): void {
  logOrcaCliFeatureTipEvent('orca_cli_feature_tip_shown', { source })
}

export function trackOrcaCliFeatureTipSetupClicked(source: OrcaCliFeatureTipSource): void {
  logOrcaCliFeatureTipEvent('orca_cli_feature_tip_setup_clicked', { source })
}

export function trackOrcaCliFeatureTipSetupResult(
  source: OrcaCliFeatureTipSource,
  result: OrcaCliFeatureTipSetupResult
): void {
  logOrcaCliFeatureTipEvent('orca_cli_feature_tip_setup_result', { source, result })
}
