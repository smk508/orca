import { describe, expect, it } from 'vitest'
import type { RuntimeMobileTerminalTheme } from '../../../src/shared/runtime-types'
import { resolveTerminalThemeForScheme } from './terminal-color-scheme'

const lightPalette = { background: '#ffffff', foreground: '#000000' }
const darkPalette = { background: '#000000', foreground: '#ffffff' }

function themeWithPalettes(): RuntimeMobileTerminalTheme {
  return {
    mode: 'dark',
    theme: darkPalette,
    palettes: { light: lightPalette, dark: darkPalette }
  }
}

describe('resolveTerminalThemeForScheme', () => {
  it('picks the light palette for the light scheme', () => {
    const resolved = resolveTerminalThemeForScheme(themeWithPalettes(), 'light')

    expect(resolved?.mode).toBe('light')
    expect(resolved?.theme).toEqual(lightPalette)
  })

  it('picks the dark palette for the dark scheme', () => {
    const resolved = resolveTerminalThemeForScheme(themeWithPalettes(), 'dark')

    expect(resolved?.mode).toBe('dark')
    expect(resolved?.theme).toEqual(darkPalette)
  })

  it('falls back to the host theme unchanged when palettes are absent', () => {
    // An older host (or no palette resolved) sends only the single resolved
    // palette; the client must still render the host's default mode/theme.
    const hostOnly: RuntimeMobileTerminalTheme = { mode: 'dark', theme: darkPalette }

    const resolved = resolveTerminalThemeForScheme(hostOnly, 'light')

    expect(resolved).toBe(hostOnly)
  })

  it('returns undefined when there is no terminal theme', () => {
    expect(resolveTerminalThemeForScheme(undefined, 'light')).toBeUndefined()
  })
})
