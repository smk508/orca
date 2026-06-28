import { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Bell,
  Wrench,
  Shield,
  LifeBuoy,
  Mic,
  Globe,
  Check,
  Sun,
  Moon,
  SunMoon,
  Terminal as TerminalIcon
} from 'lucide-react-native'
import { spacing, typography, type ThemeColors } from '../src/theme/mobile-theme'
import { useTheme } from '../src/theme/theme-context'
import { type AppAppearance } from '../src/storage/preferences'

// Why: the three appearance choices the picker offers, in display order.
// 'system' leads because it's the default and the option most users keep.
const APPEARANCE_OPTIONS: Array<{
  value: AppAppearance
  label: string
  icon: typeof SunMoon
}> = [
  { value: 'system', label: 'System', icon: SunMoon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon }
]

export default function SettingsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors, appearance, setAppearance } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={22} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.heading}>Settings</Text>
      </View>

      <Text style={styles.sectionLabel}>Appearance</Text>
      <View style={styles.section}>
        {APPEARANCE_OPTIONS.map((option, i) => {
          const Icon = option.icon
          const selected = appearance === option.value
          return (
            <View key={option.value}>
              {i > 0 ? <View style={styles.separator} /> : null}
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => setAppearance(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Icon size={16} color={colors.textSecondary} />
                <Text style={styles.rowLabel}>{option.label}</Text>
                {selected ? <Check size={16} color={colors.accentBlue} /> : null}
              </Pressable>
            </View>
          )
        })}
      </View>

      <View style={[styles.section, styles.sectionSpacer]}>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => router.push('/terminal-settings')}
        >
          <TerminalIcon size={16} color={colors.textSecondary} />
          <Text style={styles.rowLabel}>Terminal</Text>
          <ChevronRight size={16} color={colors.textMuted} />
        </Pressable>
        <View style={styles.separator} />
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => router.push('/browser-settings')}
        >
          <Globe size={16} color={colors.textSecondary} />
          <Text style={styles.rowLabel}>Browser</Text>
          <ChevronRight size={16} color={colors.textMuted} />
        </Pressable>
        <View style={styles.separator} />
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => router.push('/voice-settings')}
        >
          <Mic size={16} color={colors.textSecondary} />
          <Text style={styles.rowLabel}>Voice</Text>
          <ChevronRight size={16} color={colors.textMuted} />
        </Pressable>
        <View style={styles.separator} />
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => router.push('/notifications')}
        >
          <Bell size={16} color={colors.textSecondary} />
          <Text style={styles.rowLabel}>Notifications</Text>
          <ChevronRight size={16} color={colors.textMuted} />
        </Pressable>
        <View style={styles.separator} />
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => router.push('/troubleshoot')}
        >
          <Wrench size={16} color={colors.textSecondary} />
          <Text style={styles.rowLabel}>Troubleshooting</Text>
          <ChevronRight size={16} color={colors.textMuted} />
        </Pressable>
        <View style={styles.separator} />
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => router.push('/about')}
        >
          <Info size={16} color={colors.textSecondary} />
          <Text style={styles.rowLabel}>About</Text>
          <ChevronRight size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={[styles.section, styles.sectionSpacer]}>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => void Linking.openURL('https://www.onorca.dev/privacy')}
        >
          <Shield size={16} color={colors.textSecondary} />
          <Text style={styles.rowLabel}>Privacy Policy</Text>
        </Pressable>
        <View style={styles.separator} />
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => void Linking.openURL('https://github.com/stablyai/orca/issues')}
        >
          <LifeBuoy size={16} color={colors.textSecondary} />
          <Text style={styles.rowLabel}>Support</Text>
        </Pressable>
      </View>
    </View>
  )
}

// Why: a factory so the Settings screen styles bind to the active palette
// (it's one of the screens that drives the live light/dark toggle, so it must
// re-style on its own change). SettingsScreen memoizes the result per palette.
function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgBase,
      padding: spacing.lg
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xl
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm
    },
    heading: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.xs
    },
    section: {
      backgroundColor: colors.bgPanel,
      borderRadius: 12,
      overflow: 'hidden'
    },
    sectionSpacer: {
      marginTop: spacing.md
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 2,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md + 2
    },
    rowPressed: {
      backgroundColor: colors.bgRaised
    },
    rowLabel: {
      flex: 1,
      fontSize: typography.bodySize,
      fontWeight: '500',
      color: colors.textPrimary
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderSubtle,
      marginHorizontal: spacing.md
    }
  })
}
