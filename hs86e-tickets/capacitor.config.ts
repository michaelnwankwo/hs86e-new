import type { CapacitorConfig } from "@capacitor/cli";

/**
 * CapacitorJS shell for the HS86E native iOS/Android apps.
 *
 * The Next.js PWA is server-rendered (SSR + API routes), so the native shell
 * loads the DEPLOYED HTTPS app. Two options when scaffolding the shell:
 *
 *  1. Live origin (recommended, zero extra build steps):
 *       server: { url: "https://<your-netlify-site>.netlify.app", cleartext: false }
 *     API routes / payments / scanner all keep working against that origin.
 *
 *  2. Bundled static export (only if you switch the web app to
 *     `output: "export"` — NOT done here, as it would drop the API routes):
 *       webDir: "out"
 *
 * Native home-screen widgets share the active-ticket store through the App
 * Group / SharedPreferences named `group.com.hs86e.tickets` (see
 * src/lib/widget-storage.ts + src/hooks/useWidgetSync.ts). In Xcode, add the
 * same group to the app AND the widget extension under
 * Signing & Capabilities → App Groups.
 */
const config: CapacitorConfig = {
  appId: "com.hs86e.tickets",
  appName: "HS86E",
  webDir: "out",
  // Uncomment and set your deployed HTTPS origin when running `npx cap sync`:
  // server: { url: "https://hs86e.netlify.app", cleartext: false },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
