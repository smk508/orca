import ExpoModulesCore
import UIKit

// A focus-stealing view that captures raw hardware-keyboard presses and forwards
// them to JS. Unlike a UITextField, it reports modifier flags and special keys
// (arrows, Esc, Tab, function keys), which RN's TextInput.onKeyPress drops.
//
// When `active` is true it becomes first responder. Because it is not a text
// input, the iOS software keyboard does not appear while it holds focus — which
// is exactly right for an iPad with an attached hardware keyboard. JS only mounts
// this view in that scenario; the software-keyboard input paths are untouched.
class OrcaKeyCaptureView: ExpoView {
    let onKey = EventDispatcher()

    private var isActive = false

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        isUserInteractionEnabled = true
    }

    override var canBecomeFirstResponder: Bool {
        return isActive
    }

    func setActive(_ value: Bool) {
        guard value != isActive else { return }
        isActive = value
        if value {
            // Defer to the next runloop tick so the view is in the window
            // hierarchy before we try to take first responder.
            DispatchQueue.main.async { [weak self] in
                guard let self = self, self.isActive else { return }
                _ = self.becomeFirstResponder()
            }
        } else {
            _ = resignFirstResponder()
        }
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if isActive, window != nil {
            DispatchQueue.main.async { [weak self] in
                guard let self = self, self.isActive else { return }
                _ = self.becomeFirstResponder()
            }
        }
    }

    override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        guard isActive else {
            super.pressesBegan(presses, with: event)
            return
        }
        var forwardedAny = false
        for press in presses {
            guard let key = press.key else { continue }
            forwardedAny = true
            let flags = key.modifierFlags
            onKey([
                "keyCode": key.keyCode.rawValue,
                "characters": key.characters,
                "charactersIgnoringModifiers": key.charactersIgnoringModifiers,
                "ctrlKey": flags.contains(.control),
                "altKey": flags.contains(.alternate),
                "shiftKey": flags.contains(.shift),
                "metaKey": flags.contains(.command),
                // Empty on iOS — JS resolves the key id from `keyCode`. Android
                // pre-resolves and sets this directly.
                "key": ""
            ])
        }
        // Swallow handled presses so UIKit does not emit a system beep. Anything
        // we could not read (no UIKey) falls through to default handling.
        if !forwardedAny {
            super.pressesBegan(presses, with: event)
        }
    }

    override func pressesEnded(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        if !isActive {
            super.pressesEnded(presses, with: event)
        }
    }

    override func pressesCancelled(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        if !isActive {
            super.pressesCancelled(presses, with: event)
        }
    }
}
