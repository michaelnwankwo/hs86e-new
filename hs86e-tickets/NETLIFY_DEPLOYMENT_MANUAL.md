# HS86E Tickets — Netlify Deployment Manual (Executive Demo)

**Target:** production-grade deploy of the fixed build to Netlify for client/executive review.
**App:** Next.js 15 (App Router) · PWA · Gold/Slate design system · ticketing + wallet + door scanner.

---

## 1. Incident Post-Mortem — what caused the Server-Side Exception (Digest: 2211764824)

### Root cause
`src/lib/env.ts` validated environment variables with zod and **hard-threw** on the
*only required secret in the entire schema*:

```ts
SCAN_JWT_SECRET: z.string().min(24, "SCAN_JWT_SECRET must be at least 24 characters")
```

On the Netlify deploy, `SCAN_JWT_SECRET` was unset (or under 24 characters). Every request
to `/events` ran this chain inside a Server Component, **outside any try/catch**:

```
/events/page.tsx → listEventsResult() → getEnv() → throw Error("Invalid environment: SCAN_JWT_SECRET…")
```

Because it is a *production* build, Next.js intentionally hides the real message from the
browser and prints only the masked error with a **digest** — exactly the screen that was seen:

```
⨯ Error: Invalid environment: SCAN_JWT_SECRET: Required
    at … (.next/server/app/events/page.js…)   { digest: '3582671742' }
⨯ [Error: An error occurred in the Server Components render. The specific message is omitted
   in production builds … A digest property is included …]
```

*(Digest numbers — including `2211764824` — are hashes of the error text; they differ per build/deployment. Verified by reproducing the identical crash signature locally.)*

### Why the build "passed" but the site crashed
`/events`, `/scan`, `/tickets` are `force-dynamic`, so `next build` never executed the data
fetch — it only failed at **request time**. Build success therefore gave false confidence.

### Blast radius of the same bug
| Route | Chain | Symptom |
|---|---|---|
| `/` | redirect → `/events` | whole site entry crashed |
| `/events` | `listEventsResult()` → `getEnv()` | digest error page |
| `/events/[slug]` | `getEvent()` → `getEnv()` | digest error page |
| `/scan` | `listEvents()` + `isDemoMode()` → `getEnv()` | digest error page |
| `/api/events` | `listEventsResult()` | HTTP 500 (no JSON) |
| `/api/checkout`, `/api/health`, others | `getEnv()` / helpers | HTTP 500 |

### What was changed (all strictly backend/resilience — zero visual changes)
1. **`src/lib/env.ts`** — `SCAN_JWT_SECRET` is now optional-at-schema (min 24 chars *when set*),
   consistent with the other secrets. Added `getEnvSafe()` (never throws — returns a degraded
   "unconfigured" env with one server-side warning), `getEnvIssues()` (health/banner text) and
   `hasScanSecret()`. All capability helpers (`hasWooCommerce`, `isDemoMode`, `hasStripe`,
   `hasFlutterwave`, `appUrl`) are now fail-soft.
2. **`src/lib/auth.ts`** — the scan secret is enforced at the only place that needs it
   (`requireScanSecret()` at JWT signing/verification). No secret ⇒ scanner auth fails closed
   (no sessions issued/verified) instead of crashing pages.
3. **`src/lib/ticket-token.ts`** — QR HMAC keys tolerate a missing `SCAN_JWT_SECRET`; minting
   with *no* key at all throws a clear message caught by API handlers (fail-closed).
4. **`src/services/catalog.ts`** — `listEventsResult()` and `getEvent()` are now **total
   functions**: they never reject. Worst case ⇒ empty event list plus a graceful branded notice
   (rendered by the existing `CatalogBanner`), or demo events when `DEMO_MODE=true`.
5. **Page hardening** — `/events`, `/events/[slug]`, `/scan` wrap their data calls in try/catch
   fallbacks (empty catalog / branded not-found).
6. **New branded error boundaries** — `src/app/error.tsx` (Gold/Slate card, "Try again" +
   back-to-Events, shows the digest for support) and `src/app/global-error.tsx` (inline-styled
   root fallback). Any future exception renders the brand, not the raw digest screen.
7. **API envelopes** — `/api/events`, `/api/checkout`, `/api/tickets`, `/api/tickets/transfer`,
   `/api/demo/complete`, `/api/scan/auth`, `/api/scan/validate`, `/api/scan/attendees`,
   both payment webhooks, `/api/widgets/*`, `/api/health` now return structured JSON on any
   unexpected failure (never an HTML crash page). `/api/health` exposes `configOk` /
   `configIssues` / `scanAuth` for one-glance environment verification.
8. **Serverless fs resilience** — the ticket ledger and demo store
   (`.data/*.json` via `writeFileSync`) now keep an in-memory mirror and warn-and-continue if
   the filesystem is read-only, as on Netlify Functions. Ticket purchase/transfer/scan flows
   can no longer be killed by `EROFS`.

### Local verification (all green)
- `npm run typecheck` → clean (exit 0)
- `npm run build` (run with **zero env vars**, simulating the broken Netlify deploy) →
  ✓ compiled, 16/16 pages generated, exit 0
- Runtime smoke, **no env vars**: `/` `/events` `/tickets` `/wallet` `/scan` `/offline`
  `/checkout/simulate` `/api/events` `/api/health` `/manifest.json` `/sw.js` → all HTTP 200,
  **zero digest errors, zero server-log exceptions** (previously the same run produced
  digest crashes on 4 routes). `/api/events` returns
  `{"source":"wordpress","count":0,"error":"WP_BASE_URL is not set","events":[]}` instead of 500.
- Runtime smoke, **demo env** (`DEMO_MODE=true`): both demo events SSR on `/events`;
  full door loop verified — PIN login → demo checkout (2× VIP, ₦150,000) → simulated payment →
  2 signed passes issued → wallet lookup → scan_1 `valid` → scan_2 `duplicate
  (TICKET ALREADY USED)` → forged signature `invalid` → manifest shows the check-in.

---

## 2. GitHub sync — push the fixed code to `main`

From the repository root (the folder that contains `hs86e-tickets/`):

```bash
git add -A
git status                                   # review the staged file list
git commit -m "fix: eliminate server-side exception on /events (env fail-soft + error boundaries)

- make SCAN_JWT_SECRET optional at schema level; enforce it at the scanner auth boundary
- add never-throwing getEnvSafe(); fail-soft env capability helpers
- catalog list/detail are total functions (graceful branded fallback, demo-aware)
- wrap /events, /events/[slug], /scan data calls in try/catch
- add branded Gold/Slate error.tsx + global-error.tsx boundaries
- JSON error envelopes for all API routes; /api/health exposes configOk/scanAuth
- resilient ledger/demo-store persistence on read-only serverless filesystems
- add netlify.toml (base=hs86e-tickets, Next.js runtime)"
git push origin main
```

> If you pull first (`git pull --rebase origin main`) and hit conflicts, keep both the
> incoming changes and these fixes in `env.ts`/`catalog.ts` — they don't overlap visually.

---

## 3. Netlify site setup

### 3.1 Create / link the site
1. Netlify dashboard → **Add new site → Import an existing project → GitHub** → pick `michaelnwankwo/hs86e-new`.
2. The committed **`netlify.toml`** (repo root) auto-fills the settings. Verify they match:

| Setting | Value |
|---|---|
| Base directory | `hs86e-tickets` |
| Build command | `npm run build` |
| Publish directory | `.next` (the Next.js Runtime serves it; do **not** hand-edit this) |
| Functions directory | *(managed by the Next.js Runtime)* |
| Node version | `20` (from netlify.toml) |
| Plugin | `@netlify/plugin-nextjs` (auto-installed; pinned in netlify.toml) |

> If you prefer the UI over netlify.toml: Site settings → Build & deploy → set **Base directory**
> to `hs86e-tickets`, **Build command** `npm run build`, **Publish directory** `.next`.

### 3.2 Environment variables
Site settings → **Environment variables** → add:

| Key | Required? | Value / notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | ✅ | `https://<your-site>.netlify.app` — canonical URL used for checkout redirects, wallet links |
| `DEMO_MODE` | ✅ for the demo | `true` → shows the two built-in sample events and the simulated payment loop without any WordPress backend |
| `SCAN_JWT_SECRET` | ✅ for door scanner | 24+ chars. Generate: `openssl rand -base64 32`. *(Without it the app no longer crashes — the PIN gate returns a clear "not configured" notice.)* |
| `TICKET_HMAC_SECRET` | recommended | Different 24+ char secret for QR signing. Falls back to `SCAN_JWT_SECRET` when unset (old passes stay valid) |
| `SCAN_STAFF_PIN` | ✅ (demo) | `8686` for the demo. Production: set `SCAN_STAFF_PIN_HASH` (bcrypt) instead and remove the plaintext PIN. Hash: `node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" <PIN>` |
| `REVALIDATE_SECRET` | when using the WP webhook | 24+ chars. Enables `POST /api/revalidate` for instant catalog refresh after publishing in WordPress (fails closed until set) |

**Going live with the real catalog later** (not needed for the demo, graceful without them):
`WP_BASE_URL`, `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET`, `WP_APP_USER`, `WP_APP_PASSWORD`,
optional `WC_CATEGORY_SLUG` / `WC_INCLUDE_ALL_PRODUCTS`;
payments: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`FLW_SECRET_KEY`, `FLW_WEBHOOK_HASH`, `NEXT_PUBLIC_FLW_PUBLIC_KEY`;
optional email: `RESEND_API_KEY`, `RESEND_FROM`.
Set `DEMO_MODE=false` once these are in. **Never prefix a secret with `NEXT_PUBLIC_`.**

### 3.3 Deploy
```bash
# either: push to main triggers a build, or
netlify deploy --build --prod        # with the Netlify CLI linked to the site
```
First build takes ~2–4 min. The deploy log must show `✓ Compiled successfully` and
`Generating static pages (16/16)`.

---

## 4. Post-deploy verification (5 minutes, any browser)

1. Open `https://<site>.netlify.app` → redirects to **Events** with the two demo events on the
   branded cards. **No** error/digest screen.
2. `https://<site>.netlify.app/api/health` → expect
   `"configOk":true, "configIssues":null, "demo":true, "scanAuth":true`.
3. **Executive demo loop:**
   - Events → *Lagos After Dark* → Buy → VIP ×2 → name/email/phone → Flutterwave → simulated
     payment → **two QR passes minted** on the success screen.
   - **My Tickets** (bottom nav) → find by email → tap a pass → QR appears.
   - **Scan** → enter PIN `8686` → pick *Lagos After Dark* → camera → scan the QR →
     green **valid** flash; rescan → amber **TICKET ALREADY USED**; attendees list shows the check-in.
4. Refresh /events, reopen the browser tab — everything reloads (no stale crash).

## 5. iOS Safari PWA checklist (before sharing with stakeholders)

Full step-by-step in **`IOS_SAFARI_STAGING_GUIDE.md`** (already in this repo). Gate items:

- [ ] HTTPS preview loads on iPhone Safari; events render; demo purchase → QR pass shows.
- [ ] **Add to Home Screen** (Share → Add to Home Screen → HS86E) → launches full-screen
      standalone, dark status bar, re-opens at `/events`.
- [ ] In the home-screen app: Wallet lookup by email works; transfer flow voids the sender's QR
      and issues a claim link for the guest.
- [ ] Door device: `/scan` → PIN gate → **camera permission prompt** (HTTPS + user gesture are
      required on iOS — both satisfied by Netlify + the in-app scan button) → live decode works.
- [ ] Airplane-mode spot-check: cached shell + offline page render (service worker `/sw.js`).
- [ ] Only then send the link to stakeholders.

## 6. Troubleshooting & rollback

| Symptom | Check |
|---|---|
| Events page empty + gold notice | `/api/health` → `configIssues`; set the §3.2 vars and redeploy |
| PIN login says "not configured" | `SCAN_JWT_SECRET` missing/under 24 chars |
| Old Netlify build still broken | Netlify auto-serves the last good deploy — redeploys are atomic; bad deploys never replace a good one |
| Instant rollback | Netlify → Deploys → previous deploy → **Publish deploy** |

**Crash-safety net:** even with *no* environment variables at all, every page now renders and
every API responds with JSON — the digest crash class is structurally eliminated
(env access is fail-soft, catalog functions never reject, branded error boundaries catch the rest).
