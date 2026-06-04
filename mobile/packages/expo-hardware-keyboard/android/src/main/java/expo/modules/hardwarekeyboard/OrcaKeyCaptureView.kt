package expo.modules.hardwarekeyboard

import android.content.Context
import android.view.KeyEvent
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

// Captures hardware-keyboard key events while focused and forwards them to JS.
// Android key codes differ from the iOS HID usage ids, so this view resolves the
// normalized key id (or base printable char) natively and sends it as `key`; JS
// prefers `key` when present and only falls back to iOS `keyCode` resolution.
class OrcaKeyCaptureView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
    private val onKey by EventDispatcher()
    private var isActive = false

    init {
        isFocusable = true
        isFocusableInTouchMode = true
    }

    fun setActive(value: Boolean) {
        if (value == isActive) return
        isActive = value
        if (value) {
            requestFocus()
        } else {
            clearFocus()
        }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (!isActive || event.action != KeyEvent.ACTION_DOWN) {
            return super.dispatchKeyEvent(event)
        }
        val key = resolveKey(event) ?: return super.dispatchKeyEvent(event)
        onKey(
            mapOf(
                "key" to key,
                "keyCode" to 0,
                "characters" to "",
                "charactersIgnoringModifiers" to "",
                "ctrlKey" to event.isCtrlPressed,
                "altKey" to event.isAltPressed,
                "shiftKey" to event.isShiftPressed,
                "metaKey" to event.isMetaPressed
            )
        )
        return true
    }

    private fun resolveKey(event: KeyEvent): String? {
        SPECIAL_KEYS[event.keyCode]?.let { return it }
        // getUnicodeChar(0) ignores meta state, yielding the unmodified base
        // character (e.g. 'a' for Shift+A) so JS can apply shift/ctrl itself.
        val base = event.getUnicodeChar(0)
        if (base == 0) return null
        val ch = base.toChar()
        return if (ch.code in 0x20..0x7e) ch.toString() else null
    }

    companion object {
        private val SPECIAL_KEYS: Map<Int, String> = mapOf(
            KeyEvent.KEYCODE_ESCAPE to "escape",
            KeyEvent.KEYCODE_TAB to "tab",
            KeyEvent.KEYCODE_ENTER to "enter",
            KeyEvent.KEYCODE_NUMPAD_ENTER to "enter",
            KeyEvent.KEYCODE_DEL to "backspace",
            KeyEvent.KEYCODE_FORWARD_DEL to "delete",
            KeyEvent.KEYCODE_INSERT to "insert",
            KeyEvent.KEYCODE_SPACE to "space",
            KeyEvent.KEYCODE_DPAD_UP to "arrowUp",
            KeyEvent.KEYCODE_DPAD_DOWN to "arrowDown",
            KeyEvent.KEYCODE_DPAD_LEFT to "arrowLeft",
            KeyEvent.KEYCODE_DPAD_RIGHT to "arrowRight",
            KeyEvent.KEYCODE_MOVE_HOME to "home",
            KeyEvent.KEYCODE_MOVE_END to "end",
            KeyEvent.KEYCODE_PAGE_UP to "pageUp",
            KeyEvent.KEYCODE_PAGE_DOWN to "pageDown",
            KeyEvent.KEYCODE_F1 to "f1",
            KeyEvent.KEYCODE_F2 to "f2",
            KeyEvent.KEYCODE_F3 to "f3",
            KeyEvent.KEYCODE_F4 to "f4",
            KeyEvent.KEYCODE_F5 to "f5",
            KeyEvent.KEYCODE_F6 to "f6",
            KeyEvent.KEYCODE_F7 to "f7",
            KeyEvent.KEYCODE_F8 to "f8",
            KeyEvent.KEYCODE_F9 to "f9",
            KeyEvent.KEYCODE_F10 to "f10",
            KeyEvent.KEYCODE_F11 to "f11",
            KeyEvent.KEYCODE_F12 to "f12"
        )
    }
}
