import {
  buildTerminalShortcutKey,
  type TerminalShortcutBinding,
  type TerminalShortcutModifier
} from './terminal-accessory-keys'

// Structural shape of a raw native key event. Kept local (rather than imported
// from `@orca/expo-hardware-keyboard`) so this pure module — and its unit test —
// carry no dependency on the native module. The package's `NativeKeyEvent` is
// structurally compatible, so callers can pass it directly.
export type HardwareKeyEvent = {
  key: string
  keyCode: number
  characters: string
  charactersIgnoringModifiers: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

// USB HID usage ids (Keyboard/Keypad page 0x07) for the non-printable keys we
// care about, as reported by iOS `UIKey.keyCode`. Printable keys are resolved
// from the event's character instead, so only special keys live here.
const HID_SPECIAL_KEYS: Record<number, string> = {
  0x29: 'escape',
  0x2b: 'tab',
  0x28: 'enter',
  0x2a: 'backspace',
  0x4c: 'delete',
  0x49: 'insert',
  0x2c: 'space',
  0x4f: 'arrowRight',
  0x50: 'arrowLeft',
  0x51: 'arrowDown',
  0x52: 'arrowUp',
  0x4a: 'home',
  0x4d: 'end',
  0x4b: 'pageUp',
  0x4e: 'pageDown',
  0x3a: 'f1',
  0x3b: 'f2',
  0x3c: 'f3',
  0x3d: 'f4',
  0x3e: 'f5',
  0x3f: 'f6',
  0x40: 'f7',
  0x41: 'f8',
  0x42: 'f9',
  0x43: 'f10',
  0x44: 'f11',
  0x45: 'f12'
}

// Turn a raw native key event into a shortcut binding the terminal byte builder
// understands. Returns null for keys we cannot represent (e.g. a bare modifier).
export function nativeKeyEventToShortcut(event: HardwareKeyEvent): TerminalShortcutBinding | null {
  const modifiers: TerminalShortcutModifier[] = []
  if (event.ctrlKey) {
    modifiers.push('ctrl')
  }
  if (event.altKey) {
    modifiers.push('alt')
  }
  if (event.shiftKey) {
    modifiers.push('shift')
  }

  // Android resolves the key id natively; trust it when present.
  if (event.key) {
    return { key: event.key, modifiers }
  }

  const special = HID_SPECIAL_KEYS[event.keyCode]
  if (special) {
    return { key: special, modifiers }
  }

  // Printable key: use the unmodified character so the byte builder can apply
  // shift itself (it maps `2` -> `@`, `a` -> `A`, etc.). Lowercase letters keep
  // shift in `modifiers` rather than baking it into the key.
  const base = event.charactersIgnoringModifiers || event.characters || ''
  const char = Array.from(base)[0]
  if (!char) {
    return null
  }
  if (char >= 'A' && char <= 'Z') {
    return { key: char.toLowerCase(), modifiers }
  }
  if (char >= ' ' && char <= '~') {
    return { key: char, modifiers }
  }
  return null
}

// Encode a raw native key event into the terminal control bytes to send, or null
// if the key has no representable byte sequence.
export function nativeKeyEventToBytes(event: HardwareKeyEvent): string | null {
  const binding = nativeKeyEventToShortcut(event)
  if (!binding) {
    return null
  }
  return buildTerminalShortcutKey(binding)?.bytes ?? null
}
