# GPSR Compliance Hub — Shopify App

EU product-safety (GPSR) compliance for Shopify merchants, with export to Amazon,
TikTok Shop, eBay, Etsy and Temu. Built on the Shopify Remix app stack.

## Stack
- Remix + Vite
- Shopify App Remix (embedded, session-token auth, App Bridge)
- Polaris (admin UI)
- Prisma + PostgreSQL
- Theme app extension (storefront safety panel)
- pdf-lib (GPSR passport PDF)

## What's inside
- `app/routes/` — admin screens + resource routes (exports, passport, AI, CSV import)
- `app/lib/` — compliance engine, exporters, pictograms, i18n, metafield writer, PDF passport
- `prisma/schema.prisma` — full data model (13 models; DPP-ready, multi-platform)
- `extensions/gpsr-storefront/` — theme app extension block

## Screens
Dashboard · Responsible Persons · Languages (31 UI langs) · Products (list + editor)
· Compliance Scanner · Templates · Channels & Export · Document Vault · Incident Log
· Supplier Requests · Settings · public Supplier form

## Feature coverage
All planned features across Tiers 1–3 + multi-platform are implemented:
RP (EU/UK/CH + provider directory), manufacturer, warnings (per market language),
identifiers, CE, pictograms (admin picker + storefront render), care, templates,
bulk apply, compliance engine, scanner, storefront injection (geo-gated),
Amazon/TikTok/eBay/Etsy/Temu export, CSV import, 10-year document vault,
incident log, supplier data requests, GPSR PDF passport, AI warning autofill,
EPR field, multi-language i18n, DPP-ready data model.

---

## Local setup

```bash
npm install
cp .env.example .env      # fill in values (see below)
npx prisma generate
npx prisma migrate dev    # creates tables
npm run dev               # Shopify CLI dev (requires Shopify CLI + Partner app)
```

### Environment variables (.env)
```
SHOPIFY_API_KEY=          # from Partner dashboard → your app
SHOPIFY_API_SECRET=       # from Partner dashboard
SHOPIFY_APP_URL=https://your-app.up.railway.app
SCOPES=read_products,write_products,read_metaobjects,write_metaobjects
DATABASE_URL=postgresql://user:pass@host:5432/gpsr
ANTHROPIC_API_KEY=        # optional — enables the AI warning autofill
```

## Deploy (Railway)
1. Create a Shopify Partner account + a new app → copy API key & secret.
2. Create a Railway project + PostgreSQL plugin → copy DATABASE_URL.
3. Set the env vars above in Railway.
4. `npm run setup` (runs `prisma generate && prisma migrate deploy`) on deploy.
5. Set `application_url` + redirect URLs in `shopify.app.toml` to the Railway URL.
6. `shopify app deploy` — pushes the app config + theme extension.
7. Install on your dev store, then submit for App Store review.

## Scopes note
`write_files` is NOT yet requested. Add it only when enabling direct file upload
to Shopify Files in the Document Vault (currently uses file links).

---

## Known TODOs (need a live store / accounts — cannot be done offline)
1. **Billing** — wire Shopify Billing API or managed pricing (tier UI is built in Settings).
2. **Direct file upload** — Document Vault currently stores file links; add Shopify
   Files staged-upload flow (needs `write_files` scope).
3. **Marketplace column specs** — before launch, verify Amazon & TikTok Shop export
   column names against their live seller docs; adjust in `app/lib/exporters.js`
   (architecture is final; only column names may shift).
4. **Supplier email** — app generates a secure link to copy/send; add an email
   service (Resend/SendGrid) for automated sending.
5. **Full UI translation** — 7 languages fully translated; 24 fall back to English
   until strings are added to `app/lib/i18n/dictionaries.js`.

## License
Proprietary — all rights reserved.
