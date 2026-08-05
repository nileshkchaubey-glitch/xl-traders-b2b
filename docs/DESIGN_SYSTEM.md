# XL Traders B2B — Design System & Standards

**Single consolidated reference for UI, engineering, components, and architecture.**
Ground truth is the repository; where a rule already lives in [`CLAUDE.md`](../CLAUDE.md)
this document references and consolidates it rather than restating a competing version.
If code and `CLAUDE.md` ever disagree, the discrepancy is flagged here — fix the code or
the doc, don't paper over it.

> Scope note: this file is **documentation only**. It describes what exists today and the
> agreed contracts for what's next. It introduces no code and no dependencies.

---

## 1. UI Standards

### 1.1 Tailwind setup

- **Tailwind v4**, configured entirely in CSS. There is **no `tailwind.config.ts`** — the
  `@theme` block in [`client/src/index.css`](../client/src/index.css) is the equivalent of
  `theme.extend`. Entry point is `@import "tailwindcss";` plus `tw-animate-css`.
- Dark mode is wired via `@custom-variant dark (&:is(.dark *));` but the app currently ships
  a **light theme only** (no `.dark` class is toggled in the shipped UI).

### 1.1b Type families — Archivo · IBM Plex Sans · IBM Plex Mono

**Inter is gone.** The locked storefront design ("Direction B — Rate Card", August 2026)
replaces the single-family system with three:

| Token            | Family                            | Job                                                                           |
| ---------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| `--font-display` | **Archivo** 700                   | Section headings only (`font-display`)                                        |
| `--font-sans`    | **IBM Plex Sans** 400/500/600     | Body, UI, product names, buttons (default on `<body>`)                        |
| `--font-mono`    | **IBM Plex Mono** 400/500/600/700 | **Every figure** — prices, pack specs, SKUs, GSTIN, meta labels (`font-mono`) |

Two rules that make the system work:

1. **Every number is mono, and every mono number carries `tabular-nums`.** A rate card is
   read by scanning a column of figures; proportional digits make that column jitter. If
   you are rendering a price, a pack count, an SKU or a date, it is `font-mono … tabular-nums`.
2. **`--font-sans` is global**, so this re-faces the admin shell too. That is deliberate —
   one type system, and "no Inter anywhere" — and it changes no admin layout or logic.

**Why IBM Plex:** it ships Devanagari and Gujarati. Adding a second language later is a
family swap, not a redesign.

**Loading strategy** (`client/index.html`): one Google Fonts stylesheet request, weights
pinned to exactly the eight faces used and nothing more, `display=swap`, with `preconnect`
to both Google font hosts. Three families is real weight on mobile, so the axis list is the
lever: adding a weight is a real cost and needs a reason. Google splits each family by
`unicode-range`, so a Latin visitor downloads only Latin subsets — and Gujarati subsets
will start serving themselves when Gujarati copy appears, with no build change.
**Open:** self-hosting would remove the third-party round-trip and the render-blocking
stylesheet; deferred, not yet measured.

### 1.2 Design tokens (actual `@theme` values)

| Token                   | Value                                    | Usage                                                                               |
| ----------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `--font-display`        | `"Archivo", …`                           | Section headings (`font-display`)                                                   |
| `--font-sans`           | `"IBM Plex Sans", …`                     | Global body face                                                                    |
| `--font-mono`           | `"IBM Plex Mono", …`                     | All figures (`font-mono`)                                                           |
| `--color-ink`           | `#1b1e1e`                                | Text, 2px rules, the rate tab, primary buttons (`text-ink`, `bg-ink`, `border-ink`) |
| `--color-ink-muted`     | `#5c6263`                                | Secondary body (`text-ink-muted`)                                                   |
| `--color-ink-faint`     | `#767c7d`                                | Meta, labels, placeholders (`text-ink-faint`)                                       |
| `--color-ink-inverse`   | `#c3c8c8`                                | Body text on an ink background                                                      |
| `--color-rule`          | `#dfe2e2`                                | The default 1px hairline (`border-rule`)                                            |
| `--color-rule-soft`     | `#eef0f0`                                | Quieter 1px list-row divider (`border-rule-soft`)                                   |
| `--color-sunken`        | `#f1f3f3`                                | Image slot / thumbnail backing (`bg-sunken`)                                        |
| `--color-quiet`         | `#f7f8f8`                                | Faint section wash (`bg-quiet`)                                                     |
| `--color-wa`            | `#059669`                                | WhatsApp green (= `emerald-600`, unchanged)                                         |
| `--color-admin-bg`      | `#f4f6f9`                                | Admin shell background (`bg-admin-bg`)                                              |
| `--color-admin-sidebar` | `#1a1d27`                                | Admin dark sidebar (`bg-admin-sidebar`, 220px)                                      |
| `--shadow-red`          | `0 10px 15px -3px rgb(220 38 38 / 0.25)` | Red CTA glow (`shadow-red`)                                                         |
| `--shadow-emerald`      | `0 10px 15px -3px rgb(5 150 105 / 0.3)`  | Emerald CTA glow (`shadow-emerald`)                                                 |

**Type scale** — role-named, because the same role changes size between 390 and 1440 and
the call site should say _what_ it is, not how big. The design board carried 25 distinct
pixel sizes (a canvas artifact, not a system); these 14 steps preserve every hierarchy
step it actually depends on.

| Token               | Value       | Role                                   |
| ------------------- | ----------- | -------------------------------------- |
| `--text-meta`       | 10px / 1    | Uppercase tracked labels only          |
| `--text-caption`    | 11px / 1.35 | Mono meta lines, legal                 |
| `--text-micro`      | 12px / 1.5  | The legibility floor at 390px          |
| `--text-body-sm`    | 13px / 1.45 | Product name (mobile), sub-rows        |
| `--text-body-md`    | 15px / 1.4  | Product name (desktop), buttons        |
| `--text-price`      | 23px / 1    | Pack price (mobile)                    |
| `--text-price-lg`   | 30px / 1    | Pack price (desktop)                   |
| `--text-figure-sm`  | 24px / 0.9  | Pack size under a photo (mobile)       |
| `--text-figure-md`  | 33px / 0.9  | Pack size under a photo (desktop)      |
| `--text-figure`     | 34px / 0.85 | Pack size over the watermark (mobile)  |
| `--text-figure-lg`  | 46px / 0.85 | Pack size over the watermark (desktop) |
| `--text-display-sm` | 24px / 1    | Sub-heading ("Recent orders")          |
| `--text-display`    | 26px / 1    | Section heading (mobile)               |
| `--text-display-lg` | 40px / 1    | Section heading (desktop)              |

Tailwind v4 only recognizes a `--text-*--line-height` companion on this namespace;
font-weight stays a separate utility at the call site, same as Tailwind's own scale.

> `--text-display` was **redefined** by this pass (was 46px hero-scale, now 26px section
> heading). Its only consumer was the deleted hero.

shadcn/ui theme variables live in `:root` as **OKLCH** values mapped through `@theme inline`
(`--background`, `--foreground`, `--card`, `--primary`, `--border`, `--ring`, `--radius`,
the `--chart-*` and `--sidebar-*` ramps, etc.). Notable:

- `--primary: oklch(0.505 0.225 27.325)` ≈ **brand red `#DC2626` (Tailwind `red-600`)**.
- `--radius: 0.65rem`, with `--radius-sm/md/lg/xl` derived from it.
- `--destructive` is also red — destructive actions and the brand share the red hue.

**Colors used at call sites** are still mostly Tailwind palette utilities (`red-600`,
`emerald-500/600`, `slate-*`, `amber-*`), not custom hex — keep it that way (no new hex).

### 1.3 Semantic color usage

| Color                                                                  | Meaning                                                                | Examples                                                           |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Ink** (`ink` / `#1b1e1e`)                                            | Text, structure, and the primary action on the storefront              | 2px rate rule, the rate tab, "Add to order", steppers              |
| **Brand red** (`red-600` / `#DC2626`)                                  | Commerce action + active state; the storefront's only saturated accent | "View order", active nav tab, category icons, hover on ink buttons |
| **Amber** (`amber-600`)                                                | The **On-Enquiry** price state, and only that on the storefront        | "On enquiry" tab on the rate rule                                  |
| **WhatsApp green** (`wa` / `emerald-600`)                              | The WhatsApp channel, and "wholesale rates active"                     | WhatsApp pill, Place order, account status tab                     |
| **Ink ramp** (`ink-muted`, `ink-faint`, `rule`, `rule-soft`, `sunken`) | Neutral text, hairlines, surfaces                                      | Body copy, dividers, image slot backing                            |
| **Slate** (`slate-*`)                                                  | **Admin only.** The storefront uses the ink ramp instead               | Admin tables, sidebar, panels                                      |

> The storefront no longer uses `slate-*`. If you are writing a storefront component and
> reach for `slate-200`, you want `rule`; `slate-500` → `ink-faint`; `slate-900` → `ink`.

### 1.3b The rate rule

One piece of structure holds the whole storefront together, and it is worth naming because
it repeats on five different surfaces:

> A **2px ink rule** under a product name, with a **solid filled tab hanging off its left
> end** carrying the per-piece rate.

```
────────────────────────────────  ← border-t-2 border-ink
▐ ₹0.28/pc ▌                      ← bg-ink text-white font-mono, or bg-amber-600 "On enquiry"
```

It marks the one number that separates two identical black containers. It is the only
filled shape on an otherwise de-carded item, which is what makes it read. It appears on:
the grid item, the PDP buy panel, the mini cards in "Similar products", each cart line, and
each order row on the Account screen. **Products with no rate carry an amber tab on the
same rule** — never a missing tab, and never `₹0`.

### 1.3c De-carded

The storefront is built from **rules and whitespace**, not rounded cards. Storefront
components have no `rounded-*`, no `border` box around a product, no `shadow-*`, and no
hover lift. Items sit in open whitespace; hairlines and the rate rule provide the
structure. Transitions are 150ms colour changes only — no keyframes ship on the storefront,
which also makes reduced-motion handling trivially correct.

(Admin is unchanged and keeps its cards, radii and shadows.)

### 1.4 Typography & spacing

- **Fonts:** see §1.1b — Archivo (display), IBM Plex Sans (body, global), IBM Plex Mono
  (every figure, always with `tabular-nums`).
- **Type scale (storefront):** the role-named tokens in §1.2. Reach for a named size
  first; an arbitrary `text-[Npx]` needs a genuinely one-off reason. Admin screens still
  use ad hoc Tailwind text utilities (out of scope).
- **Spacing rhythm (storefront sections):** the 3-step `py-*` rhythm belonged to the
  section-stack layout that the Rate Card design replaced. The storefront now uses a
  simpler pair, and sections are separated by **rules**, not by large vertical gaps:
  - `pt-6 md:pt-8` — page top (below the header)
  - `pt-7 md:pt-11` — between major sections (categories → rate card)
    A section's heading sits on a `border-t-2 border-ink` with `pt-[18px] md:pt-[26px]`; that
    rule _is_ the separator, which is why the gaps are smaller than they used to be.
- **Radii:** `--radius` (0.65rem) and `rounded-*` are **admin-only** now. The storefront is
  square (§1.3c) — the sole exception is the WhatsApp pill, which is `rounded-full`.
- **Container — use `.shell` on the storefront.**

  `.shell` (in `client/src/index.css`) is the storefront's horizontal frame: `max-width:
1440px`, padding `18px → 32px → 56px`, matching the 390 and 1440 design boards exactly.

  It is deliberately **not** named `.container`, which sidesteps a long-standing bug rather
  than inheriting it: Tailwind ships its own `container` utility, so the project's custom
  `.container` has always had a second rule competing with it, and Tailwind's caps win
  (**640 / 768 / 1024 / 1280 / 1536px**, not the documented flat 1280). Consequences: at a
  1000px viewport `.container` content is only 768px wide, and above 1536px it expands to
  1536px. `.shell` has no such collision — the width it declares is the width that renders.

  `.container` still exists and is still used by admin. Deciding its fate is now an
  admin-only question.

> Delivered by this pass: the brand/WhatsApp/neutral color ramp that the `index.css` token
> comment had promised "in a later pass" is now in `@theme` (§1.2) — for the storefront.
> Admin call sites still use plain Tailwind palette utilities.

### 1.5 Mobile: one system, layout switch (not a fork)

`useIsMobile()` in [`client/src/hooks/useMobile.tsx`](../client/src/hooks/useMobile.tsx)
(`matchMedia`, breakpoint **768px**) is the single switch. Same routes, same services, same
data — only the **chrome/presentation** changes below `md`:

- Storefront: `MobileNav` (bottom nav + cart FAB) rendered by `Header`.
- Admin: `MobileAdminShell` (bottom tabs + "More") wraps the identical section content that
  the desktop layout renders; `MobileProductCard` / `ProductQuickEditSheet`, etc.

**Rule:** never build a parallel mobile system or duplicate routes/services. Branch on
`useIsMobile()` and swap the presentation. (The removed `/admin-v2` is the cautionary tale —
see §4.)

### 1.6 Price display rule (hard rule)

`isPriceOnEnquiry(price)` in [`client/src/lib/priceUtils.ts`](../client/src/lib/priceUtils.ts)
is the **single source of truth**:

```ts
isPriceOnEnquiry(price); // true when price is null/undefined OR <= 0
cartLinePrice(price); // 0 for on-enquiry items, else the real price
```

- **`0` and `NULL` both mean "On Enquiry."** A price must **NEVER** render as `₹0` anywhere —
  cards, product detail, cart, WhatsApp, admin lists.
- Every render site and every save path funnels through this. On save, blank/0/negative
  coerces to `NULL` (`saveProductForm`, the Catalog Editor inline edit, quick-add, bulk
  import). Consolidated in `CLAUDE.md` under "Null-price safety."
- **Colour:** the On-Enquiry state renders **amber** (§1.3) — as a filled tab on the rate
  rule (§1.3b), never as a missing tab.

#### 1.6b Which price a viewer sees — MRP vs wholesale

> **Signed out → MRP. Signed in → wholesale.**

`displayPrice(product, isAuthenticated)` in `priceUtils.ts` is the only place that decides,
and `toCardModel()` (`lib/cardModel.ts`) is the only thing that calls it. It returns one
object carrying the pack price, its tag (`"MRP"` / `"Wholesale"`), and the derived
per-piece rate — **pack price and per-piece rate always travel together**, so no call site
can render one without the other.

- **No strikethrough, no "% OFF", no savings badge.** The two audiences each see one honest
  number and neither is shown the other's.
- **No "sign in to see prices" prompt anywhere.** A signed-out visitor sees MRP, which is a
  real price; there is nothing to tease.
- `isPriceOnEnquiry` stays the single gate — it is applied to whichever column is in play,
  so a product with a wholesale price but no MRP is "On enquiry" _for signed-out visitors
  only_, and that is correct rather than a bug.
- **Per-piece is derived, never stored:** `price ÷ quantity_in_unit`, guarded against a
  NULL/non-positive divisor. `unit_of_measure` names the pieces _inside_ the pack (CLAUDE.md
  unit-of-sale rule), so it is what labels the rate — `₹0.28/pc`, `₹7.20/pkt`.

**Current data constraint (August 2026).** `products.mrp` exists but the `anon` role has no
SELECT grant on it, so signed-out visitors resolve to "On enquiry" for everything. Asking
for an ungranted column makes PostgREST fail the whole query, so the request is gated by
`MRP_PUBLIC_READ` in `productService.ts` (default `false`). Sequence:
`docs/sql/pr2-mrp-public-read.sql` → flip the constant → redeploy. Even then only **6 of
143** products carry a usable MRP; the rest stay on enquiry until the data is entered.
Regression-tested in `scripts/check-card-model.ts` (`npm run check:card`), which asserts
that a signed-out viewer never receives the wholesale figure.

#### 1.6c Image fallback chain

`ProductImageSlot` (`client/src/components/ProductImageSlot.tsx`) implements three tiers:

1. **Product photo** — a genuine shot of this SKU.
2. **Category default** — one honest image for the aisle, desaturated and labelled
   "Category image" so it never masquerades as the product. Source:
   `useCategoryImages()` (one shared `categoryService.getAll()` per page, not per card).
3. **XL monogram watermark + pack size** — `/images/brand/xl-monogram.png` at **9% opacity**,
   bled off the right edge, with the pack size at display scale in front of it.

**Tier 3 is the design, not a degraded state.** Most of the catalogue lands there, and on a
catalogue of near-identical black containers the capacity and pack count identify a product
far better than a stock photo of a black container would. The size figure is the loudest
thing in the slot, so twelve cards read as twelve products rather than twelve logos.

The tier is resolved at **runtime**, not merely from whether a URL exists: a dead URL fires
`onError` and advances the tier. That matters here specifically — 127 of 143 products point
at Google Drive, which has failed wholesale before.

`toCardModel()` supplies the figure: it reads a size from `variant_label` or the product
name (capacity → compartment count → box dimensions), and falls back to the **pack count**
when nothing is parseable, flagging `sizeIsPackCount` so the slot suppresses its own
"N pcs/pack" line rather than printing the same number twice.

### 1.7 Brand display rule (storefront)

`brandLabel(brand)` / `realBrands(brands)` in
[`client/src/lib/brandUtils.ts`](../client/src/lib/brandUtils.ts) are the single source of
truth for "is this a real brand?".

- **`'Generic'` is a null-brand placeholder, not a supplier.** It must never render as a
  brand — product cards, product detail, the Home brand chips, or the marquee. Treated
  exactly like `NULL`/empty.
- This is a **presentation** rule. `productService.getBrands()` still returns the stored
  value, so the admin PIM keeps seeing `Generic` as the data it is — filtering happens at
  the render site.
- Same shape as `priceUtils`: one rule, one module, every render site funnels through it.
  See `STYLE_REFERENCE.md` §4.4.
- **PIM P1 (July 2026): `products.brand_id` (FK → `brands.id`) is now the canonical brand
  link; the text column is legacy.** During the transition every admin brand assign
  dual-writes both columns in one update (`bulkSetBrand`, `saveProductForm`) — "No brand"
  is `brand_id NULL` + `brand ''`. The storefront still reads the text column until PR-2;
  the text column is dropped after that, in a separate owner-run migration. Canonical
  filter definition: **unbranded == `brand_id IS NULL`.**

---

## 2. Engineering Standards

### 2.1 Service-layer rule

**Components → `client/src/lib/*Service.ts` → Supabase.** UI never embeds SQL/query logic;
missing/health logic lives only in the `v_product_health` view + `healthService`
(`CLAUDE.md` Architecture Rules #1–#4).

Service modules that exist today (`client/src/lib/`):

| Module                                            | Responsibility                                                                                                                                                                                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `productService.ts`                               | Products CRUD, `getAllAdmin` (paginated, `.range()`), `getAdminMatchingIds`, bulk ops, plus exported `categoryService`, `productImageService`, `enquiryService`, `inquiriesService`, `mediaService`, `storageService`                                       |
| `brandsService.ts`                                | Brands CRUD (PIM P1): `getAll` (active, storefront/pickers), `getAllAdmin`, `getById`, `getProductCounts`, `create`/`update` (slug auto via `slugify`), `setActive` (soft delete — never hard delete). `isUniqueViolation` helper for inline 23505 handling |
| `healthService.ts`                                | Reads `v_product_health` only (missing counts, ids, category rollup)                                                                                                                                                                                        |
| `masterService.ts`                                | Product masters & variants                                                                                                                                                                                                                                  |
| `orderService.ts`                                 | Orders / WhatsApp order message                                                                                                                                                                                                                             |
| `settingsService.ts`                              | `site_content` + business settings                                                                                                                                                                                                                          |
| `bulkImportService.ts` / `googleSheetsService.ts` | CSV / Google Sheets import (SKU upsert)                                                                                                                                                                                                                     |
| `aiService.ts`                                    | AI Smart Paste / description (browser-side API key — see Known Issues)                                                                                                                                                                                      |
| `templateService.ts`                              | Import template generation                                                                                                                                                                                                                                  |
| Support libs                                      | `catalogHealth.ts` (colors/labels only), `priceUtils.ts`, `brandUtils.ts`, `imageUtils.ts`, `productForm.ts`, `demoData.ts`, `utils.ts`, `supabase.ts`                                                                                                      |
| Stores                                            | `authStore.ts` (`useAuthStore`), `stores/cartStore.ts`                                                                                                                                                                                                      |

> **Known discrepancy (flagged, not hidden):** `CLAUDE.md` Rule #1 states "components never
> call Supabase directly," but several admin components still do —
> `AdminCategories.tsx`, `AdminMasters.tsx`, `AdminOverview.tsx`, `AdminSEO.tsx` import the
> `supabase` client and query it inline. (`AdminProducts.tsx` was the fifth offender until
> its Phase 2b removal.) The rule is the **target state**; these are debt to
> migrate into services. New code MUST follow the rule; touching one of these files is a good
> moment to extract its queries. (The Catalog Editor is already service-only.)

### 2.2 State & persistence

- **No `localStorage` for UI state** — it is restricted in our stack. Persist shareable UI
  state in **URL params** instead.
- **Reference pattern:** the Catalog Editor's column visibility is seeded from and written
  back to the `cols` URL param (merged so `?tab`/`?missing` survive), never localStorage.
  See `CatalogTreeEditor.tsx` (`colsFromParam` + the `setLocation('/admin?…')` effect).
- Ephemeral cross-tab admin state (e.g. active tab) uses `sessionStorage`; cart uses the
  Zustand `cartStore`. Server state is always re-fetched through services.

### 2.3 Branch / PR / build discipline

Consolidated from `CLAUDE.md` "Critical Rules" and "Workflow":

- **One agent, one branch at a time.** All changes via **PR** — never push to `main`.
- Feature branches off `main`; `main` auto-deploys to Cloudflare Pages (~2–3 min).
- **npm only.** `package-lock.json` is the lockfile; **`pnpm-lock.yaml` must NOT exist**
  (Cloudflare build fails if it does).
- **DB migrations are run manually in the Supabase SQL Editor — never by an agent.**
  `CREATE POLICY IF NOT EXISTS` is invalid Postgres; use `CREATE POLICY`.
- Conventional commits (`feat`/`fix`/`chore`/`docs`/`style`).
- Update `CLAUDE.md` (Shipped + Roadmap) in the same PR that ships a feature.

### 2.4 TypeScript

- `npm run check` (`tsc --noEmit`) **must stay at 0 errors.** Treat a red check as a blocker.
- `tsconfig.json`: `target: ES2020`, `module: ESNext`, `strict: true`,
  `lib: [esnext, dom, dom.iterable]`. `noUnusedLocals` is effectively enforced — don't leave
  unused imports/vars.
- Verify a change with **both** `npm run check` and `npm run build` before opening a PR.

---

## 3. Component Library

### 3.1 Primitives — shadcn/ui (`client/src/components/ui/`)

These already exist; **reuse them, don't hand-roll equivalents:**

`accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button,
button-group, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu,
dialog, drawer, dropdown-menu, empty, field, form, hover-card, input, input-group, input-otp,
item, kbd, label, menubar, navigation-menu, pagination, popover, progress, radio-group,
resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, spinner,
switch, table, tabs, textarea, toggle, toggle-group, tooltip`

Toasts use **`sonner`**. Bottom sheets use the single **`drawer`** (vaul) primitive.

### 3.2 Shared app components & patterns

| Component / hook                                                                                                     | Role                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useProductForm` + `lib/productForm.ts` (`saveProductForm`)                                                          | **Single source of truth for create/update.** Used by the route editor and `CatalogProductPanel` so save logic never forks                                                                                                                                                                                                                                                                    |
| `CatalogProductPanel`                                                                                                | Catalog Editor's field editor (on `useProductForm`; embeds `ProductMediaSection` for image assign)                                                                                                                                                                                                                                                                                            |
| `CatalogTreeEditor`                                                                                                  | **THE products surface** (Phase 2b) — group→category tree + shared `<DataTable>` with inline edit, bulk, keyboard nav                                                                                                                                                                                                                                                                         |
| `CategoryCombobox`, `BrandCombobox`, `AISmartPasteDialog`, `ProductMediaSection`, `MobileAdminShell`, `adminNav.tsx` | Reusable admin building blocks. `BrandCombobox` (PIM P1) clones `CategoryCombobox`'s Popover+cmdk pattern; adds an explicit "No brand" entry and resolves inactive-brand values with an "(inactive)" suffix                                                                                                                                                                                   |
| `AdminBrands`                                                                                                        | Brands manager tab (`/admin` → Catalogue → Brands). Self-loading via `brandsService` only — zero direct Supabase calls. Create/edit dialog with inline 23505 duplicate error; active switch = soft delete                                                                                                                                                                                     |
| `HealthDot` / `catalogHealth.ts`                                                                                     | Health color/label only (logic stays in the view)                                                                                                                                                                                                                                                                                                                                             |
| `SectionEyebrow` (`client/src/components/SectionEyebrow.tsx`)                                                        | Storefront-only: the small uppercase/tracked label above a section `<h2>` (`tone="light"` red-600 on white/slate-50, `tone="dark"` red-400 on a dark card). Standardizes a pattern that used to be re-typed per section — reuse it for any new section eyebrow rather than hand-rolling the classes again                                                                                     |
| `HomeCatalogueShowcase` (`client/src/components/home/HomeCatalogueShowcase.tsx`)                                     | Home-page catalogue taster: category chips + chip-filtered `ProductCard` grid on the same paginated `productService.getAll` call `/catalog` uses (pageSize 10). Replaced `HomeFeaturedProducts` (removed — its tabs were a client-side heuristic over an unpaginated full-catalogue fetch; recover from git if needed). Not a second catalogue: capped per view, always links into `/catalog` |

> Removed in Phase 2b (recover from git if needed): `AdminProducts`, `ProductsTable`
> (TanStack + `react-virtual` — the only virtualized grid), `ProductDrawer`,
> `EditableCell`, `RapidEntryRow`, `ProductQuickEditSheet`, `MobileProductCard`,
> `AdminImageGallery`. `@tanstack/react-virtual` is currently **unused** (kept as a
> dependency for `<DataTable>`'s planned virtualization phase).

### 3.3 Shared `<DataTable>` — **Phase 1 built** (`client/src/components/ui/DataTable.tsx`)

`<DataTable>` exists as of Phase 1, built on **`@tanstack/react-table`** (already a dependency,
`^8.21.3` — no new dep, ~0 bundle delta). **`CatalogTreeEditor` is the first consumer** (its
bespoke grid was removed). Phase 2b then deleted `ProductsTable` along with AdminProducts, so
`<DataTable>` is now the **only** product grid. Every admin table should consume this one
component — **no bespoke grids.**

**Target feature set (20)** — `[DONE]` = live in `<DataTable>` Phase 1; the rest land in later
phases per this contract:

| #   | Feature                          | Status                                                                                                                                                                                                                             |
| --- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Column sort                      | `[DONE]` — per-column sort headers → `getAllAdmin` `sortField`/`sortAscending` (server-side)                                                                                                                                       |
| 2   | Per-column filter                | `[medium]` — deferred                                                                                                                                                                                                              |
| 3   | Column resize                    | `[DONE]` — TanStack's built-in resize API (`columnResizeMode: "onChange"`); drag handle on each resizable column's right edge, per-column `minSize`/`maxSize`, widths persisted to URL (`${persistKey}Sizing`) on drag-end only    |
| 4   | Hide/show columns                | `[DONE]` — Columns menu (from `meta.hideable`/`defaultHidden`)                                                                                                                                                                     |
| 5   | Column pin                       | `[DONE]` — `meta.sticky`, sticky-left with cumulative offsets                                                                                                                                                                      |
| 6   | Multi-select rows                | `[DONE]` — consumer-controlled selection; select-all-matching in Catalog Editor                                                                                                                                                    |
| 7   | Bulk action bar                  | `[DONE]` — consumer slot; publish / unpublish / delete in Catalog Editor                                                                                                                                                           |
| 8   | Infinite scroll (virtualization) | `[deferred]` — `react-virtual` installed but unused since Phase 2b; DataTable paginates                                                                                                                                            |
| 9   | Sticky header                    | `[DONE]` — `thead` sticky top                                                                                                                                                                                                      |
| 10  | Sticky first column              | `[DONE]` — checkbox + first `meta.sticky` column                                                                                                                                                                                   |
| 11  | Keyboard navigation              | `[DONE]` — consumer via `containerProps` + `managed` inline inputs (↑↓←→, Enter, Tab, Esc)                                                                                                                                         |
| 12  | Copy/paste (Excel)               | `[deferred]`                                                                                                                                                                                                                       |
| 13  | Right-click menu                 | `[DONE]` — `rowContextMenu` render-prop wraps each row in `ContextMenu`/`ContextMenuTrigger` (`asChild` onto the `<tr>`); Catalog Editor also exposes the same item list via an always-visible "⋯" `DropdownMenu` button for touch |
| 14  | Row grouping                     | `[deferred]` — the tree gives group→category filtering, not in-table grouping                                                                                                                                                      |
| 15  | Export CSV                       | `[deferred]` — import exists; export doesn't                                                                                                                                                                                       |
| 16  | Save layout                      | `[DONE]` — columns + density persisted to URL (`persistKey`); no localStorage                                                                                                                                                      |
| 17  | Search                           | `[DONE]` — `search` hook (Catalog Editor keeps its own toolbar box; server-side name/SKU)                                                                                                                                          |
| 18  | Pagination                       | `[DONE]` — server-side `.range()` footer                                                                                                                                                                                           |
| 19  | Density toggle                   | `[DONE]` — compact / comfortable, persisted to URL                                                                                                                                                                                 |
| 20  | Loading skeleton                 | `[DONE]` — reuses `ui/skeleton`                                                                                                                                                                                                    |

**Phase 1 live: 13 / 20.** Deferred to later phases: per-column filter, column resize,
virtualization/infinite scroll, copy-paste, right-click menu, row grouping, export CSV.

> Phase 2b removed `ProductsTable`, so `<DataTable>` is the single grid implementation.
> Virtualization (folding `react-virtual` into `<DataTable>`) remains a later-phase item.

---

## 4. Architecture Rules

### 4.1 Critical rules (consolidated from `CLAUDE.md`)

1. **The repo is ground truth.** Read the code; don't invent. Keep `CLAUDE.md` current.
2. **No duplicate admin systems.** `/admin-v2` (PRs #62–#79) was built then **removed** — the
   original `/admin` PIM is the only admin. Do not recreate admin-v2 code/routes/specs.
3. **One agent, one branch at a time; all changes via PR; never push to `main`.**
4. **Price security:** `productSelectCols()` gates price/mrp/discount columns; guests never
   receive them. Null (or 0) price is never a public price. Cache invalidates on auth change.
5. **`v_product_health` is the only missing-logic source** — never re-implement checks in TS.
6. **Uncategorized sentinel** (`slug='uncategorized'`) — never delete.
7. **All new products default to `draft`** — must be explicitly published.
8. **`pnpm-lock.yaml` must not exist**; migrations run in SQL Editor only; Wouter `<Link>` for
   internal nav (never `<a href>`); auth store dedupes `SIGNED_IN`, skips `TOKEN_REFRESHED`.
9. **`enquiries` ≠ `inquiries`** — distinct by design (real B2B leads vs. WhatsApp-click log).
   Do **not** merge them.

### 4.2 PIM model

```
Group (category.group_name)
  └── Category (categories)              slug UNIQUE; sentinel 'uncategorized' (inactive)
        └── Product (products)           category_id NOT NULL FK
              ├── master_id = NULL       → standalone product
              └── master_id = <uuid>     → variant of a product_master (shared desc/images/SEO)
```

- **Draft / publish gate:** a product is public only when `status='published'` **AND**
  `is_active=true`. New products are `draft`.
- **`v_product_health`** (VIEW) is the single source of "what's missing": `missing_price`,
  `missing_category`, `missing_moq`, `missing_brand`, `missing_image`, `missing_specifications`,
  `missing_description`, `missing_seo`, plus `missing_count` (0–8) and `health_score` (0–100).
- **N/A marking:** `products.na_fields TEXT[]` lets the operator mark a field "not applicable"
  so it stops counting as missing in the view (no fake data entered).
- **Price:** nullable; `NULL` or `0`/negative = "on enquiry" (§1.6), never rendered as `₹0`.

> Data-count note: `CLAUDE.md` says "~142 products"; the live DB currently holds ~151. The
> goal remains **1000 products**. Treat exact counts as approximate — the DB is authoritative.

### 4.3 Data flow — read path

```
Component (e.g. CatalogTreeEditor / ProductCard)
   │  calls a service method — no SQL in the component
   ▼
productService.getAllAdmin({ page, categoryIds, status, search, ids })
   │  productSelectCols() picks columns by session (guests: price cols withheld)
   ▼
supabase.from('products').select(cols).range(from,to)      ← .range() pagination
   │
   ▼
Postgres (Row-Level Security) ──► rows ──► component state ──► render
                                                     │
   health dots / missing counts ◄── healthService ◄─┴─ v_product_health (VIEW)
```

### 4.3b Data flow — write path

```
Component edit (inline cell / CatalogProductPanel / route editor)
   │
   ▼
useProductForm → saveProductForm()            (single create/update path)
   │   price coerced via isPriceOnEnquiry(): blank/0/negative → NULL
   ▼
productService.update() / .create() / bulk*()  (service layer only)
   ▼
supabase.from('products').update|insert|delete
   ▼
Postgres  ──►  v_product_health VIEW recomputes automatically
   │
   └──► UI re-reads via healthService (dots, chip counts) + optimistic row patch
```

---

## Maintenance

Update this file when tokens, the service list, the component inventory, or the `<DataTable>`
status change — in the **same PR** as the change, alongside `CLAUDE.md`. If you find a new
code-vs-doc discrepancy, add it to the relevant "discrepancy" note rather than silently
guessing which side is right.
