// Why: the host now ships both light and dark resolved terminal palettes in the
// runtime graph (CHE-1302). The client owns the trivial light-vs-dark pick
// (CHE-1301 ADR): given the device's resolved scheme, swap the palette the
// session screen passes to the WebView so it renders the device's choice rather
// than the host operator's. Theme *resolution* stays host-side; this only picks.
import type { RuntimeMobileTerminalTheme } from '../../../src/shared/runtime-types'

/**
 * Return a terminal theme whose active palette matches `scheme`.
 *
 * When the host sent both palettes (`palettes`), pick the one for `scheme` and
 * set `mode` to match. When `palettes` is absent — an older host, or no palette
 * resolved — return the theme unchanged so the client still renders the host's
 * default `mode`/`theme` (backward-compatible fallback per the AC).
 */
export function resolveTerminalThemeForScheme(
  terminalTheme: RuntimeMobileTerminalTheme | undefined,
  scheme: 'light' | 'dark'
): RuntimeMobileTerminalTheme | undefined {
  if (!terminalTheme?.palettes) {
    return terminalTheme
  }
  return {
    ...terminalTheme,
    mode: scheme,
    theme: terminalTheme.palettes[scheme]
  }
}
