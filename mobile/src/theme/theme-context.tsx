// Why: resolves the effective app-chrome palette (light or dark) from the
// stored appearance preference plus the device's OS color scheme, and hands
// migrated screens the active palette object via `useThemeColors()`. Screens
// not yet migrated keep importing the static `colors` (dark) from
// mobile-theme.ts; this context only drives the ones that opt in.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme, type ColorSchemeName } from 'react-native'
import { darkColors, lightColors, type ThemeColors } from './mobile-theme'
import {
  DEFAULT_APP_APPEARANCE,
  loadAppAppearance,
  saveAppAppearance,
  type AppAppearance
} from '../storage/preferences'

type ThemeContextValue = {
  // The user's stored choice: 'system' | 'light' | 'dark'.
  appearance: AppAppearance
  // The palette actually in effect once 'system' is resolved against the OS.
  colors: ThemeColors
  // 'light' | 'dark' — the resolved scheme, handy for StatusBar style etc.
  resolvedScheme: 'light' | 'dark'
  // Persist + apply a new appearance choice.
  setAppearance: (next: AppAppearance) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function resolveScheme(appearance: AppAppearance, systemScheme: ColorSchemeName): 'light' | 'dark' {
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

  // Why: hydrate the stored choice once on mount. Until it resolves we render
  // with the default ('system'), so the very first frame already tracks the OS.
  useEffect(() => {
    let cancelled = false
    void loadAppAppearance().then((stored) => {
      if (!cancelled) {
        setAppearanceState(stored)
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

  const value = useMemo<ThemeContextValue>(() => {
    const resolvedScheme = resolveScheme(appearance, systemScheme)
    return {
      appearance,
      colors: resolvedScheme === 'light' ? lightColors : darkColors,
      resolvedScheme,
      setAppearance
    }
  }, [appearance, systemScheme, setAppearance])

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
