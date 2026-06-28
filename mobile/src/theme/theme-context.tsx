// Why: resolves the effective light/dark schemes from the stored appearance
// preferences plus the device's OS color scheme. It drives two independent
// surfaces: the app-chrome palette (handed to migrated screens via
// `useThemeColors()`), and the terminal color scheme (a separate per-device
// choice the session screen uses to pick one of the host's two palettes).
// Screens not yet migrated keep importing the static `colors` (dark) from
// mobile-theme.ts; this context only drives the ones that opt in.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme, type ColorSchemeName } from 'react-native'
import { darkColors, lightColors, type ThemeColors } from './mobile-theme'
import {
  DEFAULT_APP_APPEARANCE,
  DEFAULT_TERMINAL_COLOR_SCHEME,
  loadAppAppearance,
  loadTerminalColorScheme,
  saveAppAppearance,
  saveTerminalColorScheme,
  type AppAppearance,
  type TerminalColorScheme
} from '../storage/preferences'

type ThemeContextValue = {
  // The user's stored app-chrome choice: 'system' | 'light' | 'dark'.
  appearance: AppAppearance
  // The palette actually in effect once 'system' is resolved against the OS.
  colors: ThemeColors
  // 'light' | 'dark' — the resolved app-chrome scheme, handy for StatusBar etc.
  resolvedScheme: 'light' | 'dark'
  // Persist + apply a new app-chrome appearance choice.
  setAppearance: (next: AppAppearance) => void
  // The user's stored terminal-palette choice: 'system' | 'light' | 'dark'.
  terminalColorScheme: TerminalColorScheme
  // 'light' | 'dark' — the terminal scheme in effect once 'system' is resolved.
  resolvedTerminalScheme: 'light' | 'dark'
  // Persist + apply a new terminal-palette choice.
  setTerminalColorScheme: (next: TerminalColorScheme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

// Shared by both surfaces: 'system' | 'light' | 'dark' values are structurally
// identical, so one resolver serves the app chrome and the terminal palette.
function resolveScheme(
  appearance: AppAppearance | TerminalColorScheme,
  systemScheme: ColorSchemeName
): 'light' | 'dark' {
  if (appearance === 'light' || appearance === 'dark') {
    return appearance
  }
  // 'system' — follow the OS, falling back to dark when the OS scheme is
  // unavailable (matches the app's historical dark default).
  return systemScheme === 'light' ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()
  const [appearance, setAppearanceState] = useState<AppAppearance>(DEFAULT_APP_APPEARANCE)
  const [terminalColorScheme, setTerminalColorSchemeState] = useState<TerminalColorScheme>(
    DEFAULT_TERMINAL_COLOR_SCHEME
  )

  // Why: hydrate the stored choices once on mount. Until they resolve we render
  // with the defaults ('system'), so the very first frame already tracks the OS.
  useEffect(() => {
    let cancelled = false
    void loadAppAppearance().then((stored) => {
      if (!cancelled) {
        setAppearanceState(stored)
      }
    })
    void loadTerminalColorScheme().then((stored) => {
      if (!cancelled) {
        setTerminalColorSchemeState(stored)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setAppearance = useMemo(
    () => (next: AppAppearance) => {
      setAppearanceState(next)
      void saveAppAppearance(next)
    },
    []
  )

  const setTerminalColorScheme = useMemo(
    () => (next: TerminalColorScheme) => {
      setTerminalColorSchemeState(next)
      void saveTerminalColorScheme(next)
    },
    []
  )

  const value = useMemo<ThemeContextValue>(() => {
    const resolvedScheme = resolveScheme(appearance, systemScheme)
    return {
      appearance,
      colors: resolvedScheme === 'light' ? lightColors : darkColors,
      resolvedScheme,
      setAppearance,
      terminalColorScheme,
      resolvedTerminalScheme: resolveScheme(terminalColorScheme, systemScheme),
      setTerminalColorScheme
    }
  }, [appearance, systemScheme, setAppearance, terminalColorScheme, setTerminalColorScheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// Why: throws if used outside the provider so a missing wrap surfaces loudly in
// development rather than silently rendering the wrong palette.
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}

// The common case: a migrated screen just wants the active palette.
export function useThemeColors(): ThemeColors {
  return useTheme().colors
}
