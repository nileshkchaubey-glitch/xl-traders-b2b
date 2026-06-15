# XL Traders B2B — Project Context & Knowledge Base
**Single source of truth. Lives as `CLAUDE.md` in repo root AND in the Claude Project.**
**Last updated: June 14, 2026** · Update this after every merged PR.

---

## 🎯 How To Use This Document
- **In Claude Code (VS Code):** Keep this file named `CLAUDE.md` at repo root. Claude Code reads it automatically every session.
- **In Claude Chat:** Upload this file into the Claude Project knowledge. Every new chat in that project will know the full website.
- **Update ritual (2 min after each merge):** Update two sections only — "✅ Shipped Features" and "🗺️ Roadmap". That's what keeps the system in-touch.

---

## Business
**XL Traders** — B2B wholesale distributor, Surat, Gujarat. Tagline: "You Order, We Deliver."
Products: Food Packaging, Biodegradable, Cleaning Supplies, Kirana Bio Plastic Bags, Catering, Decoration & Party.
WhatsApp: 97732 39442 · Email: xltraders990@gmail.com · Hours: Mon–Sat 9AM–9PM
Owner: Nilesh (nileshk.chaubey@gmail.com) — **solo operator, no staff.**

---

## Tech Stack & Architecture
- **Frontend:** React 19 + Vite + TypeScript + Tailwind + Wouter + Zustand + shadcn/ui
- **Backend:** Supabase (ref `danoeaftaazhbldeeuxj`, Tokyo, FREE plan)
- **Storage:** `product-images` bucket (Supabase)
- **Deploy:** Cloudflare Pages — **auto-deploys from `main` on merge**
- **Repo:** `nileshkchaubey-glitch/xl-traders-b2b` (default branch: `main`)
- **Admin panel:** `/admin` (authenticated). Dark Shopify-style sidebar (`bg-[#1a1d27]`, 220px).
- **Architecture rule:** All DB logic lives in `client/src/lib/*Service.ts` files. Components call service functions; they never query Supabase directly. (This is what makes the future mobile app a reuse, not a rewrite.)

### Live URLs
- Site: https://xl-traders-b2b.pages.dev
- Admin: https://xl-traders-b2b.pages.dev/admin
- GitHub: https://github.com/nileshkchaubey-glitch/xl-traders-b2b
- Supabase: supabase.com/dashboard/project/danoeaftaazhbldeeuxj

---

## Database — Tables

**Core:**
- **products:** id, name, slug, meta_title, meta_description, category_id, price, mrp, quantity_in_unit, unit_of_measure, brand, description, image_url, is_active, bulk_price, bulk_threshold, sku, barcode, moq, **master_id** (nullable FK), **variant_label**
- **categories:** id, name, slug, group_name, group_order, display_order, is_active
- **product_images:** id, product_id, image_url, alt_text, display_order, is_primary

**Masters & Variants (new — June 2026):**
- **product_masters:** id, name, slug, category_id, brand, description, meta_title, meta_description, is_active, created_at, updated_at
- **product_master_images:** master_id, image_url, display_order, is_primary (shared images for all variants under a master)
- A product with `master_id = NULL` is **standalone** (original behavior). A product with a `master_id` is a **variant** (e.g. "Hinged Box 250ml") sharing the master's name/description/images/SEO.

**Sales & ops:**
- **inquiries:** id, created_at, customer_name, phone, message, product_name, source, status, follow_up_date, notes
- **orders / order_items / import_logs / business_settings**

**Current data:** ~140 products, 50+ categories. (Goal: 1000 products.)

---

## ✅ Shipped Features (live on production)

### Customer storefront
- Product catalog, category browsing, search & filters
- Wholesale price security (prices hidden from anonymous users)
- WhatsApp inquiry capture (logs to `inquiries`, then opens WhatsApp)
- Cart system (Zustand + localStorage) → Place Order via WhatsApp
- **Variant selector** on product pages — size/pack buttons (e.g. 250ml / 500ml / 1000ml); updates price, MRP, SKU, MOQ and URL on click without reload

### Admin panel (PIM)
- Shopify-style dark sidebar; nav groups: Catalogue / Sales / Content & Import / System
- **Products:** quick-add sticky row (Tab navigation, keeps category/brand/unit between entries), inline cell editing, SKU auto-gen ({PREFIX}-{4-digit}), completeness score badges, CategoryCombobox (searchable)
- **Route-based product editor** (`/admin/products/new`, `/admin/products/:id`): full-page form, breadcrumbs, "Back to Products", **Save & Add Another**, draft persistence (sessionStorage)
- **AI Smart Paste:** paste raw supplier text (PDF/WhatsApp/website) → auto-extracts Name/Price/MRP/Category/Unit/Qty/Brand/Description → autofills the form (Claude AI with regex fallback)
- **Image Library:** central media manager — aggregates Supabase storage + DB image refs; drag-drop upload; "Select from Library" in the editor; Small/Medium/Large grid + Fit/Fill view options; "Use Image" quick action
- **Right-click PIM context menu:** Edit, Manage Images, Duplicate, Delete, Toggle Active/Featured, View Live Page, Copy SKU/Name/Price/Image URL
- **Masters:** `/admin/masters` — create a master (name, slug, brand, description, SEO, up to 10 shared images) and add multiple variants (label, SKU auto, price, MRP, MOQ, unit). Mobile = cards + accordion; desktop = table + expandable variant sub-rows
- **Daily Admin Improvement widget** on Overview — rotating Quick Win / Medium / Major suggestions
- **Orders tab** (status management), **SEO tab** (slug + meta), **Enquiries tab**
- **Bulk import:** Google Sheets + CSV + Download Template — now supports `master_name` + `variant_label` columns (auto-groups variants under masters); standalone rows still work unchanged
- **Incomplete-entry safety (June 2026):** Price and MOQ are optional everywhere — blank price saves as NULL and displays "Price on enquiry" on all storefront surfaces (card, detail, variant selector, cart). Blank MOQ saves as NULL. Blank category auto-assigns Uncategorized (self-healing: looked up by slug with no is_active filter, and re-created if missing — applies in the route editor, quick-add, and bulk import). Null-price cart items enter as enquiry lines. Bulk import no longer rejects rows missing price/MOQ/brand/image. The WhatsApp enquiry message omits the Quantity line when pack size is blank (never prints "null"). When every cart line is price-on-enquiry, the cart total and the WhatsApp order total show "Price on enquiry" instead of ₹0; mixed carts sum only the priced lines.
- **Draft → Publish gate (June 2026):** `products.status` ('draft' | 'published') controls storefront visibility. **Public visibility rule = `status='published'` AND `is_active=true`.** Every public product query enforces it — cards, ProductDetail, search, category/brand/group browse, featured/home, home category counts, AND `masterService.getVariantsByMasterId` (variant selector). Admin sees ALL statuses. New products default to **draft** everywhere (route editor, quick-add, bulk import, variant add, duplicate); existing products were set to published at rollout. AdminProductEditor has a Status control + a green **"Publish to website"** button; `productService.getById(id, { includeUnpublished: true })` lets the editor load drafts. AdminProducts shows a Draft/Published badge per row, has Draft & Published in the status filter, a per-row + context-menu **Publish** action, and a **"Publish selected"** bulk action. Services: `productService.create`/`update` accept `status`; `productService.publishProducts(ids[])` bulk-publishes. **`status` is exposed to the anon role** (added to `GUEST_PRODUCT_COLS` and the `sql/04` grant) — re-run `sql/04-price-column-security.sql` so guests can filter on it.
- **healthService.ts:** Thin service reading `v_product_health` DB view — `getMissingCounts()` returns per-field missing counts; `getIdsMissing(field)` returns the ids missing a field; `productHealth(id)` returns full health row.
- **Missing-data tooling (June 2026):** All 8 health dimensions (price, category, moq, brand, image, specs, description, seo) are findable/visible — **truth sourced entirely from `v_product_health`, never re-implemented in TS**. AdminProducts has a **"Missing…" dropdown** that filters by any dimension (ids pulled from the view, intersected via `.in('id', …)`) and **composes with search + category + status + pagination** (admin sees all statuses). AdminOverview shows **8 missing-data count chips** from one grouped `getMissingCounts()` read; each chip is a Wouter `<Link>` to `/admin?tab=products&missing=<key>` that pre-applies the filter (AdminDashboard reads the query via `useSearch`).
- Tab persistence, optimistic updates, parallel image uploads, auto-resize to 800px

---

## 🗺️ Roadmap (next, in order)

1. **Re-enter / clean catalog data** using the new variant + entry system → push toward 1000 products
2. **Supplier Catalog Center** (PDF → AI extraction → review → import) — the real 140→1000 force multiplier. AI reads a supplier PDF, extracts products+images, admin reviews and approves, bulk imports.
3. **Bulk Image tools** — bulk rename + tagging + duplicate detection (pg_trgm already installed)
4. **Customer storefront polish** — product comparison, PDF catalog generation, favourites, recently-viewed
5. **Mobile app** (React Native — reuses the same Supabase services)

---

## 🔴 Known Issues / TODO
- **business_settings "not configured" warning:** code uses `.single()` which throws on 0 rows. Fix → `.maybeSingle()` + check `error.code === 'PGRST116'` in `AdminSettings.tsx`
- **AI key exposure:** `VITE_ANTHROPIC_API_KEY` is used in frontend code (browser-exposed). Long-term fix → move AI calls to a Supabase Edge Function. Works for now; revisit before scaling.
- **Branch hygiene:** repo has 40+ stale branches (claude/*, devin/*, fix/*). Clean up old merged branches periodically.

---

## ⚠️ Critical Rules (NEVER break)
1. **Price security:** `productSelectCols()` gates price columns. Session cache MUST invalidate on every auth change. Never expose price to anon users.
2. **`pnpm-lock.yaml` must NOT exist** — Cloudflare build fails if present.
3. **SQL migrations** run manually in Supabase SQL Editor only — never via an agent.
4. **`CREATE POLICY IF NOT EXISTS` is INVALID Postgres** — use plain `CREATE POLICY`.
5. **Wouter `<Link>`** for all internal nav — `<a href>` causes a full reload.
6. **Auth store:** skip `TOKEN_REFRESHED`, deduplicate `SIGNED_IN` by user ID.
7. **Google Drive image URLs:** use `thumbnail?id=FILE_ID&sz=w800` (the `uc?export=view` form broke Jan 2024).
8. **One agent on one branch at a time.** Never run two AI tools on the same feature — that is what created the branch sprawl.
9. **Every change:** new branch → push → PR → review → merge. Never push to `main` directly.
10. **Publish gate:** every NEW public product query must add `.eq('status', 'published')` (alongside `.eq('is_active', true)`). Admin queries must NOT filter by status. New products default to `'draft'`. If you add `status` (or any new anon-readable column), update both `GUEST_PRODUCT_COLS` in `productService.ts` AND the grant in `sql/04-price-column-security.sql`, then re-run that SQL.

---

## 🛠️ Workflow (the loop)

```
1. PLAN      →  Claude Chat (this is where you think, get prompts, review)
2. BUILD     →  Antigravity (primary builder)  OR  VS Code Claude Code (hands-on)
3. CHECK     →  npm run build  +  test on localhost
4. PUSH      →  new branch → push → open PR on GitHub
5. VERIFY    →  GitHub: "no conflicts" + "checks passed" → Merge
6. DEPLOY    →  Cloudflare auto-deploys from main (~2-3 min)
7. SMOKE     →  open live site, test the new feature
8. UPDATE    →  edit this doc's "Shipped" + "Roadmap" sections (2 min)
```

### Tool roles (keep it to TWO)
- **Claude Chat** → planning, prompts, diagnosis, review, decisions
- **Antigravity** → building features (autonomous, visual)
- *(Optional)* **VS Code Claude Code** → when you want to read diffs / make small fixes by hand; reads this `CLAUDE.md` automatically and stays in touch with live code
- **Skip:** the desktop-app "Code" tab (org-access error, redundant) and Codex (usage-limited)

### Key merged PRs (recent)
- #40 fast-entry · #41 drag-drop + code-split · #42 Shopify admin design
- #44 sync-claude-replit-improvements (AI Smart Paste, Image Library, Daily Widget, English-only)
- #45 feat/product-variants (Masters & Variants + route-based editor)
