import { requireNativeModule } from 'expo-modules-core'

// Loads the native module object (JSI) or the bridge fallback when the remote
// debugger is on.
export default requireNativeModule('ExpoHardwareKeyboard')
