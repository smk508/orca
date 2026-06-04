import { requireNativeViewManager } from 'expo-modules-core'
import * as React from 'react'
import { type ViewProps } from 'react-native'

// One raw hardware key press, as reported by the native capture view.
//
// On iOS, `key` is empty and the consumer resolves the key id from `keyCode`
// (a USB HID usage id). On Android, native code pre-resolves and sets `key`
// directly (a normalized key id like "escape"/"arrowUp", or a base printable
// character) and leaves `keyCode` at 0.
export type NativeKeyEvent = {
  key: string
  keyCode: number
  characters: string
  charactersIgnoringModifiers: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

export type OrcaKeyCaptureProps = ViewProps & {
  // When true, the view takes first responder / focus and begins capturing
  // hardware key events. While active on iOS, the software keyboard stays hidden.
  active?: boolean
  onKey?: (event: { nativeEvent: NativeKeyEvent }) => void
}

const NativeView: React.ComponentType<OrcaKeyCaptureProps> =
  requireNativeViewManager('ExpoHardwareKeyboard')

export function OrcaKeyCaptureView(props: OrcaKeyCaptureProps) {
  return <NativeView {...props} />
}
