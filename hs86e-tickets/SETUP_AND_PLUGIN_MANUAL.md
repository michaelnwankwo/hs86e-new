# HS86E Tickets — App Setup & Native Plugin Manual

**Document ID:** `RSG-HS86E-PIVOT-001`  
**Frontend:** Next.js 15.5 (App Router PWA; manuscript baseline was 14+)  
**Logo path (global):** `/logohs86e.jpg` → `public/logohs86e.jpg`

This manual is the Phase 4 deliverable. Follow it in VS Code on macOS, Windows, or Linux. Demo mode runs the full buyer + door loop without WordPress or live payment keys.

---

## 1. Environment setup (VS Code)

### 1.1 Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | 18.18+ (20 LTS recommended) | Next.js 14 runtime |
| npm | 10+ | Package install |
| Git | any | Optional version control |
| VS Code | latest | Editor |
| Google Chrome or Android Chrome | latest | PWA + `getUserMedia` camera |
| (Optional) Android Studio | latest | USB debugging / emulator for device QA |

Install Node from [https://nodejs.org](https://nodejs.org). Confirm:

```bash
node -v
npm -v
```

### 1.2 Open the project

If you received a zip:

```bash
# macOS / Linux
unzip hs86e-tickets.zip -d ~/Projects
cd ~/Projects/hs86e-tickets

# Windows PowerShell
Expand-Archive .\hs86e-tickets.zip -DestinationPath $HOME\Projects
cd $HOME\Projects\hs86e-tickets
```

If you already have the folder:

```bash
cd hs86e-tickets
code .
```

When VS Code prompts, install the recommended extensions (Tailwind CSS IntelliSense, ESLint, Prettier).

### 1.3 Install and run

```bash
cp .env.example .env.local
npm install
npm run dev
```

The dev server binds `0.0.0.0:3000` so phones on the same network can open `http://<your-lan-ip>:3000`.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Hot-reload development |
| `npm run build` | Production compile + Serwist service worker |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |

### 1.4 First-run smoke test (demo mode)

1. Home → **Lagos After Dark** → Regular × 1 → Flutterwave → Pay.  
2. Demo settlement mints a FooEvents-shaped ticket ID (`ho…`).  
3. Save PNG. Copy the ticket ID.  
4. Open `/scan`, PIN **`8686`**, allow camera (or keep the wallet QR on a second device).  
5. Green flash + ding = Flow A + Flow B closed.

---

## 2. Environment manifest

Copy `.env.example` → `.env.local`. **Never** prefix secrets with `NEXT_PUBLIC_`.

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEMO_MODE=true

WP_BASE_URL=https://api.hs86e.com
WC_CONSUMER_KEY=ck_xxx
WC_CONSUMER_SECRET=cs_xxx
WP_APP_USER=hs86e-scanner
WP_APP_PASSWORD="xxxx xxxx xxxx xxxx"

STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

FLW_SECRET_KEY=FLWSECK-xxx
FLW_WEBHOOK_HASH=xxx
NEXT_PUBLIC_FLW_PUBLIC_KEY=FLWPUBK-xxx

SCAN_STAFF_PIN=8686
SCAN_STAFF_PIN_HASH=
SCAN_JWT_SECRET=long_random_string_at_least_32_chars
SCAN_DEFAULT_EVENT_ID=
```

| Variable | Used by | Notes |
| --- | --- | --- |
| `DEMO_MODE` | catalog, checkout, scanner | `true` forces the in-process ledger even if WP keys exist |
| `WP_BASE_URL` | `services/wp/client.ts` | No trailing slash |
| `WC_CONSUMER_*` | WooCommerce REST basic auth | Read/Write, HTTPS only |
| `WP_APP_*` | FooEvents Application Password | Dedicated `hs86e-scanner` user |
| `STRIPE_*` | Checkout Session + webhook signature | Webhook is the only mint trigger |
| `FLW_*` | Standard payment link + `verif-hash` | Server re-verifies `/v3/transactions/{id}/verify` |
| `SCAN_STAFF_PIN_HASH` | `/api/scan/auth` | bcrypt. Prefer this in production |
| `SCAN_JWT_SECRET` | staff httpOnly cookie | Rotate the playbook default. Never ship `hs86e_ancestral_logic_secret_key` |

Generate a production PIN hash:

```bash
node -e "console.log(require('bcryptjs').hashSync('YOUR_PIN', 10))"
```

Put the result in `SCAN_STAFF_PIN_HASH` and **remove** `SCAN_STAFF_PIN`.

When `DEMO_MODE` is unset/`false` **and** WooCommerce keys are present, the app talks only to WordPress. The browser never sees those credentials.

---

## 3. Plugin configuration guide

### 3.0 Connect the PWA to your existing tickets (do this first)

The storefront lists **WooCommerce products**. The wallet and door scanner read **FooEvents tickets** minted on those orders. The browser never calls WordPress — only Next.js `/api/*` does.

1. wp-admin → **Settings → Permalinks → Post name** → Save.  
2. **WooCommerce → Settings → Advanced → REST API → Add key**  
   - Description: `HS86E PWA`  
   - Permissions: **Read/Write**  
   - Copy `ck_…` and `cs_…`  
3. Put this in `hs86e-tickets/.env.local` (no trailing slash on the URL):

```bash
DEMO_MODE=false
WP_BASE_URL=https://your-site.com
WC_CONSUMER_KEY=ck_xxxxxxxx
WC_CONSUMER_SECRET=cs_xxxxxxxx
WC_CATEGORY_SLUG=event-tickets
```

4. Restart `npm run dev`. Open **/connect** and tap **Test connection**.  
5. Home should now list the same published ticket products as wp-admin → Products.  
6. For minted tickets + door scan, add a WordPress **Application Password** on user `hs86e-scanner` → `WP_APP_USER` / `WP_APP_PASSWORD`.

If products do not appear: the product must be **Published**, FooEvents enabled (or in category `event-tickets`). Or set `WC_INCLUDE_ALL_PRODUCTS=true`.

### 3.1 WordPress / WooCommerce / FooEvents (Deployable B)

1. Provision a managed host with SSL at `api.hs86e.com`.  
2. Install **only** WooCommerce + FooEvents. Do **not** install BuddyBoss.  
3. Create the flagship product, category `event-tickets`, variations **Regular / VIP / Table**, stock = capacity.  
4. FooEvents: ticket email ON, QR display ON, attendee capture ON.  
5. WooCommerce → Settings → Advanced → REST API → Add key (Read/Write) → paste into `.env.local`.  
6. Users → Add `hs86e-scanner` (Shop Manager or custom `door_staff`) → Application Passwords → paste into `WP_APP_PASSWORD`.  
7. Discover the live contract:

```bash
curl -s https://api.hs86e.com/wp-json/ | python3 -m json.tool | grep -i fooevents
```

Confirm ticket-fetch and check-in routes on **your** plugin version. If a write endpoint is missing, drop the mu-plugin below into `wp-content/mu-plugins/hs86e-checkin.php`.

```php
<?php
/**
 * Plugin Name: HS86E Check-in Surface
 * Description: Contingency validate + checkin against FooEvents postmeta.
 */
add_action('rest_api_init', function () {
  register_rest_route('hs86e/v1', '/checkin', [
    'methods'  => 'POST',
    'permission_callback' => function () {
      return current_user_can('manage_woocommerce') || current_user_can('edit_shop_orders');
    },
    'callback' => function (WP_REST_Request $req) {
      $ticket_id = sanitize_text_field($req->get_param('ticket_id'));
      $posts = get_posts([
        'post_type'  => 'event_magic_tickets',
        'meta_key'   => 'WooCommerceEventsTicketID',
        'meta_value' => $ticket_id,
        'numberposts'=> 1,
      ]);
      if (!$posts) {
        return new WP_REST_Response(['verdict' => 'invalid', 'message' => 'not-found'], 200);
      }
      $id = $posts[0]->ID;
      $status = get_post_meta($id, 'WooCommerceEventsStatus', true);
      if (stripos($status, 'Cancel') !== false) {
        return ['verdict' => 'canceled', 'message' => 'canceled', 'ticket' => hs86e_ticket_payload($id)];
      }
      if (stripos($status, 'Checked') !== false) {
        return ['verdict' => 'duplicate', 'message' => 'already-checked-in', 'ticket' => hs86e_ticket_payload($id)];
      }
      update_post_meta($id, 'WooCommerceEventsStatus', 'Checked In');
      return ['verdict' => 'valid', 'success' => true, 'ticket' => hs86e_ticket_payload($id)];
    },
  ]);
});

function hs86e_ticket_payload($id) {
  return [
    'WooCommerceEventsTicketID' => get_post_meta($id, 'WooCommerceEventsTicketID', true),
    'WooCommerceEventsStatus' => get_post_meta($id, 'WooCommerceEventsStatus', true),
    'WooCommerceEventsAttendeeName' => get_post_meta($id, 'WooCommerceEventsAttendeeName', true),
    'WooCommerceEventsAttendeeEmail' => get_post_meta($id, 'WooCommerceEventsAttendeeEmail', true),
    'WooCommerceEventsAttendeeTelephone' => get_post_meta($id, 'WooCommerceEventsAttendeeTelephone', true),
    'WooCommerceEventsProductID' => get_post_meta($id, 'WooCommerceEventsProductID', true),
    'WooCommerceEventsOrderID' => get_post_meta($id, 'WooCommerceEventsOrderID', true),
  ];
}
```

Place a **manual** test order in wp-admin and confirm the ticket post + email before connecting live keys.

### 3.2 Stripe

1. Dashboard → Developers → API keys → `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.  
2. Developers → Webhooks → Add endpoint:  
   `https://<your-domain>/api/webhooks/stripe`  
   Event: `checkout.session.completed` (and `checkout.session.async_payment_succeeded` if you enable delayed methods).  
3. Signing secret → `STRIPE_WEBHOOK_SECRET`.  
4. Local forwarding:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

The handler verifies the signature, stores the event ID on the WooCommerce order (`_hs86e_processed_events`) for idempotency, then `PUT /wp-json/wc/v3/orders/{id}` → `status: completed`. FooEvents mints on that transition. **Never mint on `success_url`.**

### 3.3 Flutterwave (Lagos primary)

1. Settings → API → `FLW_SECRET_KEY` / public key.  
2. Settings → Webhooks → URL `https://<your-domain>/api/webhooks/flutterwave`.  
3. Secret hash → `FLW_WEBHOOK_HASH` (compared to the `verif-hash` header).  
4. The route **re-verifies** `GET https://api.flutterwave.com/v3/transactions/{id}/verify` and rejects amount mismatches.

### 3.4 PWA / Serwist (`@serwist/next`)

| File | Role |
| --- | --- |
| `public/manifest.json` | Installable app, theme `#043927`, background `#0B0E14` |
| `src/app/sw.ts` | Precache + offline fallback `/offline` |
| `next.config.mjs` | `withSerwist` — **disabled in `development`** |
| `public/icons/*` | 96 / 192 / 512 / maskable / apple-touch / splash |

Production build writes `public/sw.js`. Add to Home Screen from Chrome (Android) or Share → Add to Home Screen (iOS Safari). Camera + vibration require a **secure context** (HTTPS or `localhost`).

### 3.5 Camera scanner (`html5-qrcode`)

No native Gradle plugin is required for the PWA. The browser permission is requested at first scan.

| Setting | Value |
| --- | --- |
| Facing | `{ facingMode: "environment" }` |
| FPS | 10 |
| qrbox | 250 |
| Debounce | 1500 ms |
| Torch | `applyVideoConstraints({ advanced: [{ torch }] })` when the track supports it |

`next.config.mjs` already publishes:

```
Permissions-Policy: camera=(self)
```

If you wrap the PWA in **Capacitor** for an APK, add the Android permission (see §5.3).

### 3.6 QR rendering (`qrcode.react`)

Wallet tickets render `<QRCodeSVG value={ticketId} size={280} level="H" />`. The payload is **only** the FooEvents Ticket ID string — no JSON, no PII, no URL.

### 3.7 React Query / Zod / Axios / Jose / bcrypt

| Package | Configuration |
| --- | --- |
| `@tanstack/react-query` | `Providers` — retry ×2, wallet poll 2s × 20 |
| `zod` | checkout body, PIN, scan payload, env |
| `axios` | WC basic auth + FooEvents app-password, retry ×2 |
| `jose` | HS256 staff JWT, 8h, httpOnly cookie `hs86e_staff` |
| `bcryptjs` | PIN hash compare |
| `lucide-react` | CheckCircle2, XCircle, WifiOff, ScanLine, … |
| `flutterwave-react-v3` | listed for the Lagos stack; checkout uses the **Standard hosted link** (zero PCI) |
| `@stripe/stripe-js` | present for a future client redirect helper; Sessions are created server-side |

### 3.8 Logo mapping

| Surface | Reference |
| --- | --- |
| Asset on disk | `public/logohs86e.jpg` |
| Constant | `src/lib/constants.ts` → `LOGO_PATH = "/logohs86e.jpg"` |
| Component | `src/components/branding/Logo.tsx` |
| Splash | `SplashScreen` |
| Header / bottom-adjacent brand | `AppHeader` |
| Hero | `app/page.tsx` |
| Event detail, wallet, scanner, checkout | each screen centers `<Logo />` |
| Flutterwave checkout branding | `customizations.logo = ${APP_URL}/logohs86e.jpg` |
| Downloaded ticket PNG | canvas stamps the same file |

Replace the file **in place**. Do not rename it.

---

## 4. Local build & VS Code zip packaging

### 4.1 Production build

```bash
cd hs86e-tickets
npm run build
npm start
```

Confirm `GET /api/health` returns `{ ok: true, demo: true|false, ... }`.

### 4.2 Zip the project for handoff

From the **parent** folder, exclude `node_modules` and `.next` (rebuilt on the receiving machine):

```bash
# macOS / Linux
cd /path/to/parent
zip -r hs86e-tickets.zip hs86e-tickets \
  -x "hs86e-tickets/node_modules/*" \
  -x "hs86e-tickets/.next/*" \
  -x "hs86e-tickets/.data/*" \
  -x "hs86e-tickets/.env.local"

# Windows PowerShell
Compress-Archive -Path hs86e-tickets -DestinationPath hs86e-tickets.zip
```

On the receiving laptop:

```bash
unzip hs86e-tickets.zip
cd hs86e-tickets
cp .env.example .env.local
code .
npm install
npm run dev
```

Do **not** zip `.env.local`. Hand secrets through a password manager.

### 4.3 Deploy (Vercel)

```bash
npx vercel
```

Set every non-`NEXT_PUBLIC_` variable in the Vercel project settings. Point `NEXT_PUBLIC_APP_URL` at the production domain. Register the live webhook URLs with Stripe and Flutterwave.

---

## 5. Android assembly & device testing

This MVP is a **PWA** (manuscript directive: zero App Store gatekeeping). Android QA is Chrome + optional emulator. An optional Capacitor APK wrap is documented for stores later.

### 5.1 Enable USB debugging

1. Android device → Settings → About phone → tap **Build number** 7 times.  
2. Settings → Developer options → enable **USB debugging**.  
3. Connect USB → allow the computer’s RSA fingerprint.  
4. On the computer (Android platform-tools):

```bash
adb devices
```

The device must show `device`, not `unauthorized`.

### 5.2 Install / run on a device or emulator

**Emulator**

1. Android Studio → Device Manager → Create Device (Pixel 7, API 34).  
2. Cold boot. Open Chrome.  
3. If the Next.js server is on the host:

```bash
adb reverse tcp:3000 tcp:3000
```

Then visit `http://localhost:3000` in the emulator’s Chrome.

**Physical device on the same Wi-Fi**

```bash
# find your LAN IP
# macOS
ipconfig getifaddr en0
# Linux
hostname -I
```

Visit `http://192.168.x.x:3000`. Chrome will warn about HTTP; camera may be blocked on non-secure origins. For camera QA either:

- use `adb reverse` + `http://localhost:3000`, or  
- deploy to Vercel (HTTPS) and open the production URL.

**Add to Home Screen**

Chrome menu → **Add to Home Screen** / **Install app**. Launch from the HS86E icon. Confirm splash (`#0B0E14`) and theme (`#043927`).

**Door scanner on device**

1. Grant camera when prompted.  
2. Point at a wallet QR from a second phone.  
3. Enable **Airplane mode** → refresh manifest must have been pulled first → scan still returns GREEN / `OFFLINE-VERIFIED` and the header badge shows `N pending sync`.  
4. Disable airplane mode → badge clears as the FIFO queue replays.

There is no `flutter run` or `npx react-native run-android` in this repository. The equivalent commands are:

```bash
npm run dev          # development, LAN / adb reverse
npm run build && npm start
```

### 5.3 Optional Capacitor APK (not required for launch)

```bash
npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/android
npx cap init "HS86E" com.hs86e.tickets --web-dir=out
```

Next.js API routes **cannot** ship inside a static WebView. Point Capacitor at the **deployed** HTTPS origin (`server.url` in `capacitor.config.ts`) or keep the PWA.

`android/app/src/main/AndroidManifest.xml` must include:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

Then:

```bash
npx cap add android
npx cap sync
npx cap open android
```

Build → Run on the USB device from Android Studio. This is post-MVP packaging, not a substitute for the Vercel PWA.

### 5.4 Physical scan matrix (Phase 5 dress rehearsal)

| Case | Expected |
| --- | --- |
| Fresh ticket | GREEN + ding |
| Screenshot reuse | AMBER + warn + prior check-in time |
| Other event’s QR | RED + buzz + vibrate |
| Refunded / canceled | RED / CANCELED |
| Random internet QR | RED |
| Airplane mode after manifest pull | OFFLINE-VERIFIED, queued |
| Reconnect | Idempotent replay, badge → 0 |

Target: five or more guests per minute, loop under two seconds.

---

## 6. Operations runbook (door night)

| Task | Where |
| --- | --- |
| Resend ticket email | wp-admin → FooEvents ticket post → resend |
| Refund / void | WooCommerce order → Refund. Status becomes canceled; scanner returns RED |
| Manual check-in | FooEvents check-in UI or the mu-plugin |
| Wi-Fi down drill | Open `/scan` on venue Wi-Fi first (pulls IndexedDB manifest), then kill the AP |
| Rotate PIN | New bcrypt hash → redeploy → staff re-login |
| Rate limit | `/api/scan/auth` allows 5 attempts / 15 minutes / IP |

---

## 7. Brand tokens (locked)

| Token | Hex | Usage |
| --- | --- | --- |
| Surface | `#0B0E14` | App background |
| Raised | `#161B22` | Cards |
| Ink | `#F8FAFC` | Body text |
| Primary emerald | `#043927` | Primary CTAs, valid scan, purchase confirm |
| Secondary gold | `#DFB260` | Highlights, icons, 20% micro-borders |
| Metallic gold | `#D4AF37` | Logo-matching metal |
| Champagne | `#F5D68D` | Focus rings, selection glow |
| Logo glow | `rgba(223,178,96,0.15)` | Radial backlight behind every logo |

---

## 8. Trust boundary (do not violate)

The browser may call only relative `/api/*` routes and may see `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. WooCommerce keys, FooEvents application passwords, Stripe/Flutterwave secrets, the staff PIN hash, and `SCAN_JWT_SECRET` live exclusively in the Next.js server environment.
