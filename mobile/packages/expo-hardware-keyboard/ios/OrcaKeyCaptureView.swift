import ExpoModulesCore
import UIKit

// Keys explicitly claimed as `UIKeyCommand`s (see `keyCommands` below) so they
// resolve to this view before an ancestor responder can intercept them.
// `"\u{8}"` is the physical Backspace key's reported `characters` value
// (confirmed via this view's own captured events), not the forward-delete key.
private let HID_KEY_COMMAND_CODES: [String: Int] = [
    "\t": UIKeyboardHIDUsage.keyboardTab.rawValue,
    "\u{8}": UIKeyboardHIDUsage.keyboardDeleteOrBackspace.rawValue,
    UIKeyCommand.inputUpArrow: UIKeyboardHIDUsage.keyboardUpArrow.rawValue,
    UIKeyCommand.inputDownArrow: UIKeyboardHIDUsage.keyboardDownArrow.rawValue,
    UIKeyCommand.inputLeftArrow: UIKeyboardHIDUsage.keyboardLeftArrow.rawValue,
    UIKeyCommand.inputRightArrow: UIKeyboardHIDUsage.keyboardRightArrow.rawValue
]
private let HID_KEY_COMMAND_INPUTS: [String] = Array(HID_KEY_COMMAND_CODES.keys)

// Ctrl+<letter> shortcuts already meaningful at a shell prompt (interrupt, EOF,
// clear screen, suspend, reverse-search, line start/end, delete word, clear
// line before cursor) — the same set the existing on-screen accessory keys
// send (see TERMINAL_ACCESSORY_KEYS in terminal-accessory-keys.ts). Confirmed
// by testing that these need the same explicit-claim treatment as Tab/arrows:
// the base letter reaches `pressesBegan`, but its `ctrlKey` modifier flag reads
// false there — something upstream intercepts the Control modifier itself for
// these combos before it reaches this responder.
private let CTRL_KEY_COMMAND_CODES: [Character: Int] = [
    "c": UIKeyboardHIDUsage.keyboardC.rawValue,
    "d": UIKeyboardHIDUsage.keyboardD.rawValue,
    "l": UIKeyboardHIDUsage.keyboardL.rawValue,
    "z": UIKeyboardHIDUsage.keyboardZ.rawValue,
    "r": UIKeyboardHIDUsage.keyboardR.rawValue,
    "a": UIKeyboardHIDUsage.keyboardA.rawValue,
    "e": UIKeyboardHIDUsage.keyboardE.rawValue,
    "w": UIKeyboardHIDUsage.keyboardW.rawValue,
    "u": UIKeyboardHIDUsage.keyboardU.rawValue
]

// A focus-stealing view that captures raw hardware-keyboard presses and forwards
// them to JS. Unlike a UITextField, it reports modifier flags and special keys
// (arrows, Esc, Tab, function keys), which RN's TextInput.onKeyPress drops.
//
// When `active` is true it becomes first responder. Because it is not a text
// input, the iOS software keyboard does not appear while it holds focus — which
// is exactly right for an iPad with an attached hardware keyboard. JS only mounts
// this view in that scenario; the software-keyboard input paths are untouched.
//
// Why no key-repeat-while-held here: held Backspace/arrows are observed to
// re-invoke `handleSpecialKeyCommand` on their own at roughly a 150-200ms
// cadence — some hardware/OS-level repeat mechanism is already generating
// distinct presses without any special handling in this view. An explicit
// repeat timer was tried and removed: its behavior did not match expectations
// on-device, and stacking a second repeat source on top of whatever is
// already happening risked over-repeating rather than fixing anything.
// Known follow-up — revisit with an attached debugger before trying again.
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

    // Why: on iPadOS with a hardware keyboard, Tab/arrow navigation is driven by
    // the Focus Engine — a system separate from the first-responder chain, with
    // its own notion of the "focused item". Claiming first-responder status
    // alone does not make this view a Focus Engine target, so those keys were
    // being consumed by focus navigation before ever reaching `pressesBegan` or
    // `keyCommands` (confirmed: zero log output for Tab/Up/Down, even at the
    // `keyCommands` query). Opting into focus here and explicitly requesting it
    // alongside first-responder status routes those keys to us instead.
    override var canBecomeFocused: Bool {
        return isActive
    }

    // Why: UIKit resolves `UIKeyCommand`s from the whole responder chain before
    // falling back to `pressesBegan`, and several keys here are commonly claimed
    // by ancestor responders before we ever see them: Tab for field/accessibility
    // navigation, and Up/Down by UIScrollView's built-in hardware-keyboard
    // scrolling (automatic on any vertically-scrollable ancestor — this screen
    // has several). Left/Right are not claimed by scroll views the same way (no
    // horizontal scroll content to move), which is why only some special keys
    // were silently swallowed before reaching `pressesBegan` while others
    // worked. Claiming all of them explicitly on the first responder wins that
    // resolution before an ancestor can intercept it.
    override var keyCommands: [UIKeyCommand]? {
        guard isActive else { return nil }
        var commands = HID_KEY_COMMAND_INPUTS.map {
            UIKeyCommand(input: $0, modifierFlags: [], action: #selector(handleSpecialKeyCommand(_:)))
        }
        commands.append(
            UIKeyCommand(input: "\t", modifierFlags: .shift, action: #selector(handleShiftTabKeyCommand(_:)))
        )
        commands.append(
            contentsOf: CTRL_KEY_COMMAND_CODES.keys.map {
                UIKeyCommand(
                    input: String($0), modifierFlags: .control, action: #selector(handleCtrlKeyCommand(_:)))
            }
        )
        return commands
    }

    @objc private func handleSpecialKeyCommand(_ sender: UIKeyCommand) {
        guard let input = sender.input, let keyCode = HID_KEY_COMMAND_CODES[input] else { return }
        forwardSpecialKey(keyCode: keyCode, characters: input, shiftKey: false, ctrlKey: false)
    }

    @objc private func handleShiftTabKeyCommand(_ sender: UIKeyCommand) {
        forwardSpecialKey(
            keyCode: UIKeyboardHIDUsage.keyboardTab.rawValue, characters: "\t", shiftKey: true, ctrlKey: false)
    }

    @objc private func handleCtrlKeyCommand(_ sender: UIKeyCommand) {
        guard let input = sender.input, let letter = input.first,
            let keyCode = CTRL_KEY_COMMAND_CODES[letter]
        else { return }
        forwardSpecialKey(keyCode: keyCode, characters: input, shiftKey: false, ctrlKey: true)
    }

    private func forwardSpecialKey(keyCode: Int, characters: String, shiftKey: Bool, ctrlKey: Bool) {
        onKey([
            "keyCode": keyCode,
            "characters": characters,
            "charactersIgnoringModifiers": characters,
            "ctrlKey": ctrlKey,
            "altKey": false,
            "shiftKey": shiftKey,
            "metaKey": false,
            "key": ""
        ])
    }

    func setActive(_ value: Bool) {
        guard value != isActive else { return }
        isActive = value
        if value {
            // Defer to the next runloop tick so the view is in the window
            // hierarchy before we try to take first responder.
            DispatchQueue.main.async { [weak self] in
                self?.claimFirstResponderAndFocus()
            }
        } else {
            _ = resignFirstResponder()
        }
    }

    private func claimFirstResponderAndFocus() {
        guard isActive else { return }
        _ = becomeFirstResponder()
        setNeedsFocusUpdate()
        updateFocusIfNeeded()
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if isActive, window != nil {
            DispatchQueue.main.async { [weak self] in
                self?.claimFirstResponderAndFocus()
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
