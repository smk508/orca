package expo.modules.hardwarekeyboard

import android.content.Context
import android.hardware.input.InputManager
import android.view.InputDevice
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoHardwareKeyboardModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ExpoHardwareKeyboard")

        Function("isHardwareKeyboardConnected") {
            val inputManager = appContext.reactContext
                ?.getSystemService(Context.INPUT_SERVICE) as? InputManager
                ?: return@Function false
            inputManager.inputDeviceIds.any { id ->
                val device = inputManager.getInputDevice(id)
                device != null &&
                    !device.isVirtual &&
                    device.keyboardType == InputDevice.KEYBOARD_TYPE_ALPHABETIC
            }
        }

        View(OrcaKeyCaptureView::class) {
            Events("onKey")

            Prop("active") { view: OrcaKeyCaptureView, active: Boolean ->
                view.setActive(active)
            }
        }
    }
}
