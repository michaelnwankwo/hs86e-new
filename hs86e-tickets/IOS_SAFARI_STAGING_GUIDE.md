# HS86E Tickets — iOS Safari PWA Staging Test Guide (Netlify Preview)

Concise, step-by-step client testing on iPhone/iPad (iOS 15+, Safari). The app is already configured for iOS standalone mode (`apple-mobile-web-app-capable`, `black-translucent` status bar, `viewport-fit: cover`, 180×180 apple-touch-icon).

> Camera requires **HTTPS** and a **user gesture** in iOS Safari. Netlify previews are HTTPS, so camera works out of the box.

---

## 0. Before you start

- [ ] Deploy merged to Netlify (build succeeded — `tsc` + `next build` now pass).
- [ ] Environment variables set in Netlify (§7 of `ENV_AND_KEYS_MANUAL.md`).
- [ ] You have the **preview URL** (e.g. `https://<site>.netlify.app` or a deploy-preview URL).
- [ ] Two devices handy: **one iPhone (buyer)** and a **second device (door staff)** — or one phone + a laptop for the door.
- [ ] Staff PIN known (demo `8686`, or the production PIN).

---

## 1. Open the preview link on iOS Safari

1. On the iPhone, open **Safari**, go to the preview URL.
2. Confirm the home page loads, then tap into **Events** → a live/demo event → **Buy**.
3. Run a **demo or live purchase** (demo: pick a tier → Flutterwave → Pay → simulation mints passes).
4. Confirm the **QR pass renders** on the success screen and in **Wallet**.
5. Tap **Add to Home Screen** flow (step 2) before testing standalone behavior.

---

## 2. Add to Home Screen (A2HS)

1. In Safari, tap the **Share** button (square with up arrow).
2. Tap **Add to Home Screen**.
3. Keep the name **HS86E** → **Add**.
4. Launch the app from the home-screen icon.
5. ✅ Expect: full-screen standalone (no Safari chrome), dark status bar, and the app re-opens at `/events`.

> If the iOS install banner doesn't appear, that's expected — iOS doesn't support `beforeinstallprompt`; A2HS via Share is the supported path.

---

## 3. Wallet search test (buyer)

1. In the PWA: **My Tickets** (bottom nav) → use one field only:
   - **Ticket ID** (the `TKT-…-…-xxxxxx` or `ho…` value), or
   - **Order ID**, or
   - **Email**.
2. ✅ Expect the pass(es) to appear; tap a row to reveal the QR.
3. ✅ Negative test: enter a bogus ID/email → clean "No pass matched" message (no error dump).
4. ✅ Repeat lookups 60+ times quickly → you should hit a friendly 429 "Too many lookups" (rate limit), proving throttling works.

---

## 4. QR rotation (transfer) test

1. Open a pass (holder view) → **Transfer Ticket**.
2. Enter the guest's email + optional name → tick the confirmation → **Transfer**.
3. ✅ Expect:
   - Success banner; the sender's card now shows **holder = false**, no QR (their copy is void).
   - If Resend is configured, the guest gets an email; otherwise a **claim link** is shown to copy.
4. On the **guest** device: open the claim link (or search the guest email in Wallet).
5. ✅ Expect the guest sees the **new QR**; the buyer's old QR is gone.
6. Note the new Ticket ID has a random suffix (`TKT-…-hF6aLK`) — IDs are no longer sequential/guessable.

---

## 5. Door scanner authorization + camera

1. On the **door device**, open `/scan` (shortcut: **Door Scanner**).
2. **Staff PIN gate** appears → enter the PIN → **Unlock scanner**.
3. Safari shows the **camera permission** prompt → **Allow**. (First time only.)
4. ✅ Expect the back camera to open (`facingMode: environment`), gold scan frame visible.
5. Scan the **buyer's live QR** (from their screen or a screenshot):
   - ✅ **Valid** → green flash + "checked in" sound.
6. Scan the **old (pre-transfer) QR**:
   - ✅ **TRANSFERRED / VOID** red banner — original QR blocked at the door.
7. Scan the same valid QR **again**:
   - ✅ **TICKET ALREADY USED** amber warning.
8. Scan a random QR (e.g. a URL):
   - ✅ **RED invalid** + buzz + vibration.
9. **Wrong PIN test:** enter wrong PIN 5× → 429 "Too many PIN attempts" (15-min lockout).
10. **Lock-on-background test:** background the app (switch apps) → reopen → PIN gate shows again (session auto-locks).

---

## 6. Service worker / offline checks

1. **HTTPS check:** in Safari, confirm no mixed-content warnings; the SW registers at `/sw.js` (scope `/`).
2. **API non-caching:** open Settings → Safari → Advanced → Web Inspector (or use a Mac) → Network tab; confirm `/api/tickets`, `/api/scan/*` responses are **not** served from cache after reload.
3. **Offline shell:** after loading Events once, enable Airplane Mode → navigate to `/events` → the offline shell/fallback appears (no broken API state). Reconnect → app recovers.
4. **Door offline drill:** while online, open `/scan`, pull the **Manifest** (attendee list cached in IndexedDB). Kill Wi-Fi → scan a known ticket → **OFFLINE-VERIFIED** + queued. Reconnect → **Replay** syncs the queue.

---

## 7. Known iOS Safari quirks (expected, not bugs)

- **Camera requires a tap-first gesture** — the scanner only starts after the user unlocks + the page is interactive; it will not auto-open on page load.
- **Torch** (if shown) depends on device hardware; on some iPads it's absent — the button simply hides.
- **Add to Home Screen** is manual on iOS (Share → Add to Home Screen); no automatic install prompt.
- **QR screenshots** are valid QR codes — that's why the transfer/rotation + duplicate detection exist (they stop screenshot reuse).

---

## 8. Staging sign-off checklist

- [ ] Home / Events / Buy / Wallet flows work in standalone PWA.
- [ ] Wallet search by ticket ID, order ID, and email.
- [ ] Transfer rotates QR; old QR voided at the door.
- [ ] Staff PIN unlock + camera scan + green/amber/red verdicts.
- [ ] Rate limits observed (lookup + PIN attempts).
- [ ] No console errors; security headers present (CSP / X-Frame-Options / HSTS).
- [ ] Airplane-mode manifest scan + queue replay.
