# XL Traders B2B — Master Project Blueprint
**Single source of truth. Lives as `CLAUDE.md` at repo root AND in the Claude Project.**
**Last updated: June 16, 2026** · Update after every merged PR (Shipped + Roadmap only).

---

## 🎯 How To Use This Document
- **Claude Code (VS Code):** Named `CLAUDE.md` at repo root → auto-read every session.
- **Claude Chat:** Upload to Claude Project → every new chat knows the full website.
- **Update ritual:** After each merged PR → update Shipped + Roadmap. Agent does this in the PR.

---

## Business
**XL Traders** — B2B wholesale distributor, Surat, Gujarat. Tagline: "You Order, We Deliver."
Products: Food Packaging, Biodegradable, Cleaning Supplies, Kirana Bio Plastic Bags, Catering, Decoration & Party.
Top customers: Cloud kitchens, restaurants, hotels, caterers, cafés, bakeries, grocery/kirana.
WhatsApp: 97732 39442 · Email: xltraders990@gmail.com · Hours: Mon–Sat 9AM–9PM
Owner: Nilesh — solo operator, no staff.

---

## Tech Stack
- **Frontend:** React 19 + Vite + TypeScript + Tailwind + Wouter + Zustand + shadcn/ui
- **Backend:** Supabase (ref `danoeaftaazhbldeeuxj`, Tokyo, FREE plan)
- **Storage:** `product-images` bucket (Supabase)
- **Deploy:** Netlify — auto-deploys from `main` on merge. Build `pnpm install --no-frozen-lockfile && pnpm run build`; publish dir `dist/public`; `NODE_VERSION=20` (see `netlify.toml`). *(Migrated off Cloudflare Pages — project uses `pnpm`, so `pnpm-lock.yaml` MUST be committed.)*
- **Repo:** `nileshkchaubey-glitch/xl-traders-b2b` (default branch: `main`)
- **Admin:** `/admin` (authenticated). Dark sidebar `bg-[#1a1d27]`, 220px.

### Live URLs
- Site: https://animated-cuchufli-dd5a16.netlify.app
- Admin: https://animated-cuchufli-dd5a16.netlify.app/admin
- GitHub: https://github.com/nileshkchaubey-glitch/xl-traders-b2b
- Supabase: supabase.com/dashboard/project/danoeaftaazhbldeeuxj

---

## Database Schema (current)

### products table
```
id, name, slug, category_id (NOT NULL FK),
price (nullable — NULL=enquiry, 0=free), mrp (nullable),
moq (nullable — NULL=unknown), unit_of_measure, quantity_in_unit,
brand, description, image_url, is_active,
bulk_price, bulk_threshold, sku, barcode,
meta_title, meta_description,
master_id (nullable FK → product_masters), variant_label,
status TEXT NOT NULL DEFAULT 'draft' CHECK IN ('draft','published'),
na_fields TEXT[] DEFAULT '{}',
specifications JSONB (nullable — not yet populated)
```

### categories
```
id, name, slug (UNIQUE), group_name, group_order, display_order, is_active
SENTINEL: slug='uncategorized', is_active=false — NEVER DELETE
```

### Masters & Variants
```
product_masters: id, name, slug, category_id, brand, description, meta_title, meta_description, is_active
product_master_images: master_id, image_url, display_order, is_primary
master_id=NULL → standalone. master_id=<uuid> → variant.
```

### v_product_health (VIEW — single source of truth)
```
id, name, master_id, category_id,
missing_price, missing_category, missing_moq, missing_brand,
missing_image, missing_specifications, missing_description, missing_seo,
missing_count (0-8), health_score (0-100)
Rule: na_fields entries excluded from missing checks.
```

### Sales & Ops
```
inquiries, orders, order_items, import_logs, business_settings
```

**Current data:** ~142 products, 50+ categories. **Goal: 1000 products.**

---

## Architecture Rules (NEVER break)
1. **All DB logic in `client/src/lib/*Service.ts`** — components never call Supabase directly.
2. **`v_product_health` is the ONLY missing-logic source** — never re-implement checks in TS.
3. **Price security:** `productSelectCols()` gates price columns. Null price ≠ public price.
4. **No missing/health logic in component files** — only in view + services.

---

## ✅ Shipped Features (live on production)

### Customer Storefront
- Product catalog, category browsing, search & filters
- B2B price gate (prices hidden from anonymous users)
- **Null-price safety:** "Price on enquiry" shown everywhere (cards, detail, cart, WhatsApp) — never ₹0
- Cart → Place Order via WhatsApp (null-price items included as enquiry lines)
- **Publish gate:** only status='published' AND is_active=true appear publicly
- **Variant selector:** size buttons (250ml/500ml/1000ml) update price/SKU/MOQ/URL without reload

### Admin Panel (PIM)
- Shopify-style dark sidebar; CATALOGUE / SALES / CONTENT & IMPORT / SYSTEM
- Products list: quick-add row (Tab nav), inline editing, SKU auto-gen, completeness badges
- **Route-based editor** (`/admin/products/new`, `/admin/products/:id`): Save & Add Another, draft persistence
- **Incomplete-first entry:** only `name` required; blank price/MOQ/category → NULL/Uncategorized; never blocked
- **Draft/Published gate:** new products default draft; "Publish to website" button; Draft/Published badges
- **AI Smart Paste:** paste supplier text → auto-extracts fields → autofills form (Claude AI + regex fallback)
- **Image Library:** central media manager; drag-drop upload; "Select from Library"; Small/Medium/Large grid + Fit/Fill
- **Right-click PIM menu:** Edit, Images, Duplicate, Delete, Toggle status, View Live, Copy info
- **Masters:** `/admin/masters` — shared desc/images/SEO + variants (mobile=cards; desktop=table+expand)
- **Missing-data smart filters:** 8-dimension "Missing…" dropdown (no-price/moq/brand/image/specs/desc/seo/category); composable with search+category+status
- **Dashboard chips:** 8 missing-count chips on Overview → deep-link to filtered list
- **Bulk update:** select-all-matching-filter; set brand/MOQ/unit/category; Publish/Unpublish/Activate/Delete; confirm dialog; N/A marking
- **N/A marking:** bulk + per-product; na_fields[] prevents permanent false-missing noise
- **Daily Admin Improvement widget:** rotating Quick Win/Medium/Major on Overview
- Orders, Enquiries, SEO tabs
- **Bulk import:** Google Sheets + CSV; master_name + variant_label columns; price/moq/category optional; all imported → draft
- **Import UI polish:** one primary "Download Template (.xlsx)" CTA per page (CSV + Sheets); export-catalogue kept as a distinct small outline button; `status`/`na_fields` columns wired through CSV + Sheets parsers; template & instructions updated (only name+unit required; blank price = enquiry); `quantity_in_unit` blank now defaults to 1
- Tab persistence, optimistic updates, auto-resize images to 800px

### Health System
- `v_product_health` PostgreSQL view — single source of truth
- `healthService.ts` — thin service, queries view only
- `catalogHealth.ts` — colors/labels only (no logic)

---

## 🗺️ Roadmap (next, in order)

1. **Catalogue data entry** — bulk-enter products via Google Sheets template v3; target 1000 products
2. **Batch AI extraction** — supplier list → AI returns ParsedProduct[] → review grid → bulk import (needs Edge Function first)
3. **AI → Supabase Edge Function** — move API key off browser; enables batch prompts
4. **Controlled AI category mapping** — AI picks from existing list; unknowns → Uncategorized queue
5. **Image bulk-match** — filename=SKU auto-link
6. **Customer polish** — Shop by Business Type (tags), comparison, PDF catalog, favourites
7. **Mobile app** (React Native — same Supabase services, zero rewrite)

---

## 🔴 Known Issues
- `VITE_ANTHROPIC_API_KEY` browser-exposed — move to Edge Function before scaling
- `specifications` JSONB column unused — start populating
- `business_settings` `.single()` throws on 0 rows — fix to `.maybeSingle()`
- `tags` import column NOT wired — `products.tags` exists only via an untracked conditional migration (may be absent on some DB instances), so the import parsers capture `tags` but do not write it (see TODO in `bulkImportService.ts`). Wire it once `tags` is a tracked migration everywhere.
- Stray `package-lock.json` committed alongside `pnpm-lock.yaml` while `packageManager` is pnpm — harmless but inconsistent; clean up later.

---

## ⚠️ Critical Rules
1. **Price security** — `productSelectCols()` gates price. Cache invalidates on auth change. Null price not public.
2. **`pnpm-lock.yaml` MUST be committed** — Netlify build uses `pnpm`. (The old "must NOT exist" rule was a Cloudflare-era artifact; corrected in PR #51.)
3. **SQL migrations** — Supabase SQL Editor only. Never via agent.
4. **`CREATE POLICY IF NOT EXISTS` invalid Postgres** — use `CREATE POLICY`.
5. **Wouter `<Link>`** — never `<a href>` for internal nav.
6. **Auth store** — skip TOKEN_REFRESHED, deduplicate SIGNED_IN by user ID.
7. **Google Drive images** — `thumbnail?id=FILE_ID&sz=w800` (not `uc?export=view`).
8. **One agent, one branch at a time.**
9. **All changes via PR** — never push to main directly.
10. **Uncategorized sentinel** (slug='uncategorized') — NEVER delete.
11. **`v_product_health`** — only source of missing logic; never duplicate in TS.
12. **All new products default to `draft`** — must be explicitly published.

---

## 🛠️ Workflow
```
1. PLAN   → Claude Chat (this Project)
2. BUILD  → Claude Code in VS Code (reads CLAUDE.md automatically)
3. CHECK  → npm run build (0 errors) + localhost:5000 smoke test
4. PUSH   → new branch → git push
5. PR     → GitHub: no conflicts + checks passed → Merge
6. DEPLOY → Netlify auto-deploys from `main` (~2-3 min)
7. SMOKE  → live site (logged in + logged out)
8. UPDATE → agent updates CLAUDE.md Shipped + Roadmap in same PR
```

### Tools
- **Claude Chat** → planning, task briefs, review
- **Claude Code (VS Code)** → code execution (reads live repo + CLAUDE.md)
- **Antigravity** → only when explicitly requested
- **Skip:** VS Code desktop Code tab (org error), Codex (usage-limited)

### Key Merged PRs
- #44 AI Smart Paste + Image Library + Daily Widget
- #45 Masters & Variants + route-based editor
- #46 Incomplete-data foundation (nullable fields + v_product_health + null-price safety + publish gate)
- #47 Bug fixes (Uncategorized, WhatsApp null, cart total)
- #48 Missing-data filters + dashboard chips
- #49 Bulk update + N/A marking + docs fix (Cloudflare + pnpm-lock)

---

## 📋 Import Template Columns (v3 — current)

| Column | Required | Notes |
|---|---|---|
| name | ✅ | Full name including size for variants |
| category | ✅ | Must match Categories tab exactly |
| unit | ✅ | pcs/box/kg/set/roll/meter/litre/packet |
| price | ⬜ | Blank = "Price on enquiry" |
| mrp | ⬜ | Optional |
| moq | ⬜ | Blank = unknown |
| brand | ⬜ | Blank = unknown |
| description | ⬜ | Short B2B description |
| sku | ⬜ | Blank = auto-generated |
| quantity_in_unit | ⬜ | Pack size e.g. 100 |
| is_featured | ⬜ | Yes/No |
| status | ⬜ | draft (default) or published |
| master_name | ⬜ | Variants only — e.g. "Hinged Box" |
| variant_label | ⬜ | Variants only — e.g. "250ml" |
| tags | ⬜ | restaurant,cloud-kitchen,hotel… |
| na_fields | ⬜ | brand,specifications,image |
| image_url | ⬜ | drive.google.com/thumbnail?id=FILE_ID&sz=w800 |
