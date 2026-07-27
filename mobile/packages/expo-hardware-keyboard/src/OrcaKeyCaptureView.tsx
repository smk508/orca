import { requireNativeViewManager } from 'expo-modules-core'
import * as React from 'react'
import type { ViewProps } from 'react-native'

// One raw hardware key press. iOS leaves `key` empty (resolve from the HID `keyCode`); Android pre-resolves `key` and leaves `keyCode` at 0.
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
