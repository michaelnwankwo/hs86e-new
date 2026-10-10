# HS86E native shell — screen shield (RSG-ENG-SEC-006 Phase 3)

The web/PWA build needs none of this — `src/lib/native-shield.ts` degrades to
no-ops on web. These files harden the **Capacitor** shells.

## 1. Generate the shells (one time, on your machine)

```bash
cd hs86e-tickets
mkdir -p out                 # capacitor.config.ts webDir placeholder
npx cap add android
npx cap add ios              # macOS only
```

`capacitor.config.ts` points the shell at the deployed origin
(`server.url = https://hs86eapp.netlify.app`), so the SSR app, API routes,
payments, and scanner all keep working inside the native window. Adjust the
URL if the Netlify domain changes.

## 2. Android — FLAG_SECURE (blocks screenshots + recordings)

Copy into the generated project:

| Source                              | Destination                                              |
| ----------------------------------- | -------------------------------------------------------- |
| `native/android/ScreenShieldPlugin.kt` | `android/app/src/main/java/com/hs86e/tickets/`        |
| `native/android/MainActivity.kt`       | replaces `android/app/src/main/java/com/hs86e/tickets/MainActivity.kt` |

The plugin sets `WindowManager.LayoutParams.FLAG_SECURE` on the activity
window at app start (and on demand via `ScreenShield.enableSecureFlag()`),
so the OS refuses screenshots, screen recordings, and insecure casting for
the entire app.

## 3. iOS — screenshot detection alert

Add both files to the Xcode **App target** (drag into `ios/App/App/`):

- `native/ios/ScreenShieldPlugin.swift`
- `native/ios/ScreenShieldPlugin.m`

Local plugins conforming to `CAPBridgedPlugin` are auto-registered — no
AppDelegate change needed. On every
`UIApplication.userDidTakeScreenshotNotification`, the bridge emits
`screenshotDetected`; the app then opens the persistent alert:

> Screenshots and recordings are strictly prohibited and invalid for entry.
> You must present the live app at the gate.

(iOS has no public API to *prevent* captures — the persistent alert plus the
Phase 1/2 rotating QR is the mitigation: a captured image is stale and fails
the ±1 TOTP window at the gate.)

## 4. Haptics parity

`@capacitor/haptics` is wired in `src/lib/native-shield.ts`:
native shells get `Haptics.impact({ style: Light })`; web keeps the
feature-detected `navigator.vibrate(10)` fallback. Run `npx cap sync` after
any dependency change so the plugin is copied into both shells.

## 5. Verify

- Android: try a screenshot on the pass screen → OS blocks it ("Can't take
  screenshot due to security policy").
- iOS: take a screenshot on the pass screen → the gold alert modal appears.
- Web/PWA: no behaviour change (Phase 1 conceal layer still applies).
