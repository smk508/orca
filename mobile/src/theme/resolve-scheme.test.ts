import { describe, expect, it } from 'vitest'
import { resolveScheme } from './resolve-scheme'
import { resolveTerminalThemeForScheme } from '../terminal/terminal-color-scheme'
import type { RuntimeMobileTerminalTheme } from '../../../src/shared/runtime-types'

describe('resolveScheme', () => {
  it("follows the OS when the preference is 'system'", () => {
    expect(resolveScheme('system', 'light')).toBe('light')
    expect(resolveScheme('system', 'dark')).toBe('dark')
  })

  it("falls back to dark when 'system' and the OS scheme is unavailable", () => {
    expect(resolveScheme('system', null)).toBe('dark')
    expect(resolveScheme('system', undefined)).toBe('dark')
  })

  it('honors an explicit override regardless of the OS scheme', () => {
    expect(resolveScheme('light', 'dark')).toBe('light')
    expect(resolveScheme('dark', 'light')).toBe('dark')
  })
})

// The seam this feature adds: a stored terminalColorScheme + the device OS
// scheme together decide which of the host's two palettes the terminal renders.
// This composes the same two functions theme-context + the session screen wire
// together (resolveScheme → resolveTerminalThemeForScheme), so it proves the
// end-to-end decision without rendering the session screen.
describe('terminal palette selected from preference + OS scheme', () => {
  const lightPalette = { background: '#ffffff', foreground: '#000000' }
  const darkPalette = { background: '#1e1e2e', foreground: '#cdd6f4' }
  const hostTheme: RuntimeMobileTerminalTheme = {
    mode: 'dark',
    theme: darkPalette,
    palettes: { light: lightPalette, dark: darkPalette }
  }

  function paletteFor(pref: 'system' | 'light' | 'dark', os: 'light' | 'dark' | null) {
    return resolveTerminalThemeForScheme(hostTheme, resolveScheme(pref, os))?.theme
  }

  it("'system' tracks the device: light OS → light palette, dark OS → dark palette", () => {
    expect(paletteFor('system', 'light')).toEqual(lightPalette)
    expect(paletteFor('system', 'dark')).toEqual(darkPalette)
  })

  it('a device override wins over the OS scheme', () => {
    // iPad set to Light while the OS is Dark → light terminal (and vice-versa).
    expect(paletteFor('light', 'dark')).toEqual(lightPalette)
    expect(paletteFor('dark', 'light')).toEqual(darkPalette)
  })

  it("on 'system', flipping the OS scheme flips the palette", () => {
    expect(paletteFor('system', 'light')).toEqual(lightPalette)
    expect(paletteFor('system', 'dark')).toEqual(darkPalette)
  })

  it('falls back to the host palette when the host sent only one (older host)', () => {
    const hostOnly: RuntimeMobileTerminalTheme = { mode: 'dark', theme: darkPalette }
    expect(resolveTerminalThemeForScheme(hostOnly, resolveScheme('light', 'dark'))?.theme).toBe(
      darkPalette
    )
  })
})
