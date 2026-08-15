# XL Traders B2B — Master Project Blueprint

**Single source of truth. Lives as `CLAUDE.md` at repo root AND in the Claude Project.**
**Last updated: July 15, 2026** · Update after every merged PR (Shipped + Roadmap only).

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
specifications JSONB (nullable — not yet populated),
order_unit TEXT NOT NULL DEFAULT 'pack' CHECK IN ('pack','pcs'),
order_step INTEGER (nullable — NULL = one pack, inherits quantity_in_unit),
price_per_piece NUMERIC GENERATED ALWAYS AS (price / quantity_in_unit) STORED
                        -- 🔴 NEVER granted to anon; sorting only
```

**Ordering columns (V3 Phase 2, 15 Aug 2026).** `order_unit` is how the CUSTOMER
counts — it does **not** change what is stored or priced. Money is **always**
`packs × price`. `order_step` is pieces per stepper click and must be a whole
multiple of `quantity_in_unit`; NULL means one pack. All conversion lives in
`client/src/lib/orderingModel.ts` and nowhere else. See
[`docs/ORDERING_MODEL.md`](docs/ORDERING_MODEL.md).

### Other V3 Phase 2 objects (15 Aug 2026)

```
v_category_live_counts  VIEW  (category_id, live_products) — published AND active.
                              The ONE storefront category-count rule; a category
                              absent from it has 0 live products and must not render.
promo_banners           TABLE image_url, headline, rate_line (FREE TEXT — never a
                              computed price), link_target, position, is_active
                              (default FALSE), sort_order, starts_at, ends_at
orders.user_id          uuid  → auth.users, nullable (NULL = guest checkout)
site_content 'site_theme'     {"theme":"default|diwali|holi|monsoon|independence"}
storage buckets               category-images, banner-images (public read,
                              is_admin() writes)
```

**Unit of sale — canonical rule (owner decision, 25 Jul 2026):**
`price` is **the price of ONE SELLING UNIT (the pack / case)**, never a per-piece
rate. `quantity_in_unit` is descriptive — how many pieces are inside that pack.
`moq` counts **selling units**, not pieces. The per-piece figure shown on
ProductCard / ProductDetail is derived (`price ÷ quantity_in_unit`) and is never
stored. This is what `ProductCard`, `ProductDetail` and `cartStore.getTotal()`
(`price × quantity`) already assume, and what 131 of the 142 live products follow.
The 11 `Hinged box` variants were entered per-piece and their prices conflict with
their standalone duplicates. **Do not script or auto-merge that reconciliation** —
those are pricing calls the owner makes by hand during the rebuild. This is a
_judgment_ rule, not data protection: the rest of `products` is expendable
(Critical Rule #13). Leave those rows alone rather than guessing at a price.

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
3. **Price security is enforced by Postgres, not by TypeScript.** The real boundary is
   **column-level SELECT grants** on `products`: the `anon` role has no grant on `price`,
   `mrp`, `moq`, `barcode`, `bulk_price` or `bulk_threshold`, so an anonymous request for
   those columns fails with a permission error no matter what the client sends.
   `productSelectCols()` narrows the SELECT list to match, which keeps guests from
   triggering that error — it is a UX convenience, **not** the gate. Never weaken the
   grants on the assumption that the TS helper is protecting anything.
   Null price ≠ public price. (Verified against the live DB, 25 Jul 2026.)
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
  - **Storefront design system foundation (July 2026, PR1 of `docs/STOREFRONT_DESIGN_PROPOSALS.md`):**
    presentation-only pass across Home/Header/Footer/ProductCard/Catalog/ProductDetail —
    4 new `@theme` type-scale tokens (`text-caption`/`text-body-sm`/`text-body-md`/
    `text-display`, `client/src/index.css`) replace ~90 one-off `text-[Npx]` arbitrary
    values sitewide; a documented 3-step section-spacing rhythm (`py-8` /
    `py-12 md:py-16` / `py-14 md:py-20`); the ~14 hand-rolled
    `max-w-7xl mx-auto px-4 lg:px-8` occurrences consolidated onto the existing
    `.container` utility. New shared `SectionEyebrow` component standardizes the
    section-label pattern (light/dark tone). Removed the duplicate rating/businesses
    trust badge (was rendered in both the hero and the trust strip directly below it —
    now only the trust strip). Catalog's "No products found" empty state gained the
    same WhatsApp-fallback CTA the header search empty state already had. Reduced-motion
    audit: `HeroMotionTiles`' image crossfade and every Home/`HomeCategoryGrid`
    framer-motion entrance animation now skip translate/scale (opacity-only) under
    `prefers-reduced-motion`. See `docs/DESIGN_SYSTEM.md` §1.2/§1.4 for the token
    reference.
  - **Interactive catalogue showcase (July 2026, PR2 of `docs/STOREFRONT_DESIGN_PROPOSALS.md`):**
    `HomeFeaturedProducts` (fake Best-Sellers/Trending/New tabs — a client-side
    heuristic that fetched the ENTIRE catalogue unpaginated on every Home load)
    replaced by `HomeCatalogueShowcase`: category chips (group chips from
    `getCategoriesGroupedByGroup`, flat-category fallback when no groups exist) +
    a chip-filtered grid of the real `ProductCard` (price gate / On-Enquiry / cart
    stepper all inherited), fed by the same paginated `productService.getAll`
    call `/catalog` uses (`pageSize: 10`, `sort: "newest"`); 10 products desktop
    (2×5), first 6 on mobile via CSS; `ui/skeleton` loading grid; WhatsApp-CTA
    empty state; always ends in a "View all in [group] →" link into `/catalog`
    (taster, not a second catalogue). Plus: ProductCard hover micro-interactions
    (`motion-safe:` image zoom + `hover:border-red-200` + motion-safe lift),
    Catalog's plain "Loading products..." text replaced with a
    ProductCard-footprint skeleton grid, and Catalog's mobile Filters/group-chip
    row is now sticky below the mobile header (`top-[116px]`, z-20) so filtering
    stays reachable while scrolling long lists.
  - **Hero evolution + polish (July 2026, PR3 of `docs/STOREFRONT_DESIGN_PROPOSALS.md`,
    hero Concept C):** the ambient red/amber blob glows behind the hero (`bg-red-100/50`
    and `bg-amber-100/40` blurred circles) are removed — `HeroMotionTiles` is now the
    sole focal point against a quiet gradient wash. `HeroMotionTiles` gains a **wildcard
    beat** (desktop only): once every 5 rotations the last tile swaps its photo for a
    live stats card (`{published product count}+ products across {category count}
categories` → links to `/catalog`), sourced from the same public
    `productService.countPublished()` / `categoryService.getAll()` calls used elsewhere;
    silently absent if either call fails or returns 0, mobile stays purely photographic
    via `hidden md:flex`. Tiles gain a `hover:ring-1 hover:ring-white/40` + motion-safe
    lift. **HomeCategoryGrid mosaic palette** (touch #7): the old 10 arbitrary hue pairs
    (blue/purple/indigo/lime, outside the documented palette) replaced with a curated
    4-tone rotation from the actual brand palette (red/amber/emerald/slate, per
    `docs/DESIGN_SYSTEM.md` §1.3). **FAQ mesh accent** (touch #8): a single subtle
    red↔amber radial-gradient wash behind the FAQ section — the only page-level
    ambient/background gradient besides the hero (distinct from the per-tile category
    mosaic gradients above), applied once and kept quiet. **Marquee refinement**
    (touch #11): brand/value-prop entries now render as bordered pill chips (icon dot +
    label) instead of plain text, animation slowed 28s → 34s for readability. Skipped:
    touch #9 (glassmorphism) — deferred with hero Concept B, not built this pass.
    **Dead-code cleanup:** the 7 unused `home/` components identified during the design
    audit (`HomeHero`, `HeroBrandsSlider`, `HeroTrustStrip`, `HomeUseCases`,
    `HomeBrandSection`, `HeroProductShowcase`, `HeroTopBar` — never imported by any route)
    plus their two orphaned support files (`heroConfig.ts`, `useAnimatedCounter.ts`)
    deleted after grep-verifying zero importers; recover from git history if ever needed.

  - **Storefront PR-0 — §2.4 anti-pattern cleanup (July 2026):** presentation-only pass fixing
    the four defects `docs/STYLE_REFERENCE.md` §2.4 flagged in our own build. All four were
    verified live before any code changed; none was scrapped. **Category tiles (`HomeCategoryGrid`)**
    no longer composite a fake 2×2 mosaic — a category only ever carries one `image_url`, so the
    mosaic rendered that same photo 4× at 220% zoom (measured live: 23 of 25 tiles, and
    `maxUniqueSrcsAnyTile === 1`, i.e. it could _never_ show four distinct images; packaging text
    came out sliced into nonsense). Now one `aspect-[4/3] object-cover` image with the existing
    lucide `FALLBACK_ICONS` layered _underneath_ it, so a missing or failed image reveals the icon
    with no JS toggling (STYLE_REFERENCE §4.3 fallback chain). **The desktop group row stretches:**
    it was a flex row of fixed-width `w-44 xl:w-48` tiles left-aligned inside a wider container —
    192px of dead space per row at 1440px, ~500px at 1920px, and _clipping_ around 1000px. It is now
    a `1fr` grid whose column count is derived from the tile count (`GROUP_COLS`, static class
    strings; `pickTop` caps a group at 5), so the row reaches the container edge at any width and
    any group size — verified 0px dead space at 1000 / 1440 / 1920. **`unit_of_measure` no longer
    leaks into the brand line** (`ProductCard` rendered `Fortune Petpack · pcs`). **`Generic` is
    suppressed everywhere** — it is a null-brand placeholder, not a supplier; the new
    `lib/brandUtils.ts` (`brandLabel` / `realBrands`) is the single rule, applied on `ProductCard`,
    `ProductDetail`, the Home brand chips and the marquee. Filtering happens at the render sites —
    `productService.getBrands()` is untouched, so admin still sees the stored value.
    Also in this pass: a **permanent spec line** (`N pcs/pack · MOQ n`) on `ProductCard` in **every**
    auth state — pack/MOQ used to live inside the price block, so signed-out visitors got none of
    it, which matters on a catalogue of near-identical black containers (STYLE_REFERENCE §3.1 #5,
    §2.2-B2); and the **On-Enquiry price is now amber** per `docs/DESIGN_SYSTEM.md` §1.3 (was slate
    italic). `isPriceOnEnquiry` remains the only price rule and no `₹0` path was touched.
    `docs/STYLE_REFERENCE.md` is committed in this PR with four of its open items closed by
    evidence: the §3.1 **stock badge is dropped** (no such field exists on `Product`), the per-piece
    **divisor bug is data-only** (the code already guards `quantity_in_unit > 1`), the §5 token
    proposals are reconciled against the real `@theme`, and the category-tile column count is
    recorded as a deliberate deviation. Two findings logged but **not** fixed: Google-Drive-hosted
    images fail on localhost yet load fine in production (90/90 vs 0/18 — never judge image work
    from a local screenshot), and **two competing `.container` rules ship** (ours plus Tailwind's
    own utility, whose caps win: 640/768/1024/1280/**1536**px, not the documented flat 1280) —
    see `docs/DESIGN_SYSTEM.md` §1.4.

  - **Storefront PR-1 — trust / hero (July 2026):** the §2.4 item-5 duplication is closed and
    the delivery promise is now the page's dominant element. **Verified against live `main`
    first:** `500+ businesses served` rendered **3×** (trust strip, marquee, stats block), the
    `4.8` rating and `10+ years` **2×** each, and `GST invoice on every order` **3×**. The slim
    **trust strip** under the hero and the **scrolling marquee** are **deleted** — §2.3 rejects
    the marquee precisely because it repeated the static row directly above it — leaving the
    "Why XL Traders" section as the single place trust content appears; its four stat cards
    became one divided band, since they are one credibility statement rather than four facts to
    compare. Measured after: `GST invoice` 3→1, rating 2→1, marquee nodes 1→0.
    **Hero:** the promise leads at `text-4xl → md:text-5xl → lg:text-display` with the category
    headline stepped down to `text-lg/xl` beneath it, both inside one `<h1>` so the heading stays
    meaningful to a first-time visitor and to search. The three delivery tiers moved out of the
    Service Areas card (which now answers "where", not "how fast") to sit under the promise.
    **The promise is admin-editable** (`hero.promiseLead` / `promiseAccent` / `promiseTiers`) —
    the largest element on the site must not be hardcoded copy.
    **Mobile-first, one component tree** (§5): Tailwind breakpoints only, no `useIsMobile`
    branch. `HeroMotionTiles` is `hidden lg:block` — at 390px it cost a full extra screen before
    the first product. The **catalogue showcase moved above the category grid**: measured at
    390px the grid is 1092px on its own and pushed the first product card to **2.63 screens**;
    products now appear at **1.34** screens and the first real price at **1.34** (§5 density
    intent). The grid's own layout is untouched — that is PR-3.
    **Two admin fields were retired rather than left orphaned:** `trust_badge` (its rating and
    businesses-served facts are the same ones `trust_stats` carries — rendering both _was_ half
    the duplication) and `hero.bullets` (the delivery tiers took that row, and its content
    repeated the trust points). Both keys remain in `settingsService` marked `@deprecated` so
    existing `site_content` rows stay readable; neither renders and the Site Content editor no
    longer offers them.
    **Bug found and fixed in passing:** `settingsService.getAllContent` merged stored content
    over the fallbacks with a shallow `{ ...FALLBACKS, ...all }`, so a stored row **replaced**
    the whole object. Adding a sub-field to an existing key therefore made it `undefined` for
    every row saved before that moment — the live `hero` row carries only its original four
    sub-keys, so `hero.promiseTiers.map()` would have thrown **on production** while rendering
    perfectly against the local fallback. Now merged per field (`mergeOverFallback`); arrays are
    still replaced wholesale so a stored 3-item list can't have fallback entries bleeding in
    underneath it.
    Screenshots: `docs/screenshots/pr1-home-{signedout,signedin}-{390,1440}.png`.

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
  _additional_ editing surface beside the Products table (does not replace it). Left
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
  - the Radix context-menu/dropdown-menu primitives were already in `package.json`); mobile admin
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
- **Dukaan-style Catalog Editor re-skin (July 2026):** visual-only pass modeled on
  web.mydukaan.io's product list — every feature (tree, inline edit, chips, saved views,
  bulk bar, keyboard nav, panel, Ctrl+K, context menu) unchanged. **Name cell:** brand-red
  link-look name (click still = inline edit) with a gray subtitle underneath showing
  category/SKU whenever that dedicated column is hidden in the Columns menu; hover-only
  Duplicate/Open buttons dropped (redundant with the row menu). **Status:** the badge became
  a one-click shadcn `Switch` + Published(green)/Draft(gray) label, wired to the existing
  `handleTogglePublish` which now offers Undo on its success toast (Phase A pattern; no
  confirm — a switch flip is reversible). **Actions column:** new always-visible row-end
  icon set — Open panel / View live (Eye) / "⋯" menu (moved out of the Name cell), same
  handlers, not hideable/resizable. **Pagination:** footer is now "Viewing 1–50 of N
  results" + Previous / numbered pages with ellipsis / Next (red current page), same
  pagination state. **Chrome:** quiet `bg-slate-50` header band (STICKY_CELL no longer
  hardcodes a bg), lighter sticky-column divider (`border-r-slate-100`), white footer.
  Screenshots: `docs/screenshots/catalog-editor-{before,after,after-status,after-compact}.png`
  (captured locally via demo data + a temporary never-committed auth bypass).
- **Catalog Editor layout fixes (July 2026):** two bugs surfaced right after the Dukaan
  re-skin. **Dead space on wide screens:** `AdminDashboard`'s content wrapper caps every
  tab at `max-w-screen-xl` (1280px) and centers it — fine for reading-width forms
  (Overview, Settings) but was capping the Catalog Editor's data table too, leaving equal
  margins on both sides at 1440px/1920px. The Catalog Editor tab now skips that cap.
  `<DataTable>` also gained a `fillWidth` calculation (ResizeObserver on the scroll
  container + `table.getTotalSize()`): when the columns' natural width sums to less than
  the container, the leftover pixels go to a column the consumer marks `meta.flex`
  (`CatalogTreeEditor` marks Description) instead of sitting empty; falls back to
  distributing proportionally across non-sticky, resizable columns if none is marked.
  When columns genuinely need more room than the container has, nothing changes — the
  container still scrolls horizontally exactly as the Phase C resize work left it. The
  `<table>`'s width is now `Math.max(naturalTotal, containerWidth)`, replacing the fixed
  `table.getTotalSize()` from Phase C. **Columns-menu reliability:** the "Show columns"
  list was raw `<button>`s inside `DropdownMenuContent`, not real Radix menu items — an
  imprecise click could dismiss the menu without registering the toggle, and every pick
  required reopening the menu. Swapped for `DropdownMenuCheckboxItem` (already in
  `ui/dropdown-menu.tsx`, unused until now): proper `role="menuitemcheckbox"` semantics,
  and `onSelect={e => e.preventDefault()}` keeps the menu open so multiple columns can be
  checked in one pass. No column-visibility _state_ bug was found — `columnVisibility` and
  the render were always in sync once React finished a render pass; the dead-space bug
  (columns scrolled out of the container to the right of a sticky Name column) is the far
  more likely explanation for what looked like "selected columns not rendering."
- **Catalog Editor blank-scroll fix (July 2026):** the admin window scrolled thousands
  of blank pixels past the pagination footer. Culprit was NOT the bulk-bar spacer /
  fillWidth / max-w suspects — it was `CommandDialog` (`ui/command.tsx`) rendering its
  a11y `DialogHeader className="sr-only"` as a direct `<Dialog>` child, i.e. inline at
  the mount point even while closed. Tailwind `sr-only` = `position:absolute`; with no
  positioned ancestor its containing block is the document root, so `<main>`'s
  `overflow-y-auto` couldn't clip it, and its static flow position (below the entire
  table) stretched `documentElement.scrollHeight` — dead window scroll that grew with
  table length. Fix: moved the sr-only header inside `DialogContent`, which is also
  where Radix needs Title/Description for the dialog to be announced (aria-labelledby/
  describedby now resolve). Verified at 1440/1920, 0 and 50 selected, both densities,
  short and long lists; screenshots
  `docs/screenshots/catalog-editor-blank-scroll-{before,after}.png`.
- **Catalog Editor sticky-right columns + scroll ergonomics (July 2026):** with
  several columns visible, Status and the row-actions (⋯/Open panel/View live)
  scrolled off past the right edge — reaching them meant scrolling all the way
  down to the bottom horizontal scrollbar first. **`<DataTable>` gains a
  generic `meta.stickyRight`** (mirror of the existing `meta.sticky` for the
  left edge): Status and the actions column now pin to the right with the same
  border-separator treatment sticky-left already has, computed the same way —
  offsets walked from the right edge, accumulating only for stickyRight
  columns so hidden/shown columns in between don't disturb the pinning.
  `score`/`updated` (hidden by default) were reordered to sit _before_ Status
  in the column array rather than between Status and Actions — CSS sticky can
  only hold a pinned column flush against another pinned one up to how far
  you've actually scrolled, so a non-sticky column wedged between two
  stickyRight columns left a gap on tables that didn't overflow by much;
  keeping the two stickyRight columns adjacent in DOM order sidesteps that
  entirely (verified both ways live before landing on the reorder). **Flex-fill
  cap:** the Description auto-fill (from the prior fillWidth fix) could
  balloon to absurd widths on a wide screen with few other columns visible —
  now capped at `min(480px, 40% of container)`; any leftover past the cap
  flows into the existing proportional distribution across other untouched,
  unpinned columns instead of being wasted. **Sticky bottom scrollbar:** a
  thin synced scrollbar (`scrollLeft` mirrored both ways, guarded against
  feedback loops) now sits `position: sticky; bottom: 0` right below the table
  — bounded to the table's own height via a shared `relative` wrapper, so it
  shows only while the table itself is in view, not the whole page — so the
  real scrollbar is reachable without scrolling to the bottom of a 50-row
  table first; only rendered when the columns genuinely overflow the
  container. Shift+wheel horizontal scroll already worked natively (browser
  default over any `overflow-x: auto` container) — verified live, no code
  needed. Verified live (headless Chrome, real mouse/scroll events) at 1440px
  and 1920px, default and many-columns-revealed, both densities: Status/
  actions stay flush at the right edge regardless of scroll position or which
  optional columns are shown; sticky-left Name unaffected; Description never
  exceeds its cap; the bottom scrollbar drags the main table and vice versa.
  Screenshots `docs/screenshots/catalog-editor-{sticky-right-1440,
sticky-right-many-cols,flex-cap-1920}.png`.
- **DataTable viewport scroll fix (July 2026):** PR #115 had switched the `<DataTable>`
  viewport from `overflow-x-auto` to `overflow-x-hidden` plus a manual `onWheel` handler
  (sticky bottom bar as sole horizontal control). That silently broke touch panning —
  `overflow-x: hidden` disables native swipe-to-scroll and the handler only covered wheel
  events — which matters because the Catalog Editor is also the _mobile_ products surface;
  the handler's `preventDefault()` was also a no-op (React registers wheel listeners as
  passive), risking macOS swipe-back navigation mid-scroll, and it ignored `deltaMode`
  (Firefox line-mode wheels crawled). Reverted to `overflow-x-auto` with the existing
  `.scrollbar-hide` utility instead: same visual outcome (no duplicate native scrollbar;
  the sticky bottom bar remains the one visible control) while touch panning, Shift+wheel,
  momentum, and deltaMode normalization stay native. The wheel handler is deleted.
- **Inline-edit safety (July 2026, PR-A of the 25 Jul 2026 data-entry UX audit —
  audit doc lives on branch `docs/data-entry-ux-audit`, not yet merged):**
  data-integrity fixes to the Catalog Editor's inline table editing, ahead of the
  142-product catalogue cleanup. Component logic only — no service, schema, or storefront
  change. **A typo in the Price cell no longer wipes the price (DE-01):** the editor was
  `<input type="number">`, and a number input reports `value === ""` for anything the
  browser can't parse, so `abc` arrived at `commitEdit` as blank → NULL → "On Enquiry",
  with the existing `isNaN` guard unreachable for that input type. The numeric editor is
  now `type="text"` + `inputMode="decimal"`, and validation moved into a pure
  `validateEdit()` that refuses blank, non-numeric (`Number()` not `parseFloat`, so
  `12abc` is rejected instead of saving as 12) and `<= 0`. **"On Enquiry" is now only
  reachable via the deliberate toggle in `CatalogProductPanel` — a price can no longer be
  cleared to enquiry from the table.** **Dropped keystroke (DE-04):** `InlineInput` focused
  via `setTimeout(focus, 20)`, leaving the input mounted-but-unfocused for ~20ms;
  `autoFocus` lands before paint instead. **Double save on every Enter/Tab (found in
  review, not in the audit):** `handleGridKeyDown` called `commitEdit()` then moved DOM
  focus, and that focus change fired the editor's `onBlur` → a second commit from the same
  render's closure (where `cellEdit` was still set and `products` still pre-patch, so
  neither the null-check nor the no-op guard caught it) → two `productService.update()`
  calls and two toasts per keyboard commit; guarded with `committingRef`. The key handler
  now validates synchronously _before_ advancing, so a refused value holds the cursor for
  correction and the error toast fires once; `commitEdit()` is still unawaited so the
  cursor moves at typing speed. **Save feedback (DE-02):** the `toast.success("Saved")`
  did already exist (contrary to the audit's reading) — added Undo on it (same pattern
  `handleTogglePublish` uses) plus a 1.2s row pulse, and a failed save now reverts only the
  affected row instead of `loadProducts()`, which used to discard every other edit in
  flight. `toggleAvailability` gets the same treatment; it had no success feedback at all.
- **Bulk import:** Google Sheets + CSV; master_name + variant_label columns; price/moq/category optional; all imported → draft
- **SKU-respecting upsert import** (PR #60): re-import updates existing rows by SKU instead of duplicating; dry-run preview
- Tab persistence, optimistic updates, auto-resize images to 800px
- **Catalog Workbench (July 2026, PR-3):** an image-first _mode_ inside the Catalog
  Editor (`?tab=catalog-editor&catMode=workbench`) — not a route, not a second admin.
  Three panes: product queue (240px, fixed) │ large `object-contain` image │ fields.
  Reuses the PR-A safety layer wholesale (`validateEdit`, `committingRef`, Undo toast,
  row pulse) plus `useProductForm`, `CategoryCombobox` and `AdminImageLibrary`; uploads
  go to `products/{SKU}/{SKU}.webp` via `storageService.uploadBySku` (one folder per SKU,
  so `XL0105` slot 2 can't collide with SKU `XL0105-2`), and an existing file for the
  current SKU is offered for attach instead of a silent overwrite. Enter on any
  single-line field = Save & Next; the description textarea keeps Enter and uses
  Ctrl/Cmd+Enter. Setting a primary image persists immediately (one-column patch) so an
  upload isn't lost by clicking the next product.
  **Ergonomics pass (same PR):** the shell is **locked to viewport height**; queue and
  fields scroll independently, the image pane doesn't scroll at all, and Prev / Save /
  Save & Next sit in a **sticky footer** outside the fields scroll area.
  A **draggable divider** rebalances image ┃ fields,
  clamped so neither drops below its minimum (340 / 320) and persisted to the URL
  (`wbW`, written on pointer-up only — no localStorage). **Focus mode:** the category
  tree is table-mode only (four panes crushed the fields pane), replaced in Workbench by
  a scope `<Select>` in the toolbar that writes the _same_ `selection` state the tree
  does — no parallel filter — and the selected node now persists to the URL (`catNode`,
  `all` | `g:<group>` | `c:<uuid>`) for both modes. Validation errors render **inline
  beside the field** (red border + `aria-invalid` + message) as well as in the toast, and
  a refused save focuses the first offending field. Tab order is
  Name → Price → Pack qty → MOQ → Unit → Brand → SKU → Category → Description →
  Published → Save → Save & Next, verified against the rendered DOM;
  `CategoryCombobox` gained an additive `openOnFocus` prop (default `true`, unchanged
  everywhere else) which the Workbench sets `false` so Tab passes through the picker
  instead of falling into its search list.
  **Space + zoom pass (same PR):** the viewport lock is now **pure CSS** — an unbroken
  flex-column chain (`AdminDashboard` `h-dvh` → column `min-h-0` → `<main>`
  `flex flex-col` → the catalog-editor wrapper `flex-1 min-h-0 overflow-y-auto` →
  `CatalogTreeEditor` `flex-1 min-h-0` in workbench mode → the shell `flex-1`). The
  previous JS measure-above-and-below set an explicit pixel height, which is correct
  exactly once: it never re-derived on browser **zoom**, so at 90%/110% the shell kept a
  stale height and left a blank band below it. Note `<main>` is the flex column and the
  scroll box moved onto the wrapper — a scroll container needs a _definite_ height for a
  `flex-1` descendant to be capped by it; `min-h-full` is only a minimum and let the
  shell grow ~700px past the viewport. **Workbench chrome is one compact line** (icon,
  title, scoped count, scope select, mode toggle, refresh): the full header + saved-view
  tabs + search toolbar + Fix-Missing chips came to ~380px that came straight out of the
  image pane, and all of them belong to the table — search / status / missing /
  quick-add remain in Table mode. **Image pane:** the border and background now sit on
  the `<img>` itself rather than on a fixed-size container it floated inside, so the
  bordered box _is_ the picture; the fields-pane default is viewport-aware (460px on wide
  screens, 380px below 1250px of shell, since a narrow image pane is width-starved while
  a wide one only gains margin). Below `LIST_W + FIELDS_MIN + IMAGE_MIN + divider`
  (908px of shell — reached at 150% zoom on a 1366 laptop) the layout **stacks** rather
  than squeezing; three-across had left the image pane 37px wide. **Select-image dialog**
  is now a real picker: 90vw × 85vh (max 1400px), an `auto-fill` grid that reflows with
  no horizontal scroll, filename search, size toggle, click-to-preview aside before
  committing, arrow/Enter/Esc keyboard nav, and files whose name matches the current SKU
  sorted first with a "Matches SKU" badge (`skuHint` prop; loose match ignoring case and
  separators). Two CSS-layout bugs surfaced there and are fixed: `overflow-hidden` on a
  grid item drops its automatic minimum size to 0, and the grid's default
  `align-content` then stretched 34 zero-base rows to 4.6px each — `min-h-fit` on the
  card plus `auto-rows-max` on the grid. **Polish:** 150ms transitions on hover/focus, a
  real focus _ring_ on every field (a border-colour shift alone is easy to miss
  mid-entry), Save / Save & Next disabled with a spinner for the whole commit (`busy`
  covers the post-request patch/toast/refresh window, not just `saving`, so a second
  click can't fire a duplicate update), clearer queue hover/selected states, and
  written-out empty states.
  **Polish pass (July 2026, PR-4):** presentation only. **Full-bleed Catalog Editor** —
  the tab's wrapper drops to `px-4 py-4` (no width cap; other admin tabs keep
  `max-w-screen-xl px-6 py-6`), so table and workbench span the viewport minus the
  sidebar exactly. **Full-page lightbox** replaces the old `max-w-5xl` zoom dialog:
  dark full-screen backdrop, filename and `n / total` in the header, Esc or a backdrop
  click to close, arrow keys (and on-screen chevrons) through primary + gallery. The
  image list is deduped and the index is reset when the product changes or the gallery
  shrinks. **Three overflow menus**, all built from components already in the repo:
  the queue row renders the Catalog Editor's own `renderRowMenuItems` — passed down as
  a `rowMenuItems` render prop, same signature as `<DataTable>`'s `rowContextMenu` —
  plus an "Open in Table" item that switches mode and seeds the search; each gallery
  thumbnail gets Set as primary / Replace / Remove (Replace re-uploads to the same
  storage key **and** patches that `product_images` row via
  `productImageService.update`, so the image keeps its position — patching the row is
  the part that matters, since re-uploading alone still appended a second row pointing
  at the same file; if the replaced row was also the primary, `image_url` is refreshed
  too, because `uploadBySku` cache-busts the URL); the workbench header's Refresh and
  Switch to Table moved into a `⋯` menu. The queue row became a `<div>` wrapping a
  `<button>` — a menu trigger is itself a button and cannot nest inside one. None of
  the triggers are hover-gated: this component is also the mobile products surface, so
  `group-hover` would never resolve there. The queue trigger is a 44px target, and the
  whole 64px gallery tile is the trigger rather than a 22px badge on it.
  **Fields pane is sectioned** — Basics / Pricing / Publishing, each with a title and a
  one-line description, with **Media** heading the image pane. Note this changes tab
  order to follow visual order: Name → Brand → SKU → Category → Description → Price →
  Pack qty → MOQ → Unit → Published → Save → Save & Next. **44px inputs throughout**;
  `SelectTrigger` needs `data-[size=default]:h-11` because its own
  `data-[size=default]:h-9` is an attribute selector that outranks a bare utility, and
  `CategoryCombobox` merges through `cn()` so a plain `h-11` suffices there. **Panes are
  separate white cards** on the `admin-bg` page with a `gap-3` between them; the shell
  itself is transparent. Queue rows are 64px with a 44px thumbnail, and the queue width
  is viewport-aware (280px, 240px below 1250px of shell) because the wider queue
  otherwise costs the image 40px on a 1366 laptop. **No pricing behaviour changed** —
  the price/pack-qty/MOQ/unit inputs, their validation and the derived readout moved
  into the Pricing section verbatim; only field height changed.

- **Table-mode fit + parity pass (July 2026, PR-4b):** DE-07 closed. **Default columns**
  are now thumbnail+Name, Category, Unit/Pack, Price, Status, actions — Stock and
  Description moved behind the Columns control (nothing removed, only the default
  changed); the old default set summed to 1330px and could not fit a 1366 laptop beside
  the tree, which was the permanent horizontal scrollbar. **Name is the flex column**
  now instead of Description, and `<DataTable>` gained **shrink-to-fit**: it already
  grew the flex column to absorb dead space, but never shrank it, so a default set
  wider than the container just overflowed. It now takes the deficit out of the flex
  column down to its `minSize`, and `hasHorizontalOverflow` (which gates the sticky
  bottom scrollbar) is computed _after_ that — so the bar no longer appears with
  nothing to scroll. **The Name never truncates**: no line clamp at all, wrapping to as
  many lines as it needs, with rows keeping a 64px floor and growing only when a long
  name meets a narrow column. The always-on feature star left the Name cell (it is an
  indicator now; the toggle lives in the row menu) — it was costing ~28px of the one
  column that must not run out of room. **Collapsible category tree** (`catTree=0` in
  the URL, default expanded, `w-56` when open) with a thin rail carrying a reopen
  button and a dot when a scope is active; collapsing hands ~230px to the table.
  **Shared visual language with the Workbench**: 64px rows, 44px thumbnails, row hover
  and an unmistakable selected tint that sticky cells follow (they previously punched a
  white hole through it), 150ms transitions. **Compacted chrome**: the title block is
  one line with the product count (the strapline is gone), root spacing `space-y-4` →
  `space-y-2.5`, tighter toolbar padding, and the duplicate scope heading above the
  table now appears only when the tree is collapsed. Measured with default columns and
  live rows — 0px horizontal scroll and 0 truncated names at 1366x768 and 1920x1080 at
  100%, at 1920x1080 at 125%, and at 1366 with the tree collapsed; at 1366 **@125%**
  the container is 583px (tree open) / 767px (collapsed) against a 847px floor for six
  columns, so the bottom scrollbar correctly remains there.
- **Workbench field sections regrouped (owner decision, 26 Jul 2026):** **Product**
  (Name, Price, Pack qty, MOQ, Unit) → **Details** (Brand, SKU, Category, Description)
  → **Publishing**. Entry happens photo → name → price → pack qty, so those lead and
  nothing rarely-touched sits between them; Brand/SKU/Category rarely change once set.
  Tab order follows the same path.
- **Sticky table header + drag-drop upload (July 2026, PR-4c):** **Sticky header.** The
  `<thead>` already carried `sticky top-0`, but it never stuck: the table's viewport is
  `overflow-x-auto`, and per CSS `overflow-y: visible` computes to `auto` when the other
  axis isn't visible — so that div was already a scrollport, just one with no height
  constraint. The header pinned to the top of a box that itself scrolled off the page.
  `<DataTable>` gains **`fillHeight`**, which turns the body into the real vertical
  scroller (root → `relative` wrapper → viewport all become a `flex-1 min-h-0` column),
  and Table mode joins Workbench mode in claiming the viewport (`CatalogTreeEditor`
  root + two-pane row + table pane are a flex-column chain; the tree aside stretches and
  scrolls on its own). Consequence worth knowing: the chrome above (title, tabs, toolbar,
  chips) no longer scrolls away — it and the pagination footer are now always on screen,
  and the rows scroll under a pinned header instead. `fillHeight` is **off below `md`**
  (`useIsMobile`): `MobileAdminShell` renders its children in a plain block inside a
  scrolling `<main>`, where a `flex-1` item has nothing to resolve against and would
  flex-basis to 0 — mobile keeps page scrolling and an unpinned header. The bulk-bar
  spacer needed `flex-shrink-0` for the same reason (an empty div's automatic minimum is
  0 in a flex column). Verified by scrolling to the last of 50 rows at 1366/1920 ×
  100/125%, tree open and collapsed: header offset stays 1px, page overflow 0.
  **Drag & drop restored** (it was lost when the Select-image dialog's layout was
  rewritten as a picker; the standalone Image Library kept its dropzone throughout).
  Two places: the Workbench's **whole image pane** is a drop target (dragenter/leave
  counted, not a boolean, so crossing onto the filmstrip inside doesn't flicker the
  highlight off; the overlay is `pointer-events-none` so it can't swallow the drop), and
  the **Select image dialog** gains a compact dropzone row. Both route through the same
  SKU upload as the Upload button — `products/{SKU}/{SKU}.webp`, gallery as `-2`, `-3` —
  via a new `AdminImageLibrary` prop `onDropFiles` (plus `uploadHint`/`busy`); without it
  the library still does its own global upload, so the standalone surface is unchanged.
  Multiple files upload sequentially: the first takes the primary slot only if the
  product has none, the rest append; per-file toasts collapse to one summary.
  `addToGallery` now reads `display_order` from a fresh fetch rather than `gallery`
  state, which is stale from the second file of a multi-drop onward.

- **Dead space above the table + per-piece price entry (July 2026, PR-5):**
  **The gap was the bulk-bar spacer, not the collapsed tree.** The floating bulk
  bar is `fixed`, with a spacer of matching height reserving its space — but the
  spacer was rendered _before_ the two-pane row in a flex column, so ticking one
  checkbox inserted ~120px of blank page between the Fix chips and the table and
  pushed every row down with it. (The collapsed rail was already `w-10` and
  innocent; the reported repro had a row selected.) Moved after the panes, where
  it shortens them from the bottom — which is where the bar actually is — and
  keeps the pagination footer clear. **Table-mode chrome compacted** alongside
  it, nothing removed: the Fix-Missing chips moved into `<DataTable>`'s own
  toolbar row (which already existed and held nothing but the density/Columns
  buttons on its right), saving a whole band; title row, saved-view tabs and the
  search toolbar tightened (`h-9` → `h-8`, `py-2` → `py-1.5`); root gap
  `2.5` → `2`. `<DataTable>` now only inserts its right-pushing spacer when the
  consumer passes no `toolbarActions`. Verified live at 1366x768 (headless
  Chrome, demo data + a temporary never-committed auth bypass), tree collapsed
  and expanded, with and without a selection: no dead space above the toolbar,
  first row and pagination footer both above the fold. Screenshots
  `docs/screenshots/catalog-editor-fold-{tree-open,tree-collapsed,selected}.png`.
- **Per-piece price entry (same PR):** new `lib/priceEntryMode.ts` + an
  "Enter as: Per pack | Per piece" toggle (**default per piece**) in the
  Workbench fields pane and in the Table toolbar, sharing one URL param
  (`priceEntry`, no localStorage) so the mode persists across products, pages
  and both modes. **This changes only what is TYPED.** `products.price` is
  still the price of ONE SELLING UNIT in every path: a per-piece figure is
  multiplied back up by `quantity_in_unit` before `validateEdit`, the no-op
  guard, the optimistic patch or `productService.update` ever see it. No schema
  column, no per-product or per-category pricing basis, no change to cart,
  orders or the storefront. Blank still means On Enquiry (only via the
  deliberate panel toggle — DE-01 stands), and junk is still passed through
  verbatim so `validateEdit` refuses it rather than coercing. Pack qty missing
  or 1 → per-piece is unavailable (disabled with a hint in the Workbench;
  per-row fallback with a hint in the table, since it varies by row). Switching
  modes converts the value in the box instead of wiping it; the Workbench keeps
  both readouts visible with the derived side bolded, and the table's price
  cell shows a live `= ₹N/pack of 480` preview under the input while editing
  plus a `/pc` marker on the column header. **Display follows the mode too**
  (fixed immediately after the first pass, which shipped the toggle wired to
  the inline editor and the header label ONLY — so per-piece mode rendered
  `₹12` for a ₹12/pack-of-480 row under a `/pc` header, i.e. a rate 480x too
  high to type against): in per-piece mode the cell renders
  `price ÷ quantity_in_unit` via `perPieceRate`/`formatPerPiece` (2–4 dp, so
  ₹0.025 doesn't round to ₹0.03), and a row with no usable pack qty keeps its
  pack figure with an amber `/pack` marker rather than dividing by null. Known
  limitation, surfaced in the header tooltip: **sorting stays on the stored
  pack price**, because the sort runs in Postgres over the `price` column and
  a per-piece ordering would need `price / quantity_in_unit` computed there —
  so rows with different pack sizes will not appear in per-piece order.
  **All three editing surfaces now share the mode** — the table's inline cell,
  the Workbench fields pane, and `CatalogProductPanel` (the side drawer), which
  was the last one still taking a raw pack price with no signal that it did.
  The form-surface conversion lives in one place, `hooks/usePriceEntry.ts`,
  rather than being copied per surface: three hand-rolled conversions is
  precisely how one of them ends up storing a per-piece figure as a pack price.
  The drawer also gained a permanent one-line readout under its Price field
  ("Stores ₹12 for one pack of 480 pcs · ₹0.025/pc" — the phrasing the PDP
  price card uses, since `unit_of_measure` names the pieces INSIDE the pack and
  never the selling unit), and its price input moved from `type="number"` to
  `text` + `inputMode="decimal"` — the DE-01 hazard (a number input reports `""`
  for anything unparseable, so a typo arrives looking like a deliberate blank)
  was fixed in the table's inline editor but had been missed here. The drawer's
  `priceMode` prop is optional and falls back to per-pack when no change handler
  is supplied, so an unwired instance keeps its original semantics.
  **Round-trip safety (CodeRabbit, PR #121):** `pieceFromPack`/`packFromPiece`
  are NOT a lossless pair — display rounds to 4 dp, storage to 2 — so ₹4897 over
  a pack of 480 shows as 10.2021 and converts back to ₹4897.01. Converting
  unconditionally meant _opening a price cell and pressing Enter rewrote a price
  nobody typed_, and the no-op guard compares strings so it never caught it
  (₹5.25→5.22 and ₹1→0.99 on 900-packs were worse than the reported case).
  Widening precision only moves the boundary; instead both paths keep the
  original pack string beside the draft and reuse it verbatim when the
  displayed rate is untouched — `CellEdit.originalPack`/`.seededPiece` via
  `packValueOf()` in the table, `originRef` via `onChange` in `usePriceEntry`.
  Regression check: `npm run check:price` (`scripts/check-price-entry.ts`, run
  by Node's native type stripping — no test runner, no new dependency; note
  `tsconfig.json` only includes `client/src`, so this file is executed rather
  than type-checked). Deleting either guard makes it fail.
  **On-Enquiry is toggle-only (same review):** the drawer derived `onEnquiry`
  live from `formData.price`, so clearing the box to retype a price flipped it
  true mid-keystroke — the pricing block and the focused input unmounted under
  the cursor and the product silently became On-Enquiry. It is now explicit
  state, seeded from the product and owned only by the Switch, which is what
  `productValidation.ts` already required (a blank price is never coerced to
  On-Enquiry; DE-01). Turning the toggle OFF no longer writes a sentinel `"1"`
  (that showed up as a phantom ₹1, and as ₹0.0021 once per-piece display
  landed) — it just reveals an empty box, and the readout says in amber that an
  empty box saves as no price. The Workbench was never affected: its price
  field is unconditionally mounted. One implementation note: the
  displayed per-piece value is DERIVED from `formData.price` with a local
  draft override, because a half-typed `10.` round-trips through `Number()` as
  `10` — without the draft the decimal point can never be typed.

- **PIM P1 — Brands (July 2026):** first-class brand entity. Schema (owner-run, verified):
  `public.brands` (name/slug UNIQUE, certifications text[], is_active, sort_order; RLS:
  admin-manage + anon/auth read-active) and `products.brand_id` FK (ON DELETE SET NULL),
  backfilled. App: `lib/brandsService.ts` (categoryService-pattern: safe-fallback reads,
  throwing writes, `getProductCounts`, soft-delete `setActive`; `isUniqueViolation` for
  inline 23505); **Brands manager tab** in `/admin` (Catalogue group, mobile via "More") —
  list + counts + active switch + create/edit dialog (slug auto-derives until hand-edited;
  duplicate name/slug shows an inline field error, never a raw toast); **`BrandCombobox`**
  (CategoryCombobox clone + explicit "No brand" entry + "(inactive)" suffix for values
  pointing at deactivated brands) wired into `CatalogProductPanel` Basic; **bulk "Set
  brand"** in the Catalog Editor (replaces the free-text input) via new
  `productService.bulkSetBrand` with a paired-snapshot Undo (`brand_pair` — restoring
  brand_id or text alone would desync them); **Unbranded toolbar filter**
  (`brand_id IS NULL`, additive `unbranded` param on `getAllAdmin`/`getAdminMatchingIds`)
  and a hidden-by-default **Brand column** (amber "text only" marker for unmigrated rows).
  **Dual-write everywhere** (brand_id + legacy text in one update; "No brand" = NULL + '');
  free-text brand edits in the route editor clear `brand_id` so a stale link can't rebind;
  AI Paste resolves pasted brand names against the brands table. `products.brand` is
  retained deliberately until after storefront PR-2 (separate owner-run drop). Logo upload
  deferred to P4 (`logo_url` is plain text for now).

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

### Storefront V3 — Phase 2 data foundation (15 Aug 2026)

Schema/security only; no UI change. Full audit + phase plan in
[`docs/STOREFRONT_V3_PLAN.md`](docs/STOREFRONT_V3_PLAN.md); migration in
[`docs/sql/v3-phase2-schema.sql`](docs/sql/v3-phase2-schema.sql) with real
verification output in [`docs/sql/v3-phase2-verification.md`](docs/sql/v3-phase2-verification.md).
Additive only — nothing dropped, nothing backfilled, all 143 product rows reached
`order_unit='pack'` through the column DEFAULT, so the 11 Hinged box rows are untouched.
Adds `order_unit`/`order_step` (+CHECKs), `price_per_piece` (generated, **never granted
to anon** — proved by an `anon` probe, not just a grant listing), `moq` granted to anon
so the card can show an MOQ chip to guests, `v_category_live_counts`, `promo_banners`,
the `category-images` + `banner-images` buckets (category upload had been throwing since
it was written — the bucket never existed), the `site_theme` setting, and `orders.user_id`.
**Known limitation recorded, not fixed:** per-piece sorting ranks the 11 per-piece-entered
Hinged box rows first (sub-paisa rates) until the owner reprices them.

### Storefront V3 — dead code removed (15 Aug 2026)

`CartDrawer` (299), `AddToCartButton` (155), `HomeDailySuggestion` (105) and
`lib/dailySuggestions.ts` (226) deleted — 785 lines with no live consumer, verified by a
resolved import graph rather than substring greps. No behaviour and effectively no bundle
change (they were already tree-shaken); the gain is clarity, plus 2 of the 9 MOQ call
sites the ordering work must thread through.

---

## 🗺️ Roadmap (next, in order)

0. **PIM — phase order (authoritative):** `P1 brands (DONE, #135) → P2 series (CURRENT) → P3 spec fields → P4 images`.
   Work in exactly this sequence; do not reorder or merge phases.
   - **P1 — brands ✅ SHIPPED (#135).** First-class `public.brands` entity (table + RLS + seed +
     `products.brand_id` FK + backfill already applied by the owner via SQL Editor).
     App side: `lib/brandsService.ts`, Brands manager tab in `/admin` (Catalogue group),
     `BrandCombobox` picker in `CatalogProductPanel`, bulk "Set brand", `brand_id IS NULL`
     admin filter + hidden Brand column. **Dual-write transition (expand → migrate →
     contract):** every brand assign writes `brand_id` AND the legacy `products.brand` text
     in the same update ("No brand" = `brand_id NULL` + `brand ''`); the text column is
     retained deliberately and dropped only after storefront PR-2, in a separate owner-run
     migration. Canonical rule: **unbranded == `brand_id IS NULL`.**
   - **P2 — series.** (scoped later)
   - **P3 — spec fields.** (scoped later)
   - **P4 — images** (formerly "Phase 2 — PIM Image Management & QC", planned, grounded in the
     2026-06-25 Supabase audit; detail preserved verbatim below). No new tables. - **Prereqs (you, via SQL Editor — not the agent):** standardize 4 canonical `group_name` values
     (`Disposal & Food Packaging`, `Decoration`, `Cleaning`, `Packaging`); confirm `product-images`
     bucket public-read. - **A. SKU upload pipeline:** `autoResizeImage` gains a webp option; `isOwnImage(url)` host check;
     `storageService.uploadBySku` → `products/{SKU}/{SKU}.webp` (+ `_NN` for gallery), `upsert:true`,
     id-fallback when SKU null; `productImageService.assignOwnImage`. - **B. Image QC grid mode:** new `ProductsQCGrid` reusing AdminProducts' data/filters/selection (no fork);
     OWN / PLACEHOLDER / MISSING badge, group›category breadcrumb, draft/published toggle; `viewMode`
     toggle swaps table↔grid; Replace-image reuses the existing `AdminImageGallery` dialog with an
     "Upload own image" button; server-side "needs own image" filter ANDs with existing filters. - **Rollout:** division-by-division via the existing category filter; verify-before-live uses the
     shipped draft/publish bulk actions. ("No gallery" filter deferred to a follow-up.) - Brand logo upload also lands here (P1 ships `logo_url` as plain text only).
     0b. **Storefront rebuild — phase order (authoritative).** Work the storefront in exactly this
     sequence; do not reorder or merge phases. Composition guidance for each lives in
     [`docs/STYLE_REFERENCE.md`](docs/STYLE_REFERENCE.md).

   ```
   PR-0 bugs → A-1 asset audit → PR-1 trust/hero → PR-2 card
     → PR-3 category tiles → PR-4 mobile shell → PR-5 order again
   ```

   - **PR-0 — §2.4 bug fixes.** ✅ **SHIPPED** (see Shipped Features). The four anti-patterns
     live in our own build: fake 2×2 collage, non-stretching grid, `unit_of_measure` in the
     brand line, `Generic` rendered as a brand.
   - **A-1 — asset audit.** Comes _before_ any further visual work. Category/product imagery
     is Google-Drive-hosted and unmanaged; PR-0 measured **90/90 Drive images failing on
     localhost while loading fine in production**, so no image-dependent design can be judged
     locally today. Settles `STYLE_REFERENCE.md` §4.2 (bucket name, path convention, whether a
     `product_images` table is in scope) — the SQL half is owner-run, never the agent.
   - **PR-1 — trust / hero.** ✅ **SHIPPED** (see Shipped Features). Trust content collapsed
     from four appearances to one (the strip and the scrolling marquee are deleted), and the
     delivery promise rebuilt as the largest element on the page (§2.1-A6).
   - **PR-2 — card.** Owns `toCardModel` (`STYLE_REFERENCE.md` §4.1) **and the spec line.**
     The spec line itself already shipped early in PR-0 (it was the replacement for the
     `unit_of_measure` leak); PR-2 folds it, the On-Enquiry rule and the per-piece formula into
     the one pure mapper, then completes §3.1 — image proportion, action overlapping the image,
     and the mono / green-badge treatment.
   - **PR-3 — category tiles.** Owns **category product counts (G3)**. `STYLE_REFERENCE.md`
     §3.2 wants a count on every tile and §2.2-B1 says never render a category whose count is 0
     (`Bouffant Cap` / `Gloves` are the likely zero-count tiles). Blocked on data access, not
     design: `productService.countPublished()` exists and takes `categoryId`/`categoryIds` but
     is **per-category** — 25 calls for one Home render. Needs a grouped variant (one
     published+active query → `Record<categoryId, number>`), which is a **service addition** and
     so was correctly out of scope for presentation-only PR-0.
   - **PR-4 — mobile shell.** Bottom nav / sticky cart affordance (§2.1-A4) and the mobile
     category strip → 3-up grid. Same routes, `useIsMobile` for chrome only — never a fork.
   - **PR-5 — order again.** B2B repeat buying off cart + order history (§2.3 rejects wishlist
     as the answer here).

   **Unassigned, still open:** decide the `.container` cap (two competing rules ship — see
   `docs/DESIGN_SYSTEM.md` §1.4) and whether sub-11px type and a project `--font-mono` token
   enter `@theme`.

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

- ~~**Publish gate is TypeScript-only until the PR-1 SQL is applied.**~~ **RESOLVED —
  this entry was stale and is corrected here (verified against the live DB,
  15 Aug 2026).** `products` RLS now enforces the publish gate itself:
  `anon_read_published_products` USING `(is_active AND status='published')` and
  `auth_read_published_products` USING `(… OR is_admin())`. **Writes are admin-only** —
  the `auth_update_products` / `auth_delete_products` / `auth_insert_products` policies
  this entry warned about **do not exist**; the single write path is
  `Admins can manage products` USING `is_admin()`. The work prepared in
  [`docs/sql/pr1-rls-publish-gate.sql`](docs/sql/pr1-rls-publish-gate.sql) has been applied
  or superseded, and the INSERT-policy decision it called for is moot.
  Evidence: [`docs/STOREFRONT_V3_PLAN.md`](docs/STOREFRONT_V3_PLAN.md) §13.1-B/-C.
  Same correction applies to `product_masters` / `product_master_images`, which already
  carry `is_admin()` manage policies (§13.1-D) — do not "fix" them again.
- ⛔ **`sql/02-public-read-policies.sql` must never be re-run.** Its policy is
  `USING (is_active = true)` with no status check, and RLS policies are OR-ed — running it
  would re-expose every **draft** product to anonymous users and silently defeat the gate
  above. The file is annotated in place; see `docs/STOREFRONT_V3_PLAN.md` §13.1-G.
- ~~**Three authorization holes remain open**~~ **CLOSED 15 Aug 2026.** `site_content`,
  `orders`/`order_items` and `inquiries` are now `is_admin()`-scoped, plus
  `users_read_own_orders` / `users_read_own_order_items` for a customer's own data and
  `place_orders` which refuses attributing an order to another user. Proven behaviourally
  (a non-admin role reads its own order and is blocked from another's) in
  [`docs/sql/v3-rls-authorization-verification.md`](docs/sql/v3-rls-authorization-verification.md).
  `orders.user_id` now DEFAULTs to `auth.uid()` — required, or `INSERT … RETURNING` in
  `placeOrder()` would have broken checkout for every signed-in customer.
- 🔴 **Storage `product-images` policies are still open** — `auth_read/upload/update/
  delete_product_images` grant all four verbs to **any authenticated user** (bucket check
  only, no `is_admin()`). The `category-images` and `banner-images` buckets added in V3
  Phase 2 ARE admin-scoped, so this is the odd one out. One line per verb to fix.
- 🔴 **Guest checkout is broken** (pre-existing, found 15 Aug 2026). `orderService.placeOrder`
  uses `.insert(...).select("id").single()` — an `INSERT … RETURNING`, which needs a SELECT
  policy admitting the new row; `anon` has none, so it fails with *"new row violates
  row-level security policy"*. A plain INSERT succeeds, so the fix is client-side (drop the
  `.select()` for anonymous checkout) or server-side order creation — **not** widening
  anon's reads, which would re-open a disclosure hole.
- `VITE_ANTHROPIC_API_KEY` browser-exposed — move to Edge Function before scaling
- `specifications` JSONB column unused — start populating
- `business_settings` `.single()` throws on 0 rows — fix to `.maybeSingle()`
- **GST setting is stored-only** — `site_content.gst_enabled` / `gst_percentage` are editable in
  admin but NOT yet applied to any cart/checkout math (deliberate; checkout integration is a later phase)
- **Deactivating a brand has no storefront effect.** `productService.getBrands()` derives the
  `/catalog` brand facet from the legacy `products.brand` **text** column over published+active
  products and never consults `brands.is_active` — so `Paras` (deactivated) still shows as a facet
  because its one product `XL0001` is live. Closes when the storefront moves to `brand_id` /
  `brandsService.getAll()` (next storefront PR). Until then, hide a brand by unpublishing or
  deactivating its products. See [`docs/TEST_ADMIN.md`](docs/TEST_ADMIN.md) §7.
- Import UI shows price as required (\*) — stale after nullable migration (fix in next PR)
- **`enquiries` vs `inquiries` are NOT duplicate tables — do NOT merge them.**
  `enquiries` = real B2B leads (admin views via `enquiryService` / AdminEnquiries).
  `inquiries` = lightweight WhatsApp-click log for all users (`inquiriesService`,
  `productService.ts`). They are distinct by design; an earlier audit misread them as
  duplicates. Merging would destroy the lead-vs-click distinction.

---

## 📝 Deferred Admin & PIM Review Follow-ups (July 17, 2026)

Recorded for later planning; none of the items below are implemented or approved as a
roadmap commitment yet.

1. **Authorization / RLS hardening (highest priority):** replace broad
   `authenticated`-role write access with true admin-only RLS for catalogue, orders,
   imports, settings, enquiries, masters, and Storage. The frontend `isAdmin` route
   guard is UX only and must not be the authorization boundary. Preserve public
   product/category read access and protect the `uncategorized` sentinel from deletion.
2. **Move trusted operations to Supabase Edge Functions:** remove the browser-exposed
   Anthropic key; enforce authenticated-admin access, rate limits, input limits, and
   audit logging. Move order creation server-side too, so product status, MOQ, price,
   totals, and order-item snapshots are calculated from trusted database data.
3. **Import reliability:** evolve CSV/Google Sheets imports into a staged, resumable
   import job with a full preflight, accurate insert-versus-update counts, idempotency,
   row-level results, and atomic/compensating image updates. Avoid a browser/network
   interruption leaving a partial catalogue change.
4. **Resolve import contract drift:** `tags` is displayed in the import UI/template but
   is not stored; the UI says matching falls back to name while current upsert is SKU
   based. Either implement a tracked `tags` schema + controlled vocabulary and defined
   matching policy, or remove/defer those promises from the UI/template.
5. **Service-layer consolidation:** move remaining direct Supabase calls out of admin
   components (Overview, SEO, Enquiries, Settings, Categories upload, Masters) into
   focused `*Service.ts` modules, matching the existing architecture rule.
6. **Data-quality workflow:** add category-specific specification templates, a
   publish-ready review queue, SKU/barcode validation, audit history/undo, and health
   reporting. The planned Image QC grid remains the first practical improvement here.
7. **Schema discipline and performance:** track every production schema change in a
   versioned migration ledger; lazy-load admin tabs/tools to reduce the currently large
   production JavaScript bundles.

---

## 🖼️ Image pipeline — settled decision (15 Aug 2026)

**Do NOT buy Supabase paid image transformations.** This project is on the FREE
plan and stays there for images. Instead, **resize on upload**: when a product or
category image is uploaded through admin, store a web-sized WebP alongside the
original (`autoResizeImage` already emits WebP). `ProductImage` emits a real
1x/2x `srcSet` only once those files exist — it deliberately does not emit one
for renditions that do not. Scheduled as Phase 5. Do not revisit.

---

## ⚠️ Critical Rules

1. **Price security** — enforced by **column-level grants** (`anon` has no SELECT on
   `price`/`mrp`/`moq`/`barcode`/`bulk_*`). `productSelectCols()` only matches the SELECT
   list to those grants so guests don't hit a 403; its cache invalidates on auth change.
   Null price not public. See Architecture Rule #3.
2. **`pnpm-lock.yaml` must NOT exist** — Cloudflare build fails.
3. **SQL is agent-executable** (standing grant, 29 Jul 2026 — supersedes the old
   "Supabase SQL Editor only, never via agent" rule). Agents run
   SELECT/INSERT/UPDATE/DELETE/DDL/RLS directly. Two conditions: **announce destructive
   operations in the reply before running them** (announce, not ask), and **append every
   executed statement to [`docs/CHANGELOG_SQL.md`](docs/CHANGELOG_SQL.md)** with a one-line
   reason. `CREATE POLICY IF NOT EXISTS` is still invalid Postgres — use `CREATE POLICY`.
4. **`CREATE POLICY IF NOT EXISTS` invalid Postgres** — use `CREATE POLICY`.
5. **Wouter `<Link>`** — never `<a href>` for internal nav.
6. **Auth store** — skip TOKEN_REFRESHED, deduplicate SIGNED_IN by user ID.
7. **Google Drive images** — `thumbnail?id=FILE_ID&sz=w800` (not `uc?export=view`).
8. **One agent, one branch at a time.**
9. **All changes via PR** — never push to main directly.
10. **Uncategorized sentinel** (slug='uncategorized') — NEVER delete.
11. **`v_product_health`** — only source of missing logic; never duplicate in TS.
12. **All new products default to `draft`** — must be explicitly published.
13. **`products` rows are EXPENDABLE** (owner decision, 29 Jul 2026). The ~142 rows were
    scraped and are being fully rebuilt to the owner's standards before launch. Delete,
    rewrite, bulk-edit or truncate freely — nothing in `products` needs preserving.
    Dev and production are the same database, so **announce destructive operations before
    running them** (announce, not ask) and log them to
    [`docs/CHANGELOG_SQL.md`](docs/CHANGELOG_SQL.md).
    `ZZ-TEST-PRODUCT` still exists as a convenient scratch row (see "Test admin"), but it
    is no longer the _only_ legal target.
    **Carve-out — a judgment rule, not data protection:** the 11 `Hinged box` variants have
    prices that conflict with their standalone duplicates. Do **not** script or auto-merge
    that reconciliation — those are pricing calls the owner makes by hand during the
    rebuild. Leave those rows alone rather than guessing. Everything else is fair game.
14. **Categories, brands and policies are cheap to recreate** — but the `uncategorized`
    sentinel is still load-bearing (rule #10) because `products.category_id` is NOT NULL.

---

## 🔑 Test Admin

Full details, including every SQL statement run: [`docs/TEST_ADMIN.md`](docs/TEST_ADMIN.md).

- **Account:** `dev-admin@xltraders.local` (auth id `8174be01-8b5e-4b41-89d5-923a630918f6`).
  Password is **never** in the repo — it lives in gitignored `.env.local` / the Supabase
  dashboard, and is referenced only as `TEST_ADMIN_PASSWORD`.
- **How admin is determined:** `public.is_admin()` reads **one boolean**,
  `user_profiles.is_admin`, for `auth.uid()`, defaulting to `FALSE` when the user has no
  profile row. Creating the auth user is **not** enough — the profile row must exist.
  RLS policies (e.g. `brands`' "Admins can manage brands") call this function; it is the
  real authorization boundary.
- **The client has a separate check.** `authStore.resolveIsAdmin` trusts
  `profile.is_admin` first, then a `VITE_ADMIN_EMAILS` allowlist. It is **UX only** —
  it decides which screens render, never what the database permits. Note
  `buildAuthState` auto-creates a missing profile with `is_admin` from that allowlist,
  so **insert the profile row before the account's first sign-in** or it lands as
  non-admin.
- **Safe test target:** `ZZ-TEST-PRODUCT` (id `27a7d798-7d73-419a-a4b9-4195ab67bdce`),
  `status='draft'` + `is_active=false`, so the publish gate keeps it off the storefront.
  Rule #13 above. Reset it with:
  `UPDATE products SET brand_id=NULL, brand='', status='draft', is_active=FALSE WHERE sku='ZZ-TEST-PRODUCT';`

---

## 🤖 Autonomous Merge Policy

After opening/updating a PR: self-verify fully — CI green, CodeRabbit has no
open findings, and a manual test via demo-mode/preview confirms the feature
actually works — then **merge autonomously, without waiting for explicit
confirmation.**

**Exception — stop and wait for explicit go-ahead even if all checks pass**
when the PR touches any of:

- Payment / checkout money logic (cart totals, pricing, order submission gating)
- Database schema or migrations
- Deletion of an existing feature
- Authentication / security

For an excepted PR, still do the full self-verify and report the result —
just don't click merge until the go-ahead is given.

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

| Column           | Required | Notes                                                    |
| ---------------- | -------- | -------------------------------------------------------- |
| name             | ✅       | Full name including size for variants                    |
| category         | ⬜       | Blank → Uncategorized; must match Categories tab exactly |
| unit             | ✅       | pcs/box/kg/set/roll/meter/litre/packet                   |
| price            | ⬜       | Blank = "Price on enquiry"                               |
| mrp              | ⬜       | Optional                                                 |
| moq              | ⬜       | Blank = unknown                                          |
| brand            | ⬜       | Blank = unknown                                          |
| description      | ⬜       | Short B2B description                                    |
| sku              | ⬜       | Blank = auto-generated                                   |
| quantity_in_unit | ⬜       | Pack size e.g. 100                                       |
| is_featured      | ⬜       | Yes/No                                                   |
| status           | ⬜       | draft (default) or published                             |
| master_name      | ⬜       | Variants only — e.g. "Hinged Box"                        |
| variant_label    | ⬜       | Variants only — e.g. "250ml"                             |
| tags             | ⬜       | restaurant,cloud-kitchen,hotel…                          |
| na_fields        | ⬜       | brand,specifications,image                               |
| image_url        | ⬜       | drive.google.com/thumbnail?id=FILE_ID&sz=w800            |
