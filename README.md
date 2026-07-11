# XL Traders B2B

B2B wholesale storefront and admin PIM for **XL Traders**, a packaging & supplies
distributor in Surat, Gujarat. Customers browse the catalogue and place orders over
WhatsApp; the owner manages products, images, and imports through an admin panel.

- **Live site:** https://xl-traders-b2b.pages.dev
- **Admin:** https://xl-traders-b2b.pages.dev/admin

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4, shadcn/ui |
| Routing / state | Wouter, Zustand |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| Image storage | Supabase `product-images` bucket |
| Hosting | Cloudflare Pages (auto-deploys from `main`) |
| Package manager | npm (`package-lock.json`) |

## Getting started

### Prerequisites

- Node.js 20
- npm
- A Supabase project (free tier is fine)

### Setup

```bash
git clone <repo-url>
cd xl-traders-b2b
npm install
cp .env.example .env   # then fill in the values below
npm run dev            # serves on http://localhost:5000
```

### Environment variables

The client reads `VITE_`-prefixed variables at build time. Create a `.env` (git-ignored)
with at least:

```env
# Supabase (required)
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>

# Admin gating — comma-separated emails allowed into /admin
VITE_ADMIN_EMAILS=owner@example.com

# Business / contact config (shown across the storefront)
VITE_BUSINESS_NAME=XL Traders
VITE_BUSINESS_CITY=Surat
VITE_BUSINESS_STATE=Gujarat
VITE_BUSINESS_COUNTRY=India
VITE_WHATSAPP_NUMBER=919773239442
VITE_EMAIL=xltraders990@gmail.com

# Optional: AI "Smart Paste" field extraction
# NOTE: currently browser-exposed — move to a Supabase Edge Function before scaling.
VITE_ANTHROPIC_API_KEY=<key>
```

> The root `.env.example` documents the server-side keys used by the helper scripts in
> `scripts/` (service-role key, storage bucket). Never commit a real `.env`.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server on port 5000 |
| `npm run build` | Production build to `dist/public` |
| `npm run preview` | Preview the production build |
| `npm run check` | TypeScript type-check (`tsc --noEmit`) |
| `npm run format` | Prettier write across the repo |

## Architecture

The app is a Vite single-page app (`client/`) talking directly to Supabase — there is no
custom backend server. See `CLAUDE.md` for the binding rules and
[`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) for UI tokens, engineering standards, the
component inventory, and the data-flow reference; this section is the map.

### Directory layout

```
client/
  src/
    App.tsx       Wouter router (all routes below)
    pages/        Home, Catalog, ProductDetail, Auth, AdminDashboard, AdminProductEditor, NotFound
    components/
      home/       hero + homepage sections (HomeHero, HeroTopBar, HeroTrustStrip, …)
      cart/       AddToCartButton, CartDrawer
      admin/      the entire PIM (AdminProducts, AdminMasters, importers, Image Library, …)
        products/ ProductsTable, ProductDrawer, EditableCell, RapidEntryRow, ProductMediaSection
      ui/         shadcn/ui primitives
    lib/          *Service.ts (ALL Supabase logic), authStore, supabase client, helpers
    stores/       cartStore (Zustand)
    hooks/        useProductForm (shared save logic), useKeyboardShortcuts, …
  public/         static assets + Cloudflare _redirects / _headers + hero images
sql/, migrations/ schema & migrations (applied manually via Supabase SQL Editor — never by agents/CI)
scripts/          local maintenance/import helpers (need service-role key from root .env)
```

### Routes (Wouter, `client/src/App.tsx`)

| Route | Page |
|---|---|
| `/` | Home (hero → category grid → featured products → use cases → brands) |
| `/catalog` | Catalog with search, category filter, price gate |
| `/product/:id` | Product detail (variant selector for masters) |
| `/auth` | Login (Supabase Auth; admin gated by `VITE_ADMIN_EMAILS`) |
| `/admin` | AdminDashboard — tabbed PIM (lazy-loaded, code-split) |
| `/admin/products/new`, `/admin/products/:id` | Route-based product editor |
| `/admin/masters` | Masters & variants manager |

There is no `/admin-v2` — a parallel admin experiment (PRs #62–#79) was built and then
removed in July 2026; the original `/admin` PIM is the only admin.

### Storefront UI

- **Home hero** (`components/home/HomeHero.tsx`): `HeroTopBar` (contact strip) → headline +
  CTA + `HeroProductShowcase` → `HeroTrustStrip` (animated counters) → `HeroBrandsSlider`.
  Copy/images configured in `heroConfig.ts`; hero images live in `client/public/images/hero/`.
- **B2B price gate:** anonymous visitors never receive price columns —
  `productSelectCols()` in `productService.ts` decides the selected columns by auth state.
  A `NULL` price means "Price on enquiry" everywhere (cards, detail, cart, WhatsApp) — never ₹0.
- **Cart → WhatsApp:** `cartStore` (Zustand) builds a WhatsApp order message; null-price
  items are included as enquiry lines.

### Admin PIM (`/admin`)

Dark sidebar (`bg-[#1a1d27]`, 220px) with four groups:
**Catalogue** (Overview, Products, Catalogues, Image Library, Masters) ·
**Sales** (Orders, Enquiries) · **Content & Import** (SEO, CSV Import, Google Sheets) ·
**System** (Settings).

Core PIM concepts:

- **Products** — only `name` is required; blank price/MOQ/category become NULL /
  "Uncategorized" (sentinel category, never delete). New products default to
  `status='draft'`; only `published` **and** `is_active` products appear publicly.
- **Masters & variants** — `product_masters` holds shared description/images/SEO;
  products with `master_id` set are variants (`variant_label` e.g. "250ml"). The
  storefront renders variants as size buttons that swap price/SKU/MOQ/URL in place.
- **Catalogue health** — the `v_product_health` PostgreSQL view is the ONLY source of
  missing-field logic (8 dimensions → `missing_count`, `health_score`). `healthService.ts`
  just queries it; `catalogHealth.ts` maps scores to colors/labels. Never re-implement
  the checks in TypeScript.
- **N/A marking** — `na_fields TEXT[]` on a product excludes fields from the missing
  checks, so "this product genuinely has no brand" stops showing as incomplete.
- **Products list** — virtualized `ProductsTable` (TanStack Table + Virtual) with inline
  `EditableCell` edits, a `ProductDrawer` side sheet that shares its save logic with the
  route editor via `useProductForm` (no fork), `RapidEntryRow` for one-line adds, and a
  bulk action bar (set fields, publish/unpublish, delete, N/A marking) that can select
  all rows matching the current filter.

### Service layer (the one rule that matters most)

```
components / pages  →  client/src/lib/*Service.ts  →  Supabase
```

Components NEVER call Supabase directly. Services: `productService`, `masterService`,
`orderService`, `healthService`, `bulkImportService`, `googleSheetsService`,
`templateService`, `aiService` (+ `authStore`, `supabase.ts` client). If a service is
missing a method, add it to the existing file — don't create a parallel one.

### Import system

Two admin screens — **CSV Import** and **Google Sheets** — share `bulkImportService`
and the v3 template (see the column table in `CLAUDE.md`): `name` and `unit` required,
everything else optional (blank price = enquiry, blank category = Uncategorized,
`master_name`/`variant_label` create variants, `na_fields` pre-marks N/A). All imported
products land as `draft`. Re-imports upsert by SKU (dry-run preview) instead of duplicating.

### Known issues

- `VITE_ANTHROPIC_API_KEY` is exposed in the browser bundle — must move to a Supabase
  Edge Function before scaling AI features.
- `specifications` JSONB column exists but is not yet populated.
- `business_settings` lookup uses `.single()` which throws on 0 rows (should be `.maybeSingle()`).
- `enquiries` vs `inquiries` are **intentionally separate** tables (B2B leads vs
  WhatsApp-click log) — never merge them.

## Deployment

Cloudflare Pages auto-deploys on every merge to `main`:

- **Build command:** `npm install && npm run build`
- **Build output directory:** `dist/public`
- **Node version:** 20

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and the business/contact variables in
the Cloudflare Pages project settings. SPA routing and security headers ship from
`client/public/_redirects` and `client/public/_headers`. Only `package-lock.json` is
committed — `pnpm-lock.yaml` must not exist, or the Cloudflare build fails.

Database migrations are applied manually through the Supabase SQL Editor (not from CI).

## License

Proprietary — © XL Traders.
