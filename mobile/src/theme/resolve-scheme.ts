// Why: the rule for turning a stored appearance preference ('system' | 'light'
// | 'dark') into an effective 'light' | 'dark', resolved against the device's OS
// color scheme. Extracted as a pure, dependency-free function so both the app-
// chrome and the terminal-palette surfaces in theme-context share one
// implementation, and so the resolution is unit-testable without rendering.

// The value React Native's useColorScheme() returns ('light' | 'dark' |
// 'unspecified'), plus null/undefined for safety. Typed locally to keep this
// module free of a react-native import. Anything other than 'light' resolves to
// dark, so 'unspecified'/null/undefined all fall back to the app's dark default.
export type SystemColorScheme = 'light' | 'dark' | 'unspecified' | null | undefined

export function resolveScheme(
  appearance: 'system' | 'light' | 'dark',
  systemScheme: SystemColorScheme
): 'light' | 'dark' {
  if (appearance === 'light' || appearance === 'dark') {
    return appearance
  }
  // 'system' — follow the OS, falling back to dark when the OS scheme is
  // unavailable (matches the app's historical dark default).
  return systemScheme === 'light' ? 'light' : 'dark'
}
