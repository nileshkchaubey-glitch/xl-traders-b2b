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

| Token | Value | Usage |
| --- | --- | --- |
| `--font-sans` | `"Inter", ui-sans-serif, system-ui, …` | Applied to `<body>`; Inter everywhere |
| `--color-admin-bg` | `#f4f6f9` | Admin shell background (`bg-admin-bg`) |
| `--color-admin-sidebar` | `#1a1d27` | Admin dark sidebar (`bg-admin-sidebar`, 220px) |
| `--shadow-red` | `0 10px 15px -3px rgb(220 38 38 / 0.25)` | Red CTA glow (`shadow-red`) |
| `--shadow-emerald` | `0 10px 15px -3px rgb(5 150 105 / 0.3)` | Emerald CTA glow (`shadow-emerald`) |

shadcn/ui theme variables live in `:root` as **OKLCH** values mapped through `@theme inline`
(`--background`, `--foreground`, `--card`, `--primary`, `--border`, `--ring`, `--radius`,
the `--chart-*` and `--sidebar-*` ramps, etc.). Notable:

- `--primary: oklch(0.505 0.225 27.325)` ≈ **brand red `#DC2626` (Tailwind `red-600`)**.
- `--radius: 0.65rem`, with `--radius-sm/md/lg/xl` derived from it.
- `--destructive` is also red — destructive actions and the brand share the red hue.

**Colors used at call sites** are still mostly Tailwind palette utilities (`red-600`,
`emerald-500/600`, `slate-*`, `amber-*`), not custom hex — keep it that way (no new hex).

### 1.3 Semantic color usage

| Color | Meaning | Examples |
| --- | --- | --- |
| **Brand red** (`red-600` / `#DC2626`) | Primary action, brand identity, active/selected state, destructive | Add-to-cart, "Publish", active nav pill, selected tree node, Delete |
| **Emerald** (`emerald-500/600`) | Success / positive / "live & available" | "Available" stock dot, published badge, in-cart confirmation |
| **Amber** (`amber-500/700`) | Attention / "needs a decision", the **On-Enquiry** price state | "On Enquiry" label, active missing-data filter |
| **Slate** (`slate-*`) | Neutral text, borders, surfaces, disabled | Body copy, table borders, muted metadata |
| **Red tint** (`red-50` / `red-400`) | Missing required data inline | Red-tinted price/description/image cells in the Catalog Editor |

### 1.4 Typography & spacing

- **Font:** Inter (`--font-sans`), preloaded in `index.html`, applied on `<body>`.
- There is **no formal type scale token set yet** — the `@theme` header comment explicitly
  defers "the full type scale … to a later pass." In practice components use Tailwind text
  utilities directly (`text-2xl font-bold` headings, `text-sm` body, `text-xs`/`text-[11px]`
  metadata, `tabular-nums` for prices).
- **Spacing/radius:** Tailwind's default spacing scale; radii come from `--radius` (0.65rem)
  via `rounded-lg`/`rounded-xl`. Cards are typically `rounded-xl border border-slate-200`.

> Discrepancy to close later: the token comment promises a brand color ramp, WhatsApp colors,
> and a type scale "in a later pass." Those are **not** in `@theme` yet — call sites use
> palette utilities. Treat the table above as the source of truth until that pass lands.

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
isPriceOnEnquiry(price)  // true when price is null/undefined OR <= 0
cartLinePrice(price)     // 0 for on-enquiry items, else the real price
```

- **`0` and `NULL` both mean "On Enquiry."** A price must **NEVER** render as `₹0` anywhere —
  cards, product detail, cart, WhatsApp, admin lists.
- Every render site and every save path funnels through this. On save, blank/0/negative
  coerces to `NULL` (`saveProductForm`, the Catalog Editor inline edit, quick-add, bulk
  import). Consolidated in `CLAUDE.md` under "Null-price safety."

---

## 2. Engineering Standards

### 2.1 Service-layer rule

**Components → `client/src/lib/*Service.ts` → Supabase.** UI never embeds SQL/query logic;
missing/health logic lives only in the `v_product_health` view + `healthService`
(`CLAUDE.md` Architecture Rules #1–#4).

Service modules that exist today (`client/src/lib/`):

| Module | Responsibility |
| --- | --- |
| `productService.ts` | Products CRUD, `getAllAdmin` (paginated, `.range()`), `getAdminMatchingIds`, bulk ops, plus exported `categoryService`, `productImageService`, `enquiryService`, `inquiriesService`, `mediaService`, `storageService` |
| `healthService.ts` | Reads `v_product_health` only (missing counts, ids, category rollup) |
| `masterService.ts` | Product masters & variants |
| `orderService.ts` | Orders / WhatsApp order message |
| `settingsService.ts` | `site_content` + business settings |
| `bulkImportService.ts` / `googleSheetsService.ts` | CSV / Google Sheets import (SKU upsert) |
| `aiService.ts` | AI Smart Paste / description (browser-side API key — see Known Issues) |
| `templateService.ts` | Import template generation |
| Support libs | `catalogHealth.ts` (colors/labels only), `priceUtils.ts`, `imageUtils.ts`, `productForm.ts`, `demoData.ts`, `utils.ts`, `supabase.ts` |
| Stores | `authStore.ts` (`useAuthStore`), `stores/cartStore.ts` |

> **Known discrepancy (flagged, not hidden):** `CLAUDE.md` Rule #1 states "components never
> call Supabase directly," but several admin components still do — `AdminProducts.tsx`,
> `AdminCategories.tsx`, `AdminMasters.tsx`, `AdminOverview.tsx`, `AdminSEO.tsx` import the
> `supabase` client and query it inline. The rule is the **target state**; these are debt to
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

| Component / hook | Role |
| --- | --- |
| `useProductForm` + `lib/productForm.ts` (`saveProductForm`) | **Single source of truth for create/update.** Used by the route editor, `ProductDrawer`, and `CatalogProductPanel` so save logic never forks |
| `ProductDrawer` | Shared right-side quick editor (used by AdminProducts) |
| `CatalogProductPanel` | Catalog Editor's field editor (also on `useProductForm`) |
| `ProductsTable` | Admin products list — **TanStack Table + `@tanstack/react-virtual`** (the only virtualized grid today) |
| `CatalogTreeEditor` | Catalog Editor — group→category tree + a **plain HTML `<table>`** with column toggles, inline edit, bulk, keyboard nav |
| `CategoryCombobox`, `AISmartPasteDialog`, `AdminImageGallery`, `ProductMediaSection`, `MobileAdminShell`, `adminNav.tsx` | Reusable admin building blocks |
| `HealthDot` / `catalogHealth.ts` | Health color/label only (logic stays in the view) |

### 3.3 Planned shared `<DataTable>` — **contract (spec only, not built yet)**

There is **no `DataTable` component today.** Two admin grids exist in parallel: `ProductsTable`
(TanStack + virtualized) and `CatalogTreeEditor` (plain table, richer toolbar). Phase 2 of the
table work will build **one** `<DataTable>` on **`@tanstack/react-table`** — which is **already
a dependency** (`^8.21.3`, alongside `@tanstack/react-virtual ^3.14.3`), so **no new dep is
needed**. Every admin table should eventually consume this one component — **no bespoke grids.**

**Target feature set (20)** — status is relative to what the Catalog Editor already proves out:

| # | Feature | Status |
| --- | --- | --- |
| 1 | Column sort | `[quick]` — `getAllAdmin` already accepts `sortField`/`sortAscending`; needs header UI |
| 2 | Per-column filter | `[medium]` |
| 3 | Column resize | `[medium]` |
| 4 | Hide/show columns | `[DONE in Catalog Editor]` — Columns dropdown + `cols` URL param |
| 5 | Column pin | `[DONE in Catalog Editor]` — Name + checkbox sticky-left |
| 6 | Multi-select rows | `[DONE in Catalog Editor]` — checkboxes + select-all-matching |
| 7 | Bulk action bar | `[DONE in Catalog Editor]` — publish / unpublish / delete |
| 8 | Infinite scroll (virtualization) | `[deferred]` — `react-virtual` installed & used by `ProductsTable`; Catalog Editor paginates instead |
| 9 | Sticky header | `[quick]` |
| 10 | Sticky first column | `[DONE in Catalog Editor]` — Name/checkbox sticky-left |
| 11 | Keyboard navigation | `[DONE in Catalog Editor]` — ↑↓←→, Enter edit/save-down, Tab save-right, Esc |
| 12 | Copy/paste (Excel) | `[deferred]` |
| 13 | Right-click menu | `[medium]` — pattern exists in `ProductsTable` (`context-menu`), not yet in Catalog Editor |
| 14 | Row grouping | `[deferred]` — the tree gives group→category filtering, not in-table grouping |
| 15 | Export CSV | `[medium]` — import exists; export doesn't |
| 16 | Save layout | `[quick]` — column choice already persists via URL; extend to full layout |
| 17 | Search | `[DONE in Catalog Editor]` — server-side name/SKU |
| 18 | Pagination | `[DONE in Catalog Editor]` — `.range()` |
| 19 | Density toggle | `[quick]` |
| 20 | Loading skeleton | `[quick]` — `ui/skeleton` exists; grids currently show a spinner |

> When `<DataTable>` is built, `ProductsTable` and `CatalogTreeEditor` should both migrate onto
> it (consolidating the virtualization from one and the toolbar/keyboard/column work from the
> other) so there is exactly one grid implementation.

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
