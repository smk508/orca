import ExpoHardwareKeyboardModule from './ExpoHardwareKeyboardModule'

export { OrcaKeyCaptureView } from './OrcaKeyCaptureView'
export type { NativeKeyEvent, OrcaKeyCaptureProps } from './OrcaKeyCaptureView'

// Whether a physical keyboard is currently attached to the device.
export function isHardwareKeyboardConnected(): boolean {
  return ExpoHardwareKeyboardModule.isHardwareKeyboardConnected()
}
