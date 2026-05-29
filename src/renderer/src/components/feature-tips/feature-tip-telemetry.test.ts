import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getOrcaCliFeatureTipTelemetrySource,
  trackOrcaCliFeatureTipSetupClicked,
  trackOrcaCliFeatureTipSetupResult,
  trackOrcaCliFeatureTipShown
} from './feature-tip-telemetry'

describe('feature tip telemetry', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  it('keeps feature tip sources low-cardinality', () => {
    expect(getOrcaCliFeatureTipTelemetrySource('app_open')).toBe('app_open')
    expect(getOrcaCliFeatureTipTelemetrySource('settings')).toBe('manual')
    expect(getOrcaCliFeatureTipTelemetrySource(undefined)).toBe('manual')
  })

  it('logs CLI tip exposure once per explicit call', () => {
    trackOrcaCliFeatureTipShown('app_open')

    expect(consoleLogSpy).toHaveBeenCalledTimes(1)
    expect(consoleLogSpy).toHaveBeenCalledWith('orca_cli_feature_tip_shown', {
      source: 'app_open'
    })
  })

  it('logs setup click and result without raw CLI details', () => {
    trackOrcaCliFeatureTipSetupClicked('app_open')
    trackOrcaCliFeatureTipSetupResult('app_open', 'installed')

    expect(consoleLogSpy).toHaveBeenCalledTimes(2)
    expect(consoleLogSpy).toHaveBeenNthCalledWith(1, 'orca_cli_feature_tip_setup_clicked', {
      source: 'app_open'
    })
    expect(consoleLogSpy).toHaveBeenNthCalledWith(2, 'orca_cli_feature_tip_setup_result', {
      source: 'app_open',
      result: 'installed'
    })

    for (const [eventName, payload] of consoleLogSpy.mock.calls) {
      expect(Object.keys(payload as Record<string, unknown>).sort()).toEqual(
        eventName === 'orca_cli_feature_tip_setup_result' ? ['result', 'source'] : ['source']
      )
      expect(payload).not.toHaveProperty('command_path')
      expect(payload).not.toHaveProperty('command')
      expect(payload).not.toHaveProperty('error')
      expect(payload).not.toHaveProperty('repo')
      expect(payload).not.toHaveProperty('branch')
      expect(payload).not.toHaveProperty('url')
      expect(payload).not.toHaveProperty('text')
    }
  })

  it('keeps setup result values enum-only', () => {
    for (const result of ['installed', 'needs_attention', 'dev_preview', 'failed'] as const) {
      trackOrcaCliFeatureTipSetupResult('manual', result)
    }

    expect(consoleLogSpy).toHaveBeenCalledTimes(4)
    expect(consoleLogSpy.mock.calls.map(([, payload]) => payload)).toEqual([
      { source: 'manual', result: 'installed' },
      { source: 'manual', result: 'needs_attention' },
      { source: 'manual', result: 'dev_preview' },
      { source: 'manual', result: 'failed' }
    ])
  })

  it('does not throw when console logging fails', () => {
    consoleLogSpy.mockImplementation(() => {
      throw new Error('console unavailable')
    })

    expect(() => trackOrcaCliFeatureTipShown('manual')).not.toThrow()
  })
})
