# XL Traders B2B — Master Project Blueprint

**Single source of truth. Lives as `CLAUDE.md` at repo root AND in the Claude Project.**
**Last updated: July 12, 2026** · Update after every merged PR (Shipped + Roadmap only).

---

## 🎯 How To Use This Document

- **Claude Code (VS Code):** Named `CLAUDE.md` at repo root → auto-read every session.
- **Claude Chat:** Upload to Claude Project → every new chat knows the full website.
- **Update ritual:** After each merged PR → update Shipped + Roadmap. Agent does this in the PR.
- **`/admin-v2` is GONE.** The parallel admin-v2 experience (PRs #62–#79) was removed in July 2026 —
  the original `/admin` PIM is the only admin. Do not recreate admin-v2 code, routes, or specs.
- **Design System & standards:** see [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) for UI tokens,
  engineering/service-layer rules, the component inventory + planned `<DataTable>` contract, and
  the architecture/data-flow reference.

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
- **Deploy:** Cloudflare Pages — auto-deploys from `main` (~2-3 min)
- **Repo:** `nileshkchaubey-glitch/xl-traders-b2b` (default branch: `main`)
- **Admin:** `/admin` (authenticated). Dark sidebar `bg-[#1a1d27]`, 220px.

### Live URLs

- Site: https://xl-traders-b2b.pages.dev
- Admin: https://xl-traders-b2b.pages.dev/admin
- GitHub: https://github.com/nileshkchaubey-glitch/xl-traders-b2b
- Supabase: supabase.com/dashboard/project/danoeaftaazhbldeeuxj

---

## Database Schema (current)

### products table

```
id, name, slug, category_id (NOT NULL FK),
price (nullable — NULL or 0/negative = "on enquiry"; NEVER rendered as ₹0), mrp (nullable),
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
- **Null-price safety:** "Price on enquiry" shown everywhere (cards, detail, cart, WhatsApp) — never ₹0.
  The single rule lives in `lib/priceUtils.ts` — `isPriceOnEnquiry(price)` treats NULL **and 0/negative**
  as on-enquiry (0 is no longer "free"); every render/consume site funnels through it, and all price-save
  paths (inline edits, editor/drawer, quick-add, bulk import) coerce 0 → NULL so a ₹0 is never stored.
- Cart → Place Order via WhatsApp (null-price items included as enquiry lines)
- **Publish gate:** only status='published' AND is_active=true appear publicly
- **Variant selector:** size buttons (250ml/500ml/1000ml) update price/SKU/MOQ/URL without reload
- **Desktop-prototype redesign (July 2026):** storefront reskinned to the Claude Design
  "XL Traders - Desktop Prototype" (reference copy in `design-reference/`):
  - Header: dark utility bar (GST/delivery/hours/phone), Categories mega-menu from real
    category groups, live search suggestions (debounced `productService.search`) with
    recent/popular chips + WhatsApp "we probably stock it" fallback, red Cart button → `/cart`
  - Home: hero with rating badge + **auto-rotating motion tiles** (`HeroMotionTiles` — local
    `/images/hero/*.png`, crossfade + Ken Burns, progress dots, links to catalog search),
    infinite marquee strip (brands from DB, value-prop fallback), scroll-reveal sections
    (framer-motion), sign-in hook banner (anon only), bulk-quote banner, trust stats/points,
    service areas + brands, FAQ accordion; `prefers-reduced-motion` disables animations
  - Catalog: breadcrumb + title/controls row (sort + grid/list on desktop), restyled sidebar
  - ProductCard: brand line, ₹/pack + per-piece + MOQ line, outline Add-to-Cart → red stepper,
    MOQ pre-filled on first add; anon sees Enquire + "Sign in for exact price"
  - Product detail: breadcrumb, sticky buy panel (price card, qty stepper + quick +5/+10/+25,
    MOQ note, Add to Cart · ₹total, WhatsApp), delivery pincode check, specs/description cards
  - `/cart` page: line items with Below-MOQ warning + "Fix to MOQ", order notes (appended to
    WhatsApp message), summary card, checkout disabled until MOQ fixed; CartDrawer still exists
  - Footer: prototype 4-column dark layout
  - **Mobile prototype (July 2026,** reference `design-reference/xl-traders-mobile-prototype.dc.html`**):**
    fixed bottom nav (Home/Categories/Cart badge/WhatsApp) + floating cart FAB (count + running
    total) via `MobileNav` (rendered by Header); "Same-day Surat" pill in mobile header; mobile
    search shares the live-suggestion panel; catalog mobile = Filters chip + group quick chips +
    slide-up Filters & Sort bottom sheet ("Show N products"); PDP mobile = sticky WhatsApp +
    Add-to-Cart·₹total action bar above the nav (anon: "Sign in for wholesale price")

### Admin Panel (PIM)

- Shopify-style dark sidebar; CATALOGUE / SALES / CONTENT & IMPORT / SYSTEM
- **Products list redesign (Phase 1)** — HISTORICAL, removed in Phase 2b: the old
  AdminProducts surface (`ProductsTable` + `ProductDrawer` + `EditableCell` +
  `RapidEntryRow` + its bulk bar) was deleted after the Catalog Editor reached
  verified 100% parity (PR #98). Its behaviors live on in the Catalog Editor +
  shared `<DataTable>`; recover the old code from git history if ever needed.
- **Route-based editor** (`/admin/products/new`, `/admin/products/:id`): Save & Add Another, draft persistence (shares `useProductForm` with the drawer)
- **Incomplete-first entry:** only `name` required; blank price/MOQ/category → NULL/Uncategorized; never blocked
- **Draft/Published gate:** new products default draft; "Publish to website" button; Draft/Published badges
- **AI Smart Paste:** paste supplier text → auto-extracts fields → autofills form (Claude AI + regex fallback)
- **Image Library:** central media manager; drag-drop upload; "Select from Library"; Small/Medium/Large grid + Fit/Fill
- **Right-click PIM menu:** Edit, Images, Duplicate, Delete, Toggle status, View Live, Copy info
- **Masters:** `/admin/masters` — shared desc/images/SEO + variants (mobile=cards; desktop=table+expand)
- **Missing-data smart filters:** 8-dimension "Missing…" dropdown (no-price/moq/brand/image/specs/desc/seo/category); composable with search+category+status
- **Dashboard chips:** 8 missing-count chips on Overview → deep-link to filtered list
- **Bulk update:** select-all-matching-filter; set brand/MOQ/unit/category; Publish/Unpublish/Activate/Delete; confirm dialog; N/A marking
- **Mobile-responsive ProductsTable** (PR #58) — HISTORICAL, removed in Phase 2b with AdminProducts
- **N/A marking:** bulk + per-product; na_fields[] prevents permanent false-missing noise
- **Daily Admin Improvement widget:** rotating Quick Win/Medium/Major on Overview
- Orders, Enquiries, SEO tabs
- **Site Content editor (Phase B):** `/admin` → **Site Content** tab edits storefront copy
  (hero, rating badge, trust stats/points, service areas, FAQ, bulk banner, announcement bar,
  footer) without a code deploy. Data lives in the `site_content` table (key text PK, value
  jsonb) behind `settingsService.ts` (getContent/getAllContent/updateContent + FALLBACKS +
  session cache); every key has an in-code fallback so an empty table renders the identical
  site. Footer category quick-links read the real `group_name`s. Includes a **Tax / GST**
  section (`gst_enabled`, `gst_percentage`) — stored only, NOT yet wired into cart/checkout.
  Seed SQL: `docs/phase-b-seed.sql`.
- **Mobile-first admin experience (Phase C, C1–C4):** same routes/services/data — only the
  chrome/presentation changes below `md` via `useIsMobile` (desktop admin unchanged).
  - **C1 shell** (`MobileAdminShell` + shared `adminNav.tsx`): fixed bottom tabs
    (Dashboard/Products/Images/More) + top bar; "More" lists every remaining section.
  - **C2 products** — HISTORICAL, removed in Phase 2b: `MobileProductCard` /
    `ProductQuickEditSheet` lived inside AdminProducts and were deleted with it.
    Mobile products management now uses the responsive Catalog Editor (bottom-tab
    "Products" → catalog-editor); a mobile-optimized pass is future work.
  - **C3 images:** `MobileImageLibrary` — camera capture (`capture="environment"`) + touch grid;
    reuses `mediaService.uploadGlobalImage` (bucket `product-images`, `products/global-*`) +
    `autoResizeImage`.
  - **C4 categories/masters:** touch category list with up/down reorder + `MobileCategorySheet`
    (name/image/visibility); `AdminMasters` mobile cards → `MobileMasterSheet` (active toggle,
    variants + per-variant full-editor link, add/delete). All bottom sheets use the one vaul
    `Drawer` primitive (`ui/drawer`, swipe-to-close); 44px+ targets throughout.
- **Catalog Tree Editor (Phase 1 of 3):** `/admin` → **Catalog Editor** tab — an
  *additional* editing surface beside the Products table (does not replace it). Left
  collapsible Group › Category tree (real `group_name`s; ungrouped bucket) with per-node
  product counts + health dots (green/amber/red from `healthService.getCategoryHealth`, a
  `v_product_health` rollup); selecting a node filters the main table server-side via
  `productService.getAllAdmin` (`categoryIds[]` for groups, `.range()` pagination kept).
  Main panel is an inline-editable table (Name / Price / Availability / Description; click
  a cell, Enter/blur saves via `productService.update`, Esc cancels; blank/0 price → NULL
  "On Enquiry" via shared `isPriceOnEnquiry` (never ₹0); missing price/desc/image render
  red-tinted). Top "Fix Missing" chips (No price / No description / No image / Draft) with
  live node-scoped counts filter the table. Thumbnails display-only (image assign = Phase
  3).
- **Catalog Tree Editor (Phase 2 of 3):** the Catalog Editor gains full data visibility +
  feature parity with the Products table (AdminProducts stays untouched; its removal is a
  later Phase 2b only after parity is verified live). **Columns**: a "Columns" dropdown
  toggles SKU / Category / Group / Unit-Pack / Stock / Price / Description / Status / Score /
  Updated (Name + checkbox always shown, sticky-left); the table horizontal-scrolls when
  columns overflow; the choice persists in-memory + the `cols` URL param (no localStorage).
  **Side panel**: a row "Open" button slides in `CatalogProductPanel` — a right drawer built
  on the shared `useProductForm` (service-layer save; shared `ProductDrawer` untouched) with
  Basic / Pricing (On-Enquiry toggle) / Availability / Description (+ AI Smart Paste) /
  Specifications (key-value JSONB) / Images / SEO, a dirty-close guard, Esc-close, and a link
  to the full route editor. **Parity**: global name/SKU search (`getAllAdmin`, whose admin
  filter now ORs name/sku), a status filter + 8-dimension Missing… dropdown merged into the
  toolbar, a bulk bar (select-all-matching via `getAdminMatchingIds`, Publish/Unpublish via
  `bulkSetStatus`, Delete via `bulkDelete`), spreadsheet keyboard nav (↑↓←→ focus ring, Enter
  edit/save-down, Tab save-right, Esc cancel), and an "Add product" quick input (draft via
  `productService.create`).
- **Catalog Tree Editor — parity close:** the remaining AdminProducts gaps are now migrated in
  (AdminProducts still stays put; removal = Phase 2b after live verification). Side panel gains
  real **image assignment** (shared `ProductMediaSection`: primary + gallery via
  `productImageService`, "Select from Library", image N/A). Bulk bar gains **set brand / MOQ /
  unit / category** (`bulkUpdateField`; category skips variants via new
  `productService.getVariantIds`), **Activate/Deactivate**, and **N/A marking** (`bulkSetNA`,
  brand/specs/description/image). Per-row **duplicate** (`productService.create`) and **feature
  toggle** (`productService.toggleFeatured`) added as name-cell actions. Every feature reuses the
  exact service method AdminProducts uses — no forked logic.
- **Phase 2b — AdminProducts removed; Catalog Editor is THE products surface:** after parity
  was verified live, `AdminProducts.tsx` and its exclusive components (`ProductsTable`,
  `EditableCell`, `ProductDrawer`, `ProductQuickEditSheet`, `MobileProductCard`,
  `RapidEntryRow`, `AdminImageGallery`) were deleted (grep-verified no other importers;
  recover from git if needed — e.g. the Phase-2 image-QC roadmap referenced
  `AdminImageGallery`). The sidebar/mobile "Products" entry, Overview KPI cards + chips
  (`?tab=catalog-editor&missing=<key>`), quick actions, AdminMasters nav, and
  AdminProductEditor back-navigation all point at `catalog-editor`; legacy
  `tab=products` deep-links/sessionStorage are normalized to it. Overview missing-chips
  now drive the Catalog Editor's filter via `attentionFilter`/`onAttentionChange` props.
  The route editor (`/admin/products/new`, `/:id`) stays — the panel still links out to
  it. Kept (still shared): `ProductMediaSection`, `useKeyboardShortcuts` +
  `KeyboardShortcutsDialog` (route editor).
- **Admin polish Phase B (July 2026):** presentation-layer only, on top of Phase A (PR #101).
  **Row context menu:** `<DataTable>` gained a generic `rowContextMenu` render-prop (fulfills
  the DataTable contract's item #13, previously `[deferred]`) — right-click any Catalog Editor
  row for Open / Edit full / Duplicate / Feature / Publish-Unpublish / View live / Copy name /
  Copy SKU / Delete, each calling the exact existing handler (Publish-toggle, View live, Copy,
  and per-row Delete are new thin wrappers around the same `productService` methods the bulk bar
  already used). The same item list also renders in an always-visible "⋯" `DropdownMenu` button
  on the Name cell, for touch/discoverability. **Floating bulk bar:** the selection action bar is
  now `fixed` and docked to the viewport bottom (Shopify pattern) instead of pushing the table
  down — `bottom-16 md:bottom-0` clears `MobileAdminShell`'s bottom tab bar, `lg:left-[220px]`
  clears the static sidebar; a `ResizeObserver`-driven spacer keeps the page from covering
  itself. Same actions/handlers/icons, layout-only change. **Ctrl+K command palette:** global
  shortcut (guarded so it never engages mid inline-cell-edit) opens a `cmdk` `CommandDialog`
  searching products via `productService.searchAdmin` (name/SKU, drafts included); selecting a
  result re-fetches the full row via `getById(id, {includeUnpublished:true})` before opening the
  side panel, so a save never blanks fields the search result didn't carry. Also lists nav
  actions (Go to Orders/Enquiries/Masters/Site Content, Add product). Scoped to the Catalog
  Editor tab (not app-wide) — a documented judgment call, since `panelProduct` state lives there;
  `AdminDashboard` passes `onTabChange` down for the sibling-tab nav actions. No new deps (`cmdk`
  + the Radix context-menu/dropdown-menu primitives were already in `package.json`); mobile admin
  gets the same row menu/"⋯" button/floating bar (all already responsive) — the palette is a
  keyboard shortcut, so it's reachable but not the primary mobile interaction pattern.
- **Admin polish Phase C — column resize (July 2026):** `<DataTable>` gains TanStack's built-in
  column resizing (fulfills the DataTable contract's item #3, previously `[deferred]`) —
  `columnResizeMode: "onChange"` for a live drag preview, a thin drag handle on the right edge
  of every resizable column header (`cursor-col-resize`, red highlight while dragging,
  double-click resets to default), and a per-column `minSize`/`maxSize` so nothing can be
  dragged unreadably narrow. Widths persist to the URL (`${persistKey}Sizing`, same no-
  localStorage pattern as column visibility/density) but only written on drag-end — `onChange`
  mode fires every pixel, so the URL write is gated on
  `columnSizingInfo.isResizingColumn` returning to `null`. The sticky Name column stays sticky
  while resizable (`stickyLeft` now also depends on `columnSizing`, so a later sticky column
  would shift correctly — today Name is the only one). The table's width switched from
  `min-w-full` to an explicit `table.getTotalSize()`, since `min-w-full` lets the browser's
  auto table layout redistribute any slack space proportionally across columns, silently
  undoing a drag on wide viewports. `CatalogTreeEditor` (the only consumer) sets a `size`/
  `minSize` per column to match its previous auto-layout width. No new deps.
- **Bulk import:** Google Sheets + CSV; master_name + variant_label columns; price/moq/category optional; all imported → draft
- **SKU-respecting upsert import** (PR #60): re-import updates existing rows by SKU instead of duplicating; dry-run preview
- Tab persistence, optimistic updates, auto-resize images to 800px

### Health System

- `v_product_health` PostgreSQL view — single source of truth
- `healthService.ts` — thin service, queries view only
- `catalogHealth.ts` — colors/labels only (no logic)

### Repo Hygiene (Phase 0)

- README rewritten (accurate Cloudflare Pages stack, env vars, setup, architecture summary)
- Removed stale scaffold/other-tool artifacts (`.replit`, unused `ManusDialog`,
  `__manus__/`, `attached_assets/`, `*.clean.*`, `template.json`, stray `pnpm-lock.yaml`)
- Confirmed Cloudflare Pages as sole deploy target; removed stale Netlify references
  (`package-lock.json` is the lockfile / npm; `pnpm-lock.yaml` must NOT exist — rule #2)
- Scrubbed other-AI-tool references from docs
- One-time Prettier format pass committed separately
- Conventional commits (`feat`/`fix`/`chore`/`docs`/`style`) adopted going forward

---

## 🗺️ Roadmap (next, in order)

0. **Phase 2 — PIM Image Management & QC** (planned, grounded in 2026-06-25 Supabase audit). No new tables.
   - **Prereqs (you, via SQL Editor — not the agent):** standardize 4 canonical `group_name` values
     (`Disposal & Food Packaging`, `Decoration`, `Cleaning`, `Packaging`); confirm `product-images`
     bucket public-read.
   - **A. SKU upload pipeline:** `autoResizeImage` gains a webp option; `isOwnImage(url)` host check;
     `storageService.uploadBySku` → `products/{SKU}/{SKU}.webp` (+ `_NN` for gallery), `upsert:true`,
     id-fallback when SKU null; `productImageService.assignOwnImage`.
   - **B. Image QC grid mode:** new `ProductsQCGrid` reusing AdminProducts' data/filters/selection (no fork);
     OWN / PLACEHOLDER / MISSING badge, group›category breadcrumb, draft/published toggle; `viewMode`
     toggle swaps table↔grid; Replace-image reuses the existing `AdminImageGallery` dialog with an
     "Upload own image" button; server-side "needs own image" filter ANDs with existing filters.
   - **Rollout:** division-by-division via the existing category filter; verify-before-live uses the
     shipped draft/publish bulk actions. ("No gallery" filter deferred to a follow-up.)
1. **Update import UI** — price/moq as optional on Google Sheets + CSV screens; add status+tags to column list
2. **Catalogue data entry** — bulk-enter products via Google Sheets template v3; target 1000 products
3. **Batch AI extraction** — supplier list → AI returns ParsedProduct[] → review grid → bulk import (needs Edge Function first)
4. **AI → Supabase Edge Function** — move API key off browser; enables batch prompts
5. **Controlled AI category mapping** — AI picks from existing list; unknowns → Uncategorized queue
6. **Image bulk-match** — filename=SKU auto-link
7. **Customer polish** — Shop by Business Type (tags), comparison, PDF catalog, favourites
8. **Mobile app** (React Native — same Supabase services, zero rewrite)

---

## 🔴 Known Issues

- `VITE_ANTHROPIC_API_KEY` browser-exposed — move to Edge Function before scaling
- `specifications` JSONB column unused — start populating
- `business_settings` `.single()` throws on 0 rows — fix to `.maybeSingle()`
- **GST setting is stored-only** — `site_content.gst_enabled` / `gst_percentage` are editable in
  admin but NOT yet applied to any cart/checkout math (deliberate; checkout integration is a later phase)
- Import UI shows price as required (\*) — stale after nullable migration (fix in next PR)
- **`enquiries` vs `inquiries` are NOT duplicate tables — do NOT merge them.**
  `enquiries` = real B2B leads (admin views via `enquiryService` / AdminEnquiries).
  `inquiries` = lightweight WhatsApp-click log for all users (`inquiriesService`,
  `productService.ts`). They are distinct by design; an earlier audit misread them as
  duplicates. Merging would destroy the lead-vs-click distinction.

---

## ⚠️ Critical Rules

1. **Price security** — `productSelectCols()` gates price. Cache invalidates on auth change. Null price not public.
2. **`pnpm-lock.yaml` must NOT exist** — Cloudflare build fails.
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

## Custom commands

(actual files in `.claude/commands/`)

- /audit — bugs/security/architecture audit (Problem→Fix→Verification)
- /suggest-storefront — storefront look/UX + mistake flags
- /setup-catalog-ui — 2-level category UI + category images (replaces emoji)

---

## 🛠️ Workflow

```
1. PLAN   → Claude Chat (this Project)
2. BUILD  → Claude Code in VS Code (reads CLAUDE.md automatically)
3. CHECK  → npm run build (0 errors) + localhost:5000 smoke test
4. PUSH   → new branch → git push
5. PR     → GitHub: no conflicts + checks passed → Merge
6. DEPLOY → Cloudflare auto-deploys (~2-3 min)
7. SMOKE  → live site (logged in + logged out)
8. UPDATE → agent updates CLAUDE.md Shipped + Roadmap in same PR
```

### Tools

- **Claude Chat** → planning, task briefs, review
- **Claude Code (VS Code)** → code execution (reads live repo + CLAUDE.md)

### Key Merged PRs

- #44 AI Smart Paste + Image Library + Daily Widget
- #45 Masters & Variants + route-based editor
- #46 Incomplete-data foundation (nullable fields + v_product_health + null-price safety + publish gate)
- #47 Bug fixes (Uncategorized, WhatsApp null, cart total)
- #48 Missing-data filters + dashboard chips
- #49 Bulk update + N/A marking + docs fix (Cloudflare + pnpm-lock)
- #53 Import UI polish (category optional; status + na_fields columns wired)
- #54 Phase 0 — repo hygiene (README rewrite, stale artifacts removed, Cloudflare Pages confirmed)
- #55 Phase 1 — Products list redesign (ProductsTable + ProductDrawer + EditableCell + RapidEntryRow + bulk action bar)
- #57 Phase 1 follow-up (CLAUDE.md docs + dev-server launch config)
- #58 Responsive ProductsTable layout for mobile
- #60 SKU-respecting upsert import pipeline with dry-run
- #61 /audit + /suggest-storefront slash commands
- #62–#79 admin-v2 phases 1–11 — **built, then removed** (July 2026 pivot back to `/admin`)

---

## 📋 Import Template Columns (v3 — current)

| Column           | Required | Notes                                         |
| ---------------- | -------- | --------------------------------------------- |
| name             | ✅       | Full name including size for variants         |
| category         | ⬜       | Blank → Uncategorized; must match Categories tab exactly |
| unit             | ✅       | pcs/box/kg/set/roll/meter/litre/packet        |
| price            | ⬜       | Blank = "Price on enquiry"                    |
| mrp              | ⬜       | Optional                                      |
| moq              | ⬜       | Blank = unknown                               |
| brand            | ⬜       | Blank = unknown                               |
| description      | ⬜       | Short B2B description                         |
| sku              | ⬜       | Blank = auto-generated                        |
| quantity_in_unit | ⬜       | Pack size e.g. 100                            |
| is_featured      | ⬜       | Yes/No                                        |
| status           | ⬜       | draft (default) or published                  |
| master_name      | ⬜       | Variants only — e.g. "Hinged Box"             |
| variant_label    | ⬜       | Variants only — e.g. "250ml"                  |
| tags             | ⬜       | restaurant,cloud-kitchen,hotel…               |
| na_fields        | ⬜       | brand,specifications,image                    |
| image_url        | ⬜       | drive.google.com/thumbnail?id=FILE_ID&sz=w800 |
