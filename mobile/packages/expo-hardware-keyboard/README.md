# @orca/expo-hardware-keyboard

Native module that forwards **hardware-keyboard** key events — including
modifiers (Ctrl/Alt/Shift) and special keys (arrows, Esc, Tab, function keys) —
to JavaScript.

## Why this exists

React Native's `TextInput` only surfaces printable characters (`onChangeText`)
and Backspace (`onKeyPress`) on iOS. A physical Ctrl, Alt, arrow, Esc, or
function key produces no usable JS event. The mobile terminal needs those keys
to drive a remote shell, so this module captures them at the native layer.

The module deliberately does **no** terminal byte-encoding. It reports the raw
key + modifier state; the app maps that to control bytes via the existing
`buildTerminalShortcutKey()` in `mobile/src/terminal/terminal-accessory-keys.ts`
(see `mobile/src/terminal/terminal-hardware-key.ts`).

## API

```tsx
import {
  OrcaKeyCaptureView,
  isHardwareKeyboardConnected,
  type NativeKeyEvent
} from '@orca/expo-hardware-keyboard'

// Mount only when you want to capture physical keys. While active on iOS the
// software keyboard stays hidden, so gate it on a hardware keyboard being present.
<OrcaKeyCaptureView
  active
  style={StyleSheet.absoluteFill}
  onKey={({ nativeEvent }) => {
    /* nativeEvent: NativeKeyEvent */
  }}
/>
```

### `NativeKeyEvent`

| Field | iOS | Android |
|---|---|---|
| `key` | `''` (resolve from `keyCode`) | normalized key id or base char |
| `keyCode` | USB HID usage id (`UIKey.keyCode`) | `0` |
| `characters` / `charactersIgnoringModifiers` | from `UIKey` | `''` |
| `ctrlKey` / `altKey` / `shiftKey` / `metaKey` | modifier flags | modifier state |

## Platform notes

- **iOS** (13.4+): an `ExpoView` that becomes first responder and overrides
  `pressesBegan`. Hardware-keyboard detection uses `GCKeyboard` (iOS 14+).
- **Android**: a focusable `ExpoView` overriding `dispatchKeyEvent`. Special
  keys and the base character are resolved natively into `key`.

## Known limitations / TODO

- No auto key-repeat yet (holding an arrow sends one event). A native repeat
  timer or `UIKey`-repeat handling is a follow-up.
- Shifted punctuation relies on the byte builder's `applyShift` table; uncommon
  symbol + modifier combos should be spot-checked on device.
