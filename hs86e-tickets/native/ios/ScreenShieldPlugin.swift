import Foundation
import Capacitor
import UIKit

/**
 * RSG-ENG-SEC-006 Phase 3 — iOS screen shield.
 *
 * iOS has no public API to prevent screen captures, so instead this plugin
 * observes UIApplication.userDidTakeScreenshotNotification and emits
 * `screenshotDetected` to JS, which opens the persistent ScreenShieldAlert:
 * "Screenshots and recordings are strictly prohibited and invalid for
 * entry. You must present the live app at the gate."
 *
 * Drop-in location: Xcode App target (ios/App/App/) — local plugins that
 * conform to CAPBridgedPlugin are auto-registered by the bridge; pair with
 * ScreenShieldPlugin.m.
 */
@objc(ScreenShieldPlugin)
public class ScreenShieldPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ScreenShield"
    public let jsName = "ScreenShield"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "enableSecureFlag", returnType: CAPPluginReturnPromise)
    ]

    private var screenshotObserver: NSObjectProtocol?

    override public func load() {
        screenshotObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.userDidTakeScreenshotNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.notifyListeners("screenshotDetected", data: [
                "at": Date().timeIntervalSince1970
            ])
        }
    }

    /// Android-only concept (FLAG_SECURE). On iOS this resolves as a no-op so
    /// the shared JS bootstrap can call it unconditionally.
    @objc func enableSecureFlag(_ call: CAPPluginCall) {
        call.resolve()
    }

    deinit {
        if let observer = screenshotObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }
}
