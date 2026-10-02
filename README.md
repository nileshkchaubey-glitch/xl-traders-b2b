# XL Traders B2B

B2B packaging storefront and catalogue/PIM for XL Traders, Surat. Production:
https://xl-traders-b2b.pages.dev. Repository:
https://github.com/nileshkchaubey-glitch/xl-traders-b2b.

Read [AGENTS](AGENTS.md) and [CLAUDE](CLAUDE.md) before changes. Implementation
status comes from code and verified deployments, not old plans.

## Local development and checks

Use Node from `.nvmrc` (currently 20; validated locally with 20.20.2) and npm.
Copy the public Supabase URL/publishable key into ignored local environment:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Never put service-role/private AI
credentials in VITE variables or commit passwords. There is no browser admin
email allowlist; admin privileges come from the database profile flag.

```sh
npm ci
npm run dev
npm run ci
```

Dev serves port 5000. `ci` runs TypeScript, storefront guardrails, Vitest,
disposable authorization/minimum/reconfirmation SQL tests, production build
and PWA generation. Individual commands: `check`, `check:storefront`, `test`,
`test:authorization`, `test:orders`, `test:price-reconfirmation`, `build`, `preview`.
SQL CI uses synthetic local schemas, never a production URL. Full restored-schema
validation and its limits are documented in [the reconfirmation report](docs/reports/2026-09-23-price-reconfirmation-validation.md).

## Current architecture

React/TypeScript + Vite + Tailwind v4 + Wouter + Zustand + Supabase. Data calls
belong in existing `client/src/lib/*Service.ts`, `authStore.ts` and the Supabase
client, not new component queries. Some legacy admin components still query
directly; the checker grandfather list is debt, not permission to add more.

| Route | Implementation |
| --- | --- |
| / | HeroSlideshow, top promo slot, HomeCategoryGrid, HomeSpotlightStrip, middle promo slot, two MerchandisedRow sections |
| /catalog | URL-driven catalogue filters and shared ProductCard |
| /product/:id | ProductDetail, variants and shared ordering controls |
| /cart | Shared totals/messages, guest quantity enquiry or authenticated confirmed-price checkout |
| /search, /categories, /account, /auth | Storefront pages in App.tsx |
| /admin | AdminDashboard, CatalogTreeEditor and supporting tabs |
| /admin/products/new, /admin/products/:id | Shared route product editor |
| /admin/masters | AdminMasters |

`App.tsx` currently lazy-loads Dashboard and ProductEditor; other routes still
need the planned splitting work. One StorefrontLayout owns Header/Footer;
Header renders MobileNav once. Footer is desktop-only. No Admin-v2 exists.

Ordering uses `orderingModel.ts`, `cartStore.ts` and `orderMessage.ts`.
`priceEntryMode.ts` controls admin price entry and is separate from customer
ordering. `useProductForm`/`productForm.ts` are shared by the route and catalogue
editor. Masters/variants read shared fields through existing services. Health
dimensions come from `v_product_health`; counts from `v_category_live_counts`.

CSV/Excel and Google Sheets share `bulkImportService.ts` and the XLSX template
in `templateService.ts`. SheetJS CE 0.20.3 is pinned by tarball after security
work; XLS and XLSX compatibility tests exercise real workbook parsing. Import
preview and SKU upsert behavior are not permission to invent catalogue data.
Template ordering columns still need Phase 5.3 verification/completion.

## Security and deployment

Guests get explicit non-price product columns and no protected rate sorting.
Published+active gates remain. The guest cart action never creates a DB order;
authenticated checkout uses `place_order_from_confirmed_cart` and reconfirmation.
Admin is database-owned; profile flags and admin writes are protected by RLS.

See [DEPLOYMENT](DEPLOYMENT.md), [SQL_SCHEMA](SQL_SCHEMA.md),
[SQL changelog](docs/CHANGELOG_SQL.md), [ordering rules](docs/ORDERING_MODEL.md),
[design](docs/DESIGN_SYSTEM.md) and [launch status](docs/LAUNCH_STATUS.md).
Production build output is `dist/public`; npm/package-lock only, no pnpm lock.
Private browser AI credential support is a verified pending launch blocker.
The business-settings editor's schema mismatch is pending; its missing-row
query already uses maybeSingle. Hosted authenticated testing needs valid access.

Historical feature lists and measurements are [archived](docs/archive/README.md).
The package currently declares MIT; no licensing change is made by this work.
