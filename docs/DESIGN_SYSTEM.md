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

### 1.2 Design tokens (actual `@theme` values)

Named tokens added in the "Phase A" pass (`client/src/index.css`):

| Token                   | Value                                    | Usage                                          |
| ----------------------- | ---------------------------------------- | ---------------------------------------------- |
| `--font-sans`           | `"Inter", ui-sans-serif, system-ui, …`   | Applied to `<body>`; Inter everywhere          |
| `--color-admin-bg`      | `#f4f6f9`                                | Admin shell background (`bg-admin-bg`)         |
| `--color-admin-sidebar` | `#1a1d27`                                | Admin dark sidebar (`bg-admin-sidebar`, 220px) |
| `--shadow-red`          | `0 10px 15px -3px rgb(220 38 38 / 0.25)` | Red CTA glow (`shadow-red`)                    |
| `--shadow-emerald`      | `0 10px 15px -3px rgb(5 150 105 / 0.3)`  | Emerald CTA glow (`shadow-emerald`)            |
| `--text-caption`        | `0.6875rem` (11px), line-height `1.35`   | Smallest meta/label text (`text-caption`)      |
| `--text-body-sm`        | `0.8125rem` (13px), line-height `1.45`   | Secondary body/UI text (`text-body-sm`)        |
| `--text-body-md`        | `0.9375rem` (15px), line-height `1.4`    | Emphasized inline text, CTAs (`text-body-md`)  |
| `--text-display`        | `2.875rem` (46px), line-height `1.08`    | Hero-scale headline (`text-display`)           |

Added in the "Foundation" pass (`docs/STOREFRONT_DESIGN_PROPOSALS.md` §4, PR1): four named
type-scale tokens filling gaps in Tailwind's default scale. Note `--text-display` currently
has **zero** call sites — it was minted for a hero that no longer uses it.

> **Correction.** This paragraph used to claim Tailwind v4 "only recognizes a
> `--text-*--line-height` companion". It does not — it also recognizes
> `--text-*--letter-spacing` and `--text-*--font-weight`, proved by adding both and
> rebuilding. The same false claim was fixed in `index.css` in #168; this was a second
> copy of it in a different file. Setting only line-height is a **choice** (a size token
> that also forces a weight cannot be reused at another weight), not a platform limit.

#### The prototype-derived role scale (19 Aug 2026)

The four tokens above predate the prototype. `design-reference/xl-traders-storefront.source.dc.html`
is now the design source of truth, so the scale is **derived from it** rather than defended
against it — that is what makes literal fidelity and token discipline compatible.

**27 distinct sizes collapse to 12 roles**, each with an `-lg` sibling (most of the 27 were
one role at two breakpoints):

| Role                   | mobile → desktop | what it is                        |
| ---------------------- | ---------------- | --------------------------------- |
| `text-price-card`      | 13.5 → 15        | the rate on a product card        |
| `text-price-detail`    | 17 → 18          | the rate in the PDP buy box       |
| `text-price-hero`      | 27 → 38          | cart total                        |
| `text-price-unit`      | 9.5 → 10.5       | the `/ 1 pcs` suffix              |
| `text-product-name`    | 11.5 → 12.5      | product name                      |
| `text-brand`           | 8.5 → 9          | brand line                        |
| `text-chip`            | 8.5 → 9          | pack and MOQ chips                |
| `text-meta`            | 9 → 9.5          | dispatch line, sub-labels         |
| `text-page-title`      | 15 → 22          | page title                        |
| `text-heading-section` | 15 → 22          | section heading                   |
| `text-heading-row`     | 15 → 18          | merchandised row title            |
| `text-heading-sub`     | 13 → 14          | "Order quantity", "Total payable" |

**Price is three roles, not one.** Card, detail and total are different jobs at 13.5 / 17 /
27px on mobile; collapsing them would flatten a real hierarchy.

**`page-title` and `heading-section` resolve to the same value, deliberately.** Do not merge
them. They are different things in every design system; the prototype merely happens to size
them alike (24px vs 22px, a delta nobody perceives). Two names means raising page titles later
is one line, not a hunt across five screens.

##### How this was derived — read before regenerating

**Element-by-element, not by a line scan.** The prototype puts several elements on one line,
so a per-line `font-size` scan merges them and invents disagreements that are not there. The
first pass reported the MOQ chip as having two treatments (amber-700 and slate-600); unwrapping
the markup showed line 354 is the chip and line 443 is an unrelated element. **Anything
rederived with a line scan will reach the wrong answer.**

Three genuine self-disagreements were found, all near-value accidents, each resolved to one
token rather than two: `price-unit` mobile 9 vs 9.5 (took 9.5, the product-card instance),
`chip` mobile 8 vs 8.5 (took 8.5, 6 of 9 uses), and the page-title/section 24 vs 22 above.

##### Why not `clamp()`

It would handle 768–1023px gracefully, which is our weakest breakpoint. Rejected anyway,
deliberately: a clamped value is **uninspectable** — no checker can assert "13.5px at 390px"
against it. Fidelity to a reference is the goal, so explicit and greppable wins. Do not
relitigate without first solving the assertability problem.

##### No colour tokens, no weight tokens, no line-height tokens

- **Colours:** all ten of the prototype's colours are _already_ Tailwind palette entries
  (`#dc2626` = `red-600`, `#94a3b8` = `slate-400`, `#b45309` = `amber-700`, …), and
  `--xl-accent` already means "the brand accent". A `--color-brand` would be a second name
  for a colour that already has one — the same defect as the two `.container` rules in #167.
- **Weights:** the prototype uses 500/600/700/800 = `font-medium`/`semibold`/`bold`/`extrabold`.
- **Line heights:** the prototype declares one only 42 times in 2000 lines, at values from 1.2
  to 1.65 with no per-role pattern. Inventing one per token would be fabrication; call sites
  set `leading-*` where the prototype actually specifies it.

shadcn/ui theme variables live in `:root` as **OKLCH** values mapped through `@theme inline`
(`--background`, `--foreground`, `--card`, `--primary`, `--border`, `--ring`, `--radius`,
the `--chart-*` and `--sidebar-*` ramps, etc.). Notable:

- `--primary: oklch(0.505 0.225 27.325)` ≈ **brand red `#DC2626` (Tailwind `red-600`)**.
- `--radius: 0.65rem`, with `--radius-sm/md/lg/xl` derived from it.
- `--destructive` is also red — destructive actions and the brand share the red hue.

**Colors used at call sites** are still mostly Tailwind palette utilities (`red-600`,
`emerald-500/600`, `slate-*`, `amber-*`), not custom hex — keep it that way (no new hex).

### 1.3 Semantic color usage

| Color                                 | Meaning                                                            | Examples                                                            |
| ------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| **Brand red** (`red-600` / `#DC2626`) | Primary action, brand identity, active/selected state, destructive | Add-to-cart, "Publish", active nav pill, selected tree node, Delete |
| **Emerald** (`emerald-500/600`)       | Success / positive / "live & available"                            | "Available" stock dot, published badge, in-cart confirmation        |
| **Amber** (`amber-500/700`)           | Attention / "needs a decision", the **On-Enquiry** price state     | "On Enquiry" label, active missing-data filter                      |
| **Slate** (`slate-*`)                 | Neutral text, borders, surfaces, disabled                          | Body copy, table borders, muted metadata                            |
| **Red tint** (`red-50` / `red-400`)   | Missing required data inline                                       | Red-tinted price/description/image cells in the Catalog Editor      |

### 1.4 Typography & spacing

- **Font:** Inter (`--font-sans`), preloaded in `index.html`, applied on `<body>`.
- **Type scale (storefront, since the Foundation pass):** Tailwind's native
  `text-xs/sm/base/lg/xl/2xl/4xl` for anything that already fits, plus the four custom
  tokens in §1.2 (`text-caption`/`text-body-sm`/`text-body-md`/`text-display`) for the sizes
  Tailwind's scale doesn't cover. The storefront (`Home.tsx`, `Header.tsx`, `Footer.tsx`,
  `ProductCard.tsx`, `Catalog.tsx`, `ProductDetail.tsx`) has been migrated off one-off
  `text-[Npx]` arbitrary values onto this set — new storefront work should reach for a named
  size first and only fall back to an arbitrary value for a genuinely one-off case.

  > **Correction (19 Aug 2026).** "Has been migrated" was false. Measured on the live build,
  > `10.5px` renders **72 times** on `/catalog` alone, `12.5px` 24 times, and **15 non-admin
  > files** still carry `text-[Npx]`. The migration was incomplete, and it was incomplete
  > because the **scale was too small to express the design** — not because anyone was
  > careless. The role scale above is what makes finishing it possible, and what makes
  > "no arbitrary `text-[Npx]`" an enforceable checker rule rather than an aspiration. Admin
  > screens haven't been migrated yet (out of scope for the storefront pass); they still use
  > ad hoc Tailwind text utilities.

- **Spacing rhythm (storefront sections):** a documented convention, not a new token layer —
  Tailwind's numeric spacing scale already covers every step needed:
  - `py-8` — compact utility strips (kept distinct; not part of the 3-step "section" rhythm)
  - `py-12 md:py-16` — standard content sections (category grid, featured/showcase, trust)
  - `py-14 md:py-20` — hero only
    New full-width Home sections should pick the step matching their visual weight instead of
    a one-off `py-*` value. See `client/src/index.css`'s comment block above `@layer base` and
    `docs/STOREFRONT_DESIGN_PROPOSALS.md` §4 for the full rationale (including why the two
    slim utility strips — trust strip, marquee — are deliberately excluded from this rhythm
    rather than forced into it).
- **Radii:** come from `--radius` (0.65rem) via `rounded-lg`/`rounded-xl`. Cards are
  typically `rounded-xl border border-slate-200`.
- **Container:** `client/src/index.css`'s `.xl-shell` utility is the single mechanism for
  page-width sections — storefront pages previously hand-rolled
  `max-w-7xl mx-auto px-4 lg:px-8` inline in ~14 places; those now all use
  `className="container"` instead. Use `.container` for any new full-width section rather
  than reintroducing the inline pattern.

  > **RESOLVED, 19 Aug 2026 — the cap is 1440px and the class is now `.xl-shell`.**
  >
  > The discrepancy this entry recorded was real and is now measured, not inferred.
  > Two `.container` rules shipped: ours in `@layer components`, and Tailwind's own
  > `container` utility emitting `max-width` at 40/48/64/80/96rem. Tailwind's landed
  > later at equal specificity, so it won the `max-width` while ours supplied only the
  > padding — nine `.container` rules in the compiled CSS. Measured live on `main`: a
  > **800px viewport gave a 768px shell**, and 1600px gave 1536px. Our own comment
  > claimed to "override Tailwind's default container behavior"; it never did.
  >
  > **The cap is 1440px**, from the prototype's desktop shell
  > (`design-reference/xl-traders-storefront.source.dc.html`, `max-width:1440px`).
  >
  > **The collision is gone because the class is renamed**, not because one rule was
  > deleted. `@utility container` was tried first and did **not** replace the built-in —
  > verified in the compiled CSS, both still emitted. Tailwind v4 emits `.container`
  > unconditionally: with zero references anywhere in `client/src`, `index.html`,
  > `design-reference` or `dist`, the six built-in rules are still output. So the
  > storefront's shell is `.xl-shell`, defined once via `@utility`, and Tailwind's
  > `.container` remains in the bundle as ~150 bytes of dead CSS that nothing selects.
  >
  > After: 1600px → **1440** (was 1536); 800px → **785** (was 768, now fills).
  > `Account.tsx` composes `xl-shell max-w-2xl`; `.max-w-2xl` is emitted later in the
  > cascade, so the narrower cap still wins.

> Still open: the token comment in `client/src/index.css` originally promised a brand color
> ramp and WhatsApp colors "in a later pass" — those remain **not** in `@theme` yet; call
> sites still use plain Tailwind palette utilities (`red-600`, `emerald-600`, etc.) per §1.3.
> The type-scale piece of that promise is now delivered (above).

### 1.5 Mobile: one system, layout switch (not a fork)

Same routes, same services, same data — only the **chrome/presentation** changes below
`md`. **The two halves of the app reach that differently, and this entry used to claim
otherwise.**

- **Storefront: Tailwind breakpoints only, no JS switch.** `MobileNav` is rendered
  unconditionally by `Header` and hides itself with `md:hidden`; `Footer`, `LocationBar`
  and the catalogue filter sheet do the same. **No storefront file imports
  `useIsMobile`** — verified by grep; the only match in `Footer.tsx` is a comment saying
  it deliberately does not. One component tree, so the two states cannot drift.
- **Admin: `useIsMobile()`** in [`client/src/hooks/useMobile.tsx`](../client/src/hooks/useMobile.tsx)
  (`matchMedia`, breakpoint **768px**). `MobileAdminShell` (bottom tabs + "More") wraps the
  identical section content the desktop layout renders. Admin needs the JS switch because it
  swaps whole components, not just visibility.

**Rule:** never build a parallel mobile system or duplicate routes/services. On the
storefront reach for a Tailwind breakpoint; branch on `useIsMobile()` only when the mobile
and desktop trees are genuinely different components, as in admin. (The removed `/admin-v2`
is the cautionary tale — see §4.)

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
- **Colour:** the On-Enquiry state renders **amber** (§1.3), not slate. It was slate italic
  on `ProductCard` until the PR-0 pass.

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
- **DB migrations: SQL is agent-executable** (standing grant, 29 Jul 2026 — see
  `CLAUDE.md` Critical Rule #3, which explicitly supersedes the old "Supabase SQL
  Editor only, never via agent" rule this line used to carry). Two conditions:
  announce destructive operations in the reply before running them, and append every
  executed statement to [`CHANGELOG_SQL.md`](CHANGELOG_SQL.md) with a one-line reason.
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
