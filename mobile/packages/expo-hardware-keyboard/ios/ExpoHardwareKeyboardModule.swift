import ExpoModulesCore
import GameController

public class ExpoHardwareKeyboardModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ExpoHardwareKeyboard")

        // Whether a physical keyboard is currently attached. JS uses this to
        // decide whether to mount the capture view at all.
        Function("isHardwareKeyboardConnected") { () -> Bool in
            if #available(iOS 14.0, *) {
                return GCKeyboard.coalesced != nil
            }
            // Pre-iOS 14 has no reliable query. Reporting "connected" here would
            // wrongly suppress the software-keyboard fallback for every user on an
            // unsupported OS version, keyboard or not — false is the safe default.
            return false
        }

        View(OrcaKeyCaptureView.self) {
            Events("onKey")

            Prop("active") { (view: OrcaKeyCaptureView, active: Bool) in
                view.setActive(active)
            }
        }
    }
}
