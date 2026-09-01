# HS86E Tickets — React Fast-Track MVP

**Document:** `RSG-HS86E-PIVOT-001`  
**Stack:** Next.js 14 App Router PWA · WooCommerce / FooEvents proxy · Stripe · Flutterwave  
**Directive:** *Take payments, issue tickets, verify QR at the door.*

This repository is the complete production codebase for Deployable A (the Next.js PWA).  
WordPress remains Deployable B — the headless order & ticket engine.

## Quick start

```bash
cd hs86e-tickets
cp .env.example .env.local   # DEMO_MODE=true is already set for local
npm install
npm run dev
```

Open `http://localhost:3000`.

- **Buyer flow:** Events → Buy → demo payment → QR wallet  
- **Door flow:** `/scan` → PIN `8686` → camera (or paste a ticket ID after a demo purchase)  
- **Logo:** `public/logohs86e.jpg` mapped globally (`src/lib/constants.ts` → `LOGO_PATH`)

Full environment, plugin, Android, and zip-export instructions live in:

**[SETUP_AND_PLUGIN_MANUAL.md](./SETUP_AND_PLUGIN_MANUAL.md)**
