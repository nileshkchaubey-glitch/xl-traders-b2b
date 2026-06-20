# XL Traders B2B

B2B wholesale storefront and admin PIM for **XL Traders**, a packaging & supplies
distributor in Surat, Gujarat. Customers browse the catalogue and place orders over
WhatsApp; the owner manages products, images, and imports through an admin panel.

- **Live site:** https://animated-cuchufli-dd5a16.netlify.app
- **Admin:** https://animated-cuchufli-dd5a16.netlify.app/admin

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4, shadcn/ui |
| Routing / state | Wouter, Zustand |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| Image storage | Supabase `product-images` bucket |
| Hosting | Netlify (auto-deploys from `main`) |
| Package manager | pnpm |

## Getting started

### Prerequisites

- Node.js 20
- pnpm 10+
- A Supabase project (free tier is fine)

### Setup

```bash
git clone <repo-url>
cd xl-traders-b2b
pnpm install
cp .env.example .env   # then fill in the values below
pnpm dev               # serves on http://localhost:5000
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
| `pnpm dev` | Vite dev server on port 5000 |
| `pnpm build` | Production build to `dist/public` |
| `pnpm preview` | Preview the production build |
| `pnpm check` | TypeScript type-check (`tsc --noEmit`) |
| `pnpm format` | Prettier write across the repo |

## Architecture

The app is a Vite single-page app (`client/`) talking directly to Supabase. A few rules
keep it consistent — see `CLAUDE.md` for the full set:

- **All database access lives in `client/src/lib/*Service.ts`.** Components never call
  Supabase directly. Services: `productService`, `masterService`, `orderService`,
  `healthService`, `bulkImportService`, `googleSheetsService`, `templateService`,
  `aiService`.
- **Price gating:** `productSelectCols()` controls which price columns are selected so
  prices stay hidden from anonymous visitors. A null price means "Price on enquiry",
  never ₹0.
- **Catalogue health:** the `v_product_health` PostgreSQL view is the single source of
  truth for missing-field/completeness logic — never re-implemented in TypeScript.
- **Publish gate:** products default to `status='draft'`; only `published` + active
  products appear on the public storefront.

```
client/
  src/
    components/   UI + admin panel (PIM, importer, masters, bulk tools)
    pages/        storefront + admin routes
    lib/          *Service.ts (all Supabase logic), stores, helpers
sql/, migrations/ database schema & migrations (applied via Supabase SQL Editor)
scripts/          local maintenance/import helpers
netlify.toml      build + headers + SPA redirects
```

## Deployment

Netlify auto-deploys on every merge to `main`:

- **Build command:** `pnpm install --no-frozen-lockfile && pnpm run build`
- **Publish directory:** `dist/public`
- **Node version:** 20

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and the business/contact variables in
the Netlify dashboard. `pnpm-lock.yaml` is committed and required for reproducible builds.

Database migrations are applied manually through the Supabase SQL Editor (not from CI).

## License

Proprietary — © XL Traders.
