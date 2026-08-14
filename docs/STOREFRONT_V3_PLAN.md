# Storefront V3 — Audit & Rebuild Plan

**Status: PROPOSAL — Gate 1 deliverable. No code changed, no SQL executed.**
**Date:** 14 Aug 2026 · **Branch:** `docs/storefront-v3-plan`
**Visual target:** `design-reference/xl-traders-storefront.dc.html` (frozen prototype)
**Ordering spec:** [`docs/ORDERING_MODEL.md`](ORDERING_MODEL.md) (accepted; built on, not re-litigated)

---

## 0. How this document was produced, and what is verified

Everything below is grounded in one of three sources, and each claim says which:

| Mark | Meaning |
| ---- | ------- |
| **[code]** | Read in `client/src` / `sql` on this branch. |
| **[db]** | Verified with a read-only query against the live project `danoeaftaazhbldeeuxj`. |
| **[proto]** | Extracted from the frozen prototype by targeted grep (never read in full). |

**Ten live-database facts materially change the plan, and four of them contradict
`CLAUDE.md`.** They are listed in §13.1 because the risk register is where a stale
premise belongs. Read that first if you read nothing else.

Build metrics in §8 come from an actual `npm run build` on this branch (exit 0).
`npm run check` passes on this branch (exit 0).

---

## 1. Inventory — every customer-facing file

Line counts are exact. "Customer-facing" = reachable from a storefront route
(`/`, `/catalog`, `/product/:id`, `/cart`, `/auth`) **[code]** `App.tsx:37-41`.
`components/admin/**` (~15,840 lines) is out of scope and untouched, per the brief.

### 1.1 Routes & shell

| File | Lines | Verdict | Reasoning |
| ---- | ----: | ------- | --------- |
| `main.tsx` | 5 | **KEEP** | Bare `createRoot`. Nothing to change. |
| `App.tsx` | 93 | **REFACTOR** | Correct shape, but only admin is lazy (§8.2) and V3 adds `/categories`, `/search`, `/account`, `/orders` for the 5-tab bottom nav. |
| `components/ErrorBoundary.tsx` | 62 | **KEEP** | Generic, working, no storefront coupling. |
| `contexts/ThemeContext.tsx` | 64 | **REFACTOR** | Today it is a **dark-mode** provider. V3 needs *festival* theming (accent + hero gradient only). Same file, different axis — see §9.2. |
| `pages/NotFound.tsx` | 49 | **KEEP** | Fine as-is. |
| `pages/Auth.tsx` | 251 | **REFACTOR** | Works. Needs the "rates unlock after sign-in" framing **[proto]** (`"Rates and order total are visible once you sign in. Quantities you set now are kept."`) and a post-auth return-to path. |

### 1.2 Chrome

| File | Lines | Verdict | Reasoning |
| ---- | ----: | ------- | --------- |
| `components/Header.tsx` | 604 | **REWRITE** | Carries the utility bar, mega-menu, live search, cart button — *and* renders `MobileNav`, `CartBar`, `InstallPrompt` as side effects. V3 needs sticky search as the primary element and a real search route; the mega-menu's data source changes with §6. Too much changes to refactor in place. |
| `components/MobileNav.tsx` | 69 | **REWRITE** | 4 tabs (Home/Categories/Cart/WhatsApp). V3 spec is 5 (Home/Categories/Search/Cart/Account) with cart badge = **distinct products**, not summed quantity (`:17` sums `i.quantity` today). |
| `components/cart/CartBar.tsx` | 103 | **REWRITE** | Label says `{qty} pcs` where `qty` is a **pack** count (`:21`, `:63`) — the unit bug the brief calls out. V3 format is `₹6,587.00 · 2 Items · 2,200 quantities · View cart`. |
| `components/Footer.tsx` | 146 | **REFACTOR** | Structure is fine; copy claims need the §12 audit applied. |
| `components/InstallPrompt.tsx` | 90 | **KEEP** | Self-contained PWA prompt, no pricing/ordering coupling. |
| `components/SectionEyebrow.tsx` | 25 | **KEEP** | Small shared primitive, 4 importers **[code]**. |
| `components/ImagePlaceholder.tsx` | 22 | **KEEP** | Used by `ProductCard` + `ProductDetail`. |

### 1.3 Product surfaces — the core of the rebuild

| File | Lines | Verdict | Reasoning |
| ---- | ----: | ------- | --------- |
| `components/ProductCard.tsx` | 329 | **REWRITE** | Every V3 requirement lands here: pack chip top-left, stepper overlapping the image, pcs quantities, `Sign in for rates` at identical height. It also holds two of the arithmetic sites that must move to `orderingModel.ts` (`:76` `cartLine.quantity + delta`, `:177` `price / quantity_in_unit`) and two side effects (enquiry + inquiry writes) that do not belong in a card. |
| `pages/ProductDetail.tsx` | 820 | **REWRITE** | Largest storefront file. Needs single per-piece rate, pcs stepper with step snapping, variant switch resetting quantity (ORDERING_MODEL §6.4), spec table hidden when empty, sticky add bar. Also holds the unbacked `order by 2pm` claim (`:271`, §12). |
| `pages/Catalog.tsx` | 740 | **REWRITE** | Offers guest price sorts that **fail at the database** (§13.1-A) and passes unsanitised search text into a PostgREST `or()` filter (§7.4). Filters/sort/pagination all move onto the new list contract (§3). |
| `pages/Home.tsx` | 381 | **REWRITE** | V3 home is hero slideshow + promo banners + 4-across categories + merchandised rows **[proto]**. Little of the current composition survives. |
| `pages/Cart.tsx` | 353 | **REWRITE** | Line display becomes pcs-primary with a `2 boxes × 3,000 pcs` secondary; MOQ + step enforced per line; below-MOQ removes the line with a message. |
| `components/home/HomeCategoryGrid.tsx` | 325 | **REWRITE** | Becomes the 4-across grid, and must consume the single count rule (§6) so zero-product tiles never render. |
| `components/home/HomeCatalogueShowcase.tsx` | 252 | **REFACTOR** | Closest existing thing to a merchandised row. Keep the paginated-fetch discipline; re-skin and re-point at the new list contract. |
| `components/home/HeroMotionTiles.tsx` | 191 | **REWRITE** | V3 hero is a slideshow with `You order, we deliver.` **[proto]**, not rotating tiles. |
| `components/home/HomeDailySuggestion.tsx` | 105 | **DELETE** | An internal *developer* idea-widget rendered on the public home page. Gated `{isDev && …}` (`Home.tsx:375`) so it is not live — but it is 105 lines of admin content in the storefront tree. See §2. |

### 1.4 Cart & ordering

| File | Lines | Verdict | Reasoning |
| ---- | ----: | ------- | --------- |
| `stores/cartStore.ts` | 91 | **REWRITE** | `quantity`→`packs`, add `orderUnit`/`packSize`/`orderStep`, `getTotal` via `lineTotal`, delete `getItemCount`, add `version` to persist. Brief Phase 3 §2–3. |
| `lib/orderService.ts` | 99 | **REFACTOR** | `placeOrder` and `buildWhatsAppMessage` both do `price * quantity` inline (`:6`, `:33`, `:48`) — must route through `lineTotal`. Message format changes to pcs-primary. |
| `lib/priceUtils.ts` | 19 | **KEEP** | The single price rule. `orderingModel.lineTotal` composes `cartLinePrice`. Do not touch. |
| `hooks/useMinOrder.ts` | 35 | **KEEP** | Clean, service-backed, already handles the `loading` race. |
| `components/cart/CartDrawer.tsx` | 299 | **DELETE** | **Dead code — zero importers.** §2. |
| `components/cart/AddToCartButton.tsx` | 155 | **DELETE** | **Dead code — zero importers.** §2. |

### 1.5 Data layer (assessed in full in §3)

| File | Lines | Verdict | Reasoning |
| ---- | ----: | ------- | --------- |
| `lib/productService.ts` | 1271 | **REWRITE (split)** | A god-file exporting **seven** services **[code]**: `categoryService`, `productService`, `productImageService`, `enquiryService`, `storageService`, `mediaService`, `inquiriesService`. §3.2. |
| `lib/supabase.ts` | 203 | **REFACTOR** | Client + every shared type. Types are drifting from the DB (§3.5). |
| `lib/authStore.ts` | 303 | **KEEP** | Handles the documented `TOKEN_REFRESHED` / dedup rules and invalidates the price-columns cache. Sensitive; leave alone. |
| `lib/settingsService.ts` | 347 | **REFACTOR** | Correct pattern (fallbacks + per-field merge). Gains the theme key (§9.2); loses the copy the §12 audit removes. |
| `lib/imageUtils.ts` | 159 | **REFACTOR** | `autoResizeImage` already does WebP. Needs multi-rendition output (§8.3). `normalizeImageUrl` stays until images migrate off Drive. |
| `lib/brandUtils.ts` | 26 | **KEEP** | Single 'Generic' rule. |
| `lib/brandsService.ts` | 143 | **KEEP** | P1 shipped; storefront will read it instead of `getBrands()` (closes a Known Issue). |
| `lib/masterService.ts` | 331 | **KEEP** | Variant reads for the PDP selector. |
| `lib/catalogHealth.ts` | 131 | **REFACTOR** | Colours/labels — but it also generates a meta description containing **"free delivery"** (`:62`). §12. |
| `lib/demoData.ts` | 184 | **KEEP** | Backs `VITE_DEMO_MODE`, used for screenshots without auth. |
| `hooks/useMobile.tsx` | 21 | **KEEP** | Chrome-only breakpoint hook. |
| `index.css` | 282 | **REFACTOR** | Tailwind v4 `@theme`; there is **no `tailwind.config.*`** **[code]** — §4.3. Gains theme-accent variables (§9.2). |

**Totals** — storefront surface: ~7,050 lines across 39 files. Verdicts:
KEEP 15 · REFACTOR 10 · REWRITE 11 · DELETE 3.

---

## 2. DELETE LIST — with grep proof

### 2.1 Safe to delete now (proof included)

**1. `client/src/components/cart/CartDrawer.tsx` — 299 lines**

```
$ grep -rn "CartDrawer" --include=*.tsx --include=*.ts client/src
client/src/components/cart/CartBar.tsx:9:  * bottom-right bar. Reads the same Zustand cart store as CartDrawer/Cart.tsx;
client/src/components/cart/CartDrawer.tsx:31:export default function CartDrawer({ open, onClose }: Props) {
```

Only two hits: its own declaration, and a **prose mention inside a comment**. No
import anywhere. Superseded by `/cart` when the cart page shipped.

**2. `client/src/components/cart/AddToCartButton.tsx` — 155 lines**

```
$ grep -rn "AddToCartButton" --include=*.tsx --include=*.ts client/src
client/src/components/cart/AddToCartButton.tsx:13:export default function AddToCartButton({ product, compact = false }: Props) {
```

A single hit — its own declaration. Zero references of any kind.

This one matters beyond line count: ORDERING_MODEL §1.5 lists
`AddToCartButton.tsx:19,150` among the **nine MOQ consumption sites** that a
pcs-based MOQ would have to be threaded through. Two of those nine are in a file
nothing renders. Deleting it before Phase 3 removes two call sites from the
conversion work.

**3. `client/src/components/home/HomeDailySuggestion.tsx` — 105 lines**

```
$ grep -rn "HomeDailySuggestion" client/src
client/src/pages/Home.tsx:9:import HomeDailySuggestion from "@/components/home/HomeDailySuggestion";
client/src/pages/Home.tsx:375:        {isDev && <HomeDailySuggestion />}
```

One importer, and it is dev-gated so it never renders in production. Its content
is *internal development advice* ("Show product stock status (In Stock / Low Stock
/ Pre-Order)") rendered inside the customer home page. The same data
(`lib/dailySuggestions.ts`, 226 lines) already drives the admin Daily Improvement
widget, which is where it belongs.

**Delete the component; keep `lib/dailySuggestions.ts`** — `AdminDailyImprovementsWidget`
and `contexts/ThemeContext` both reference it **[code]**.

### 2.2 Verify with owner before deleting

| Candidate | Lines | Why uncertain |
| --------- | ----: | ------------- |
| `client/public/images/hero/*` | — | Local hero PNGs feeding `HeroMotionTiles`. If the V3 hero slideshow uses new owner-supplied photography these are dead weight; if it reuses them they must stay. **Needs the A-1 asset decision first.** |
| `lib/demoData.ts` | 184 | Only reachable via `VITE_DEMO_MODE=true`. It was load-bearing for capturing admin screenshots without auth. Keep unless the owner confirms that workflow is retired. |
| `components/ui/chart.tsx` + `recharts` dep | 355 | No storefront use found; admin usage not audited (admin is out of scope). Deleting could shrink the shared chunk, but proving it needs an admin sweep this brief excludes. |
| `sql/02-public-read-policies.sql` | — | Its policies appear to have been **superseded** on the live DB (§13.1-C). Archiving a file that no longer describes reality is probably right, but it is a record of what was run. Owner's call. |

**Nothing else is proposed for deletion.** In particular `components/admin/**`,
`components/ui/**` (except the note above), `hooks/`, and every `*Service.ts`
stay.

---

## 3. Data layer

### 3.1 Assessment of the ten `lib/*Service.ts` files

The brief says "the 10 `lib/*Service.ts` files". That count is exact — but it is
misleading, because **seven more service objects hide inside `productService.ts`**
**[code]**:

```
lib/brandsService.ts:37     export const brandsService
lib/healthService.ts:64     export const healthService
lib/masterService.ts:30     export const masterService
lib/orderService.ts:4       export const orderService
lib/settingsService.ts:294  export const settingsService
lib/productService.ts:62    export const categoryService        ← god-file
lib/productService.ts:389   export const productService         ← god-file
lib/productService.ts:873   export const productImageService    ← god-file
lib/productService.ts:941   export const enquiryService         ← god-file
lib/productService.ts:991   export const storageService         ← god-file
lib/productService.ts:1124  export const mediaService           ← god-file
lib/productService.ts:1265  export const inquiriesService       ← god-file
```

| Service | Lines | Verdict | Note |
| ------- | ----: | ------- | ---- |
| `productService` (the file) | 1271 | **SPLIT** | 7 services in one module. Any storefront import of a category pulls the media library and the storage uploader into the storefront chunk. |
| `aiService` | 298 | **KEEP** | Admin-only. Browser-exposed key is a known issue, out of scope. |
| `bulkImportService` | 751 | **KEEP** | Admin-only. |
| `googleSheetsService` | 85 | **KEEP** | Admin-only. |
| `templateService` | 294 | **KEEP** | Admin-only. |
| `healthService` | 194 | **KEEP** | Admin-only; correctly thin over `v_product_health`. |
| `masterService` | 331 | **KEEP** | Shared. Variant reads for the PDP. |
| `brandsService` | 143 | **KEEP** | Shared. Storefront should adopt it (§13.1-F). |
| `orderService` | 99 | **REFACTOR** | §1.4. |
| `settingsService` | 347 | **REFACTOR** | §9.2. |

**Split plan** (mechanical, no behaviour change — its own PR):

```
lib/productService.ts  →  lib/catalog/categoryService.ts
                          lib/catalog/productService.ts
                          lib/catalog/productImageService.ts
                          lib/media/storageService.ts
                          lib/media/mediaService.ts
                          lib/leads/enquiryService.ts
                          lib/leads/inquiriesService.ts
```

Re-export a barrel from the old path so no admin import changes and the diff stays
reviewable.

### 3.2 The types the new storefront reads

Today every surface consumes the full `Product` **[code]** `supabase.ts:45-83` —
40 fields, most of them admin-only (`na_fields`, `meta_title`, `barcode`,
`display_order`). The storefront should read purpose-built view models, produced
by one mapper each (`toCardModel` is already the plan of record in
`STYLE_REFERENCE.md` §4.1).

```ts
// lib/catalog/types.ts — what the storefront reads. Nothing else.

/** Guest-safe. Every field here is SELECT-granted to anon [db]. */
export interface ProductSummary {
  id: string;
  name: string;
  sku: string | null;
  categoryId: string;
  brand: string | null;          // via brandLabel() — 'Generic' already stripped
  imageUrl: string | null;
  imageAlt: string | null;
  unitOfMeasure: string;         // names the PIECES inside the pack
  packSize: number | null;       // quantity_in_unit
  orderUnit: "pack" | "pcs";     // Phase 2 column
  orderStep: number | null;      // Phase 2 column
  isFeatured: boolean;
  masterId: string | null;
  variantLabel: string | null;
}

/** NEVER guest-readable. Only ever produced by lib/catalog/pricingService.ts. */
export interface ProductRate {
  productId: string;
  packPrice: number | null;      // products.price — one selling unit
  minPacks: number;              // products.moq
}

/** What a card renders. Rate is null for guests — the slot stays, the value goes. */
export interface CardModel {
  product: ProductSummary;
  spec: OrderingSpec;            // from orderingModel.resolveOrderSpec()
  rate: ProductRate | null;
}
```

### 3.3 Guest-safe columns — verified, not assumed

**[db]** `anon` holds SELECT on exactly these `products` columns:

```
brand, category_id, created_at, description, display_order, id,
image_alt_text, image_description, image_url, is_active, is_featured,
master_id, name, quantity_in_unit, sku, specifications, status,
unit_of_measure, updated_at, variant_label, variant_sort
```

**Not granted:** `price`, `mrp`, `discount_percent`, `moq`, `barcode`,
`bulk_price`, `bulk_threshold`, `brand_id`, `meta_title`, `meta_description`,
`na_fields`, `slug`.

Two consequences the code does not currently reflect:

1. **`moq` is invisible to guests.** `ProductCard.tsx:146-151` builds a spec line
   including `MOQ ${product.moq}` in *every* auth state and comments that this is
   so "signed-out visitors" get pack **and MOQ** information. They do not — the
   column is never selected, so `product.moq` is `undefined` and that half of the
   line silently vanishes. The V3 brief asks for an MOQ chip on the card, and the
   prototype states **"Sign in to see per-piece rates · MOQ shown on every card"**
   **[proto]**. **This is an open decision — §14, Q1.**
2. **`master_id` / `variant_label` / `variant_sort` are granted but never
   selected.** `GUEST_PRODUCT_COLS` **[code]** `productService.ts:23-26` omits
   them, so the guest PDP cannot render a variant selector even though the
   database would allow it. V3 should add them to the guest list. (`variant_sort`
   exists in the DB but not in the TS `Product` type at all — §3.5.)

### 3.4 How the guest query simplifies — recommendation

Today, one query shape serves both audiences and branches on an async session
check whose cache is **security-critical** **[code]** `productService.ts:28-50`:
a stale `true` after logout leaks price columns, which is why `authStore` must
call `invalidateSessionCache()` on every auth event.

Because a guest now sees **no price at all**, that branch can be removed from the
browse path entirely:

> **Browsing is always the guest-safe query. Price is a separate call that only
> exists for authenticated users.**

```
listProducts(filters)        → ProductSummary[]   guest-safe columns, always
countProducts(filters)       → number             HEAD count, always
pricingService.getRates(ids) → ProductRate[]      authenticated only
```

Why this is the right trade:

- **The ABSOLUTE constraint becomes structural.** `price`, `mrp` and
  `price_per_piece` are named in exactly **one module**, which is unreachable
  without a session. "Never grant `price_per_piece` to anon" stops depending on a
  column list staying in sync with a SQL file.
- **It removes a security-critical cache**, and with it the stale-`true` leak
  class.
- **It structurally kills the guest sort bug** (§13.1-A): a query that cannot name
  `price` cannot `ORDER BY` it either.
- **Browse responses become identical for every visitor** — cacheable, and a
  precondition for any future CDN/edge caching.

The cost is one extra round-trip for signed-in users on list pages, and it is
sequential (rates need ids). That is affordable **specifically because of the V3
card spec**: the price slot is a fixed-height reserved area that must not change
height between states, so it can render a skeleton and swap in without layout
shift — the same slot that already has to exist for guests.

**Rejected alternative:** keep one branching query. Fewer requests, but it keeps
the security-critical cache and leaves the price gate dependent on a hand-maintained
column string. Not worth one round-trip.

### 3.5 Type drift found

- `variant_sort` exists on `products` **[db]** but is absent from the `Product`
  interface **[code]**.
- `supabase.ts:6` calls `createClient(supabaseUrl, supabaseAnonKey)` with **no
  fallback**, while `productService.ts:13-15` comments that "the supabase client
  now always has real credentials via built-in fallbacks". The comment is wrong;
  a missing env var throws at module load. Fix the comment (or add the fallback),
  do not leave both.
- `Order` has no `user_id` **[db]** — see §11 / §13.1-E.

---

## 4. Component architecture

### 4.1 Layering (unchanged rule, enforced harder)

```
pages/            route composition only — no Supabase, no arithmetic
components/       presentational; receive view models, emit intents
lib/*Service.ts   the ONLY place supabase is imported
lib/orderingModel.ts   the ONLY place packs↔pcs↔money convert
```

One violation exists today and is in scope to fix as a side effect:
`ProductCard` performs two service writes directly (`enquiryService.create`,
`inquiriesService.create`) and owns the WhatsApp message. That moves to a
`useProductEnquiry()` hook. (`AdminCategories.tsx:52` imports supabase directly
too, but that is admin — noted, not touched.)

### 4.2 Reuse of `components/ui`

Already present and sufficient — **no new UI dependency is proposed.** V3 uses:
`button`, `badge`, `card`, `input`, `sheet` (mobile filters), `drawer` (vaul, for
bottom sheets), `accordion` (FAQ), `skeleton` (the price slot, §3.4), `separator`,
`dialog`, `carousel` (embla — hero slideshow), `tabs`, `breadcrumb`, `sonner`.

New storefront components, all thin:

```
components/storefront/
  PackChip.tsx           "Pack of 1500" | "Box of 900" | "Roll · 72"
  PriceSlot.tsx          fixed-height: rate | "Sign in for rates" | skeleton
  QtyStepper.tsx         pcs stepper; snapping delegated to orderingModel
  DispatchLine.tsx       per-product dispatch copy
  MoqNotice.tsx          "Minimum order: N pcs"
  ProductCard.tsx        composes the above
  BottomNav.tsx          5 tabs
  StickyCartBar.tsx      sits above BottomNav
  BackToTop.tsx
  PromoBanner.tsx
  CategoryTile.tsx
```

### 4.3 Design tokens — what actually exists

There is **no `tailwind.config.*` in the repo** **[code]**; Tailwind v4 with a
single `@theme` block in `index.css:56-87`. Available today:

```
--font-sans
--color-admin-bg  --color-admin-sidebar
--shadow-red      --shadow-emerald
--text-caption (11px)  --text-body-sm (13px)  --text-body-md (15px)  --text-display (46px)
```

Brand red is plain Tailwind `red-600` — **there is no brand colour token.** V3
adds exactly the tokens festival theming needs (§9.2) and nothing else. Two
documented open items stay open and are **not** resolved here: the competing
`.container` caps (`DESIGN_SYSTEM.md` §1.4) and whether sub-11px type enters
`@theme`.

---

## 5. `category-images` bucket

**Confirmed broken [db]:** `storage.buckets` contains exactly one row —
`product-images` (public). There is no `category-images` bucket, yet
`AdminCategories.tsx:53` and `MobileCategorySheet` upload to it. **Every category
image upload throws today.**

Yet 33 of 38 active categories already have an `image_url` **[db]** — those point
at Google Drive, uploaded by another route.

### Specification

| Item | Decision |
| ---- | -------- |
| Bucket | `category-images`, **public read** (mirrors `product-images`). |
| Path | `categories/{categoryId}-{timestamp}.{ext}` — exactly what the code already writes, so no client change is needed. |
| Write policy | `INSERT`/`UPDATE`/`DELETE` restricted to `is_admin()`. **Not** `authenticated` — that is the mistake §13.1-D exists to avoid repeating. |
| Read policy | `SELECT` to `anon` + `authenticated`. |
| Admin upload path | Unchanged code path; add `autoResizeImage(file, 800, 0.85, "webp")` before upload, which `AdminCategories` currently skips. |
| Storefront fallback | Ordered chain, no JS toggling: `category.image_url` → lucide `FALLBACK_ICONS` layered underneath (the PR-0 pattern, `STYLE_REFERENCE` §4.3) → never a blank tile. |

Same shape for `banner-images` (§9.1).

---

## 6. Category tile counts — ONE rule

### The rule

> **A category's count is the number of products with `status='published' AND
> is_active=true` in that category. A group's count is the sum of its categories'.
> A category whose count is 0 is never rendered.**

### Why "never zero" is not cosmetic here

**[db]** — **17 of 38 active categories currently have zero live products**, i.e.
**45% of category tiles would render "0 items"**:

```
Balloon Pump, BALLOON SET, Balloons Accessories, Burger & Sandwich Box,
Cake Toppers, Cap & Gloves, Curl Ribbon, Danglers, Foil Balloon,
Ice Cream Cup, Latex Balloons, Paper Confetti, Paper Fan, Party Goggles,
Party Props, Party Sash, Snow Spray
```

Nearly the whole `Decoration & Party` group is empty. `Burger & Sandwich Box` is
the instructive one: it has **2 products, both drafts** — so a naive count over
`products` shows "2 items" and clicking through yields an empty page. The count
must apply the publish gate, not just the FK.

### Where it is computed — one place

A client-side aggregation is what `categoryService.getProductCounts()` does today
(`productService.ts:97-109`): it selects **every** `category_id` row and counts in
JS. At 143 products that is fine; at the 10,000-product goal it transfers ~10,000
UUIDs (~360 KB) on every home render. It also ignores the publish gate entirely,
so it is wrong for the storefront regardless of size.

**Decision: a database view** (additive DDL, Phase 2):

```sql
CREATE OR REPLACE VIEW public.v_category_live_counts AS
  SELECT category_id, COUNT(*)::int AS live_products
  FROM public.products
  WHERE status = 'published' AND is_active
  GROUP BY category_id;

GRANT SELECT ON public.v_category_live_counts TO anon, authenticated;
```

One tiny query (≤38 rows today, ≤ #categories forever), guest-safe, and the rule
lives in SQL where it cannot be re-implemented per component — the same discipline
`v_product_health` already establishes (Architecture Rule #2). Exposed as
`categoryService.getLiveCounts(): Promise<Record<string, number>>`; the mega-menu,
the home grid, the `/categories` route and the catalog sidebar all consume that one
function and filter `count > 0` there.

**Note for the owner:** this *hides* 17 categories rather than deleting them. They
reappear the moment a product in them is published. That is the intended behaviour
(§2.2-B1), but it does mean the storefront will show ~21 categories, not 38.

---

## 7. Scale to ~10,000 products

Today: 143 products **[db]**. Target: 10,000 — a **70×** increase.

### 7.1 What holds

- **Pagination is already server-side and correct.** `getAll` uses `.range()` and
  `countPublished` is a HEAD `count: exact` **[code]** `productService.ts:429-433`,
  `448-467`. The comment records that it previously fetched everything and broke
  past PostgREST's 1000-row cap. This is fine at 10k.
- **Sorting** on `name` / `created_at` / `display_order` is indexable.

### 7.2 What breaks — search

Every search path is `ILIKE '%q%'` **[code]** (`:278`, `:318`, `:581`, `:691`).
A leading wildcard cannot use a B-tree index, so all four are sequential scans.
At 143 rows: invisible. At 10,000 rows, run on **every debounced keystroke** in
the header (`Header.tsx:105`), it is the first thing that will fall over.

### 7.3 Decision: `pg_trgm` GIN — not full-text search

**`pg_trgm` is already installed on this project (v1.6) [db].** `unaccent` is
available but not installed. This is the deciding fact: the trigram route is an
index, not a migration.

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS products_name_trgm_idx
  ON public.products USING GIN (name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS products_sku_trgm_idx
  ON public.products USING GIN (sku gin_trgm_ops);
```

| | `pg_trgm` GIN | Postgres FTS (`tsvector`) |
| --- | --- | --- |
| Extension | **already installed** | built-in |
| Client query change | **none** — `ILIKE %q%` becomes indexed | rewrite to `websearch_to_tsquery`; PostgREST needs `.textSearch()` |
| Schema change | index only | generated `tsvector` column + index + grant |
| Substring / as-you-type | **native** ("ripp" → "Ripple Cup") | poor — needs prefix hacks |
| Typos | **tolerant** (similarity) | none without extra work |
| Stemming ("cup"/"cups") | no | yes |
| Relevance ranking | similarity only | `ts_rank`, better |

**Decision: `pg_trgm` GIN now.** The storefront's search is a live as-you-type
substring match over short product names — trigram's strength and FTS's weakness.
It also requires *zero* client change, so it can ship as a pure index PR and be
measured. Revisit FTS only if *ranking quality* becomes the complaint; the two are
not mutually exclusive.

### 7.4 A search bug found on the way — must fix regardless

`applyPublicScalarFilters` interpolates raw user input into a PostgREST `or()`
filter with **no sanitisation** **[code]** `productService.ts:316-319`:

```ts
query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
```

The **admin** equivalent strips `[,()]` first (`:277`) precisely because those
characters terminate the filter grammar. The public path does not. A catalogue
search for `Cup (250ml)` or any comma reaches this from the URL
(`/catalog?search=…`). At best a broken query; at worst filter injection that
alters which rows are returned. Fix in the same PR as §7.3 by routing both through
one sanitiser.

### 7.5 Filters

Category/brand/featured filters are equality predicates. Add
`(status, is_active, category_id)` and `(status, is_active, display_order)`
composite indexes matching the storefront's fixed prefix. Cheap, additive.

---

## 8. Performance

### 8.1 Measured, on this branch

```
$ npm run build          (exit 0, 13.74s, 2232 modules)

assets/index-DMxKXt88.js           942.00 kB │ gzip: 277.57 kB   ← storefront entry
assets/AdminDashboard-B6NGyMV3.js  803.78 kB │ gzip: 244.75 kB   ← lazy, admin
assets/productForm-DIAlJ8hJ.js      34.03 kB │ gzip:   9.01 kB
assets/AdminProductEditor-4fPxwkJ7  19.09 kB │ gzip:   6.18 kB
assets/index-DxXreCM5.css          176.03 kB │ gzip:  27.02 kB
PWA precache: 31 entries (2,891 KiB)
```

Vite's own warning fires on both large chunks.

**~278 kB of gzipped JS before the first product is visible.** On a 4G connection
(~1.6 Mbps effective, ~150 ms RTT) that is roughly 1.4–1.8 s of transfer plus
parse/execute on a mid-range Android — leaving essentially no headroom under a
2.5 s LCP budget, before a single image loads.

### 8.2 Cause and fix

Only the two admin routes are lazy **[code]** `App.tsx:19-20`. Home, Catalog,
ProductDetail, Cart and Auth are all statically imported, so the entry chunk is
every storefront page plus everything they touch — including `framer-motion`,
imported by `Home`, `HomeCategoryGrid` and `HomeCatalogueShowcase` **[code]**.

Plan:
1. `lazy()` every route, storefront included; `Home` stays eager.
2. `manualChunks` to split the Supabase client and Radix primitives from page code.
3. Drop `framer-motion` from the critical path — the surviving V3 animations
   (hero crossfade, reveals) are CSS, and the reduced-motion work already treats
   them as optional.
4. Re-measure. **Target: storefront entry < 150 kB gzip.**

### 8.3 Images — the bigger LCP lever

**[db]** image hosting census:

| Host | Products | Published+active |
| ---- | ----: | ----: |
| Google Drive | 127 | 125 |
| Supabase Storage | 15 | 14 |
| No image | 1 | 0 |

**89% of catalogue imagery is on Google Drive** — a third-party host we do not
control, cannot set cache headers on, cannot serve WebP/AVIF from, and which PR-0
already measured failing 90/90 on localhost while working in production.

The prototype is **not** the model here: the brief describes it as embedding
base64 images, but it contains **zero** `data:image` URIs — its product imagery is
placeholder blocks **[proto]**. So it offers no guidance on the real pipeline.

**Decision:** production serves sized WebP from Supabase Storage.

> **Constraint the plan must respect:** Supabase **image transformations are a
> paid-plan feature**, and this project is on the **FREE plan** (CLAUDE.md, Tech
> Stack). There is no on-the-fly resize available. Renditions must therefore be
> **pre-generated at upload time.**

`autoResizeImage` already emits WebP (`imageUtils.ts:19,58`). Extend it to write
three renditions per SKU — `{SKU}-400.webp`, `-800.webp`, `-1600.webp` — through
the existing `storageService.uploadBySku` folder convention, and render `srcset` +
`sizes` with `width`/`height` set so the grid never shifts. Cards request 400,
PDP 800/1600.

Migrating the 127 Drive images is a **content operation, not a code one** — it is
A-1 asset-audit work and is listed as a dependency in §10, not smuggled into a UI PR.

### 8.4 Other

- `loading="lazy"` + `decoding="async"` are already correct on cards **[code]**.
- The LCP element (hero) must be `fetchpriority="high"` and **not** lazy.
- Fonts: Inter is preloaded **[code]** `index.css:57-58`; keep `font-display: swap`.

---

## 9. Promo banners & festival theming — minimum schema

### 9.1 `promo_banners`

Every field below maps to something the brief or the prototype requires; nothing
speculative.

```sql
CREATE TABLE IF NOT EXISTS public.promo_banners (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url    text,                       -- banner-images bucket
  headline     text NOT NULL,
  rate_line    text,                       -- optional; NEVER a computed price
  link_target  text,                       -- '/catalog?category=…' etc.
  position     text NOT NULL DEFAULT 'home_top'
               CHECK (position IN ('home_top','home_mid','category_top')),
  is_active    boolean NOT NULL DEFAULT false,   -- off by default
  sort_order   integer NOT NULL DEFAULT 0,
  starts_at    timestamptz,                -- NULL = always
  ends_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promo_banners_active_idx
  ON public.promo_banners (position, sort_order) WHERE is_active;
```

RLS: `SELECT` to `anon`/`authenticated` where `is_active AND (starts_at IS NULL OR
now() >= starts_at) AND (ends_at IS NULL OR now() < ends_at)`; **ALL to `is_admin()`
only**.

Bucket `banner-images`, public read, admin-only write — same shape as §5.

Two deliberate choices:

- **`starts_at`/`ends_at` are included** even though the brief did not list them.
  Festival banners are inherently dated; without them the owner must remember to
  switch a banner off at 11pm on Diwali. Two nullable columns now is cheaper than
  a migration later.
- **`rate_line` is free text, never derived.** A banner is rendered to guests, and
  a computed rate on a public banner would be a price-gate bypass. The admin types
  a marketing line or leaves it empty. This must be stated in the column comment.

### 9.2 Theming — ONE setting

`site_content` is already a `(key text PK, value jsonb)` store with in-code
fallbacks and a session cache **[code]** — the right home. No new table.

```
site_content key: 'site_theme'
value: { "theme": "default" }   -- default | diwali | holi | monsoon | independence
```

The five values match the prototype's own enum **[proto]** (`siteTheme`:
`default|diwali|holi|monsoon|independence`).

It changes **exactly two things**, enforced by construction: theming sets CSS
custom properties and nothing else.

```css
:root { --xl-accent: theme(colors.red.600); --xl-hero-grad: …; }
[data-xl-theme="diwali"] { --xl-accent: #b45309; --xl-hero-grad: …; }
```

A `data-xl-theme` attribute on `<html>`, set once from the setting. **No component
reads the theme value.** That makes "never layout, never prices" structural rather
than a rule someone has to remember: there is no theme value in scope anywhere a
layout or price decision is made.

`ThemeContext` (today a dark-mode provider) is the natural owner — but note it is
currently on a *different axis*, so this is a refactor of that file, not an
addition to it.

---

## 10. Phase plan

Each PR is independently mergeable, independently testable, ≤ ~15 files.

| # | Branch | Scope | Merge |
| - | ------ | ----- | ----- |
| **1** | `docs/storefront-v3-plan` | This document. | **Gate 1 — owner** |
| **2** | `feat/storefront-v3-schema` | `order_unit`/`order_step` + grants (block [A]+[B]); `price_per_piece` + partial index (block [C], **not** granted to anon); `v_category_live_counts`; `promo_banners` + RLS; `category-images` + `banner-images` buckets + policies; `site_theme` seed. Verification output pasted; `CHANGELOG_SQL.md` in the same commit. | **Owner — do NOT self-merge** |
| **3** | `chore/service-split` | Mechanical split of the `productService.ts` god-file (§3.1) behind a barrel. No behaviour change. | self |
| **4** | `feat/ordering-model-pr-a` | `orderingModel.ts`; `CartItem` reshape; `cartStore` (`setPacks`/`setPcs`/`getLineCount`, persist `version`); mechanical call-site fixes; **guest price-sort fix (§13.1-A)**; vitest + `orderingModel` unit tests. | self |
| **5** | `fix/public-search-sanitise` | §7.4 sanitiser + §7.3 trigram indexes + §7.5 composite indexes. Small, high-value, independently revertable. | self |
| **6** | `feat/storefront-v3-data` | New list contract (§3.4): `listProducts`/`countProducts`/`pricingService.getRates`; `ProductSummary`/`CardModel` types; `getLiveCounts`. Old callers adapted, UI unchanged. | self |
| **7** | `feat/storefront-v3-ui-card` | `ProductCard` + `PackChip`/`PriceSlot`/`QtyStepper`/`MoqNotice`/`DispatchLine`. **Delete `CartDrawer`, `AddToCartButton`, `HomeDailySuggestion`.** | self |
| **8** | `feat/storefront-v3-ui-pdp` | ProductDetail rebuild: single rate, pcs stepper, variant reset, spec table hidden when empty, sticky add bar. | self |
| **9** | `feat/storefront-v3-ui-cart` | Cart page + sticky cart bar + WhatsApp message format. | self |
| **10** | `feat/storefront-v3-ui-shell` | Header/sticky search, 5-tab bottom nav, Back to top, `/categories`, `/search`, `/account` routes, bottom padding. | self |
| **11** | `feat/storefront-v3-ui-home` | Hero slideshow, promo banners, 4-across categories, merchandised rows, festival theme wiring. | self |
| **12** | `perf/storefront-splitting` | Route-level lazy loading, `manualChunks`, framer-motion removal; before/after bundle numbers. | self |
| **13** | `feat/storefront-v3-copy` | Apply the §12 unbacked-claims decisions across `settingsService` fallbacks, Footer, PDP, `catalogHealth`. | self |

PR 2 blocks 4, 6, 7, 8, 11. PR 3 should land early to keep later diffs small.
PRs 5 and 12 are independent and can land any time.

---

## 11. Not building — and why each waits

| Not building | Why |
| ------------ | --- |
| **Payments / online checkout** | The order path is WhatsApp + a saved `orders` row. Payment needs a gateway, a server-side price authority (order totals are computed in the browser today) and reconciliation. Out of scope by the brief; blocked on the Edge Function work regardless. |
| **Slab / tier pricing** | Settled: one rate. `bulk_price`/`bulk_threshold` stay unused and unwired. |
| **Standing / recurring orders** | Needs a scheduler and order-state machine; no demand signal yet. |
| **AI search** | §7.3 shows a GIN index solves the actual problem at 10k rows. AI search would add a browser-exposed key (an existing Known Issue) for a problem an index fixes. |
| **Compare** | Catalogue is near-identical black containers; comparison adds UI weight for a decision buyers make on pack size and rate, both already on the card. |
| **Reviews** | B2B repeat-purchase catalogue with ~1 buyer per business; no volume to make ratings meaningful, and it would invite an unbacked social-proof claim (§12). |
| **Wishlist** | `STYLE_REFERENCE` §2.3 explicitly rejects wishlist as the answer to repeat buying; reorder-from-history is. |
| **Half-case (sub-pack) ordering** | ORDERING_MODEL §6.2 defers it with reasoning, and **[db]** confirms the blocker: `order_items.quantity` is `integer`. Fractional packs need a type change, a rounding policy for `subtotal`, and a rethink of "MOQ 1". |
| **Reorder from past orders** | ⚠️ **Listed as settled ("yes, keep it") but there is nothing to keep.** See §13.1-E — this needs a schema decision before it can be planned. |

---

## 12. UNBACKED CLAIMS

Customer-facing copy that promises something not implemented, not verifiable from
data, or contradicted by the settled rules. **No business rule is invented below —
each row states the problem and the options; the owner decides.**

### 12.1 In the prototype

The prototype is **honest about its own placeholders** — it declares them **[proto]**:

```js
// Placeholder tokens — nothing here is a verified claim.
const T = { reorder: tok('REORDER_COUNT'), dispatch: tok('DISPATCH_PROMISE'), freight: tok('FREIGHT_RULE') };
```

| # | Token / copy | Status |
| - | ------------ | ------ |
| P1 | `{{FREIGHT_RULE}}` — 4 render sites (`dispatchLine`, `deliveryNote`, cart summary row `Freight`, `checkoutNote`) | **Remove entirely** per the brief. Note this deletes a *cart summary line*, not just a banner. |
| P2 | `{{DISPATCH_PROMISE}}` | **Resolved** by the owner-confirmed value: `Surat — same day · Outside Surat — 2–3 days`, per product. |
| P3 | `{{REORDER_COUNT}}` + `Order history` / `Quick reorder` / `Recent orders` / `Last ordered` screens | **Unbacked — no data exists.** §13.1-E. |
| P4 | `Deliver to Surat · 395010` | Hardcoded pincode. Either detect/ask, or drop the pincode and say "Surat". |
| P5 | `Payment on delivery or advance UPI` | Not implemented anywhere and not in the settled scope. A payment-terms promise. |

**Clean:** the prototype contains **no** stock claim, no rating, no MRP, no
struck-through price, no discount badge, no customer/SKU count **[proto]** — all
searched, all zero. It is already consistent with the settled pricing rules.

### 12.2 In the shipped code — these are live today

| # | Claim | Location **[code]** | Problem |
| - | ----- | ------------------- | ------- |
| C1 | **"free delivery"** | `lib/catalogHealth.ts:62` — generated **meta description** | Directly contradicts "NO freight claim anywhere". It is in SEO output, so it reaches search results. |
| C2 | **"4.8★ / 4.8 on Google"** | `settingsService.ts:139,143` | Unverifiable rating. Brief bans shipping a customer count; a rating is the same class. |
| C3 | **"500+ businesses served"** | `settingsService.ts:140,149` | Explicitly banned: "Do NOT ship any customer count". |
| C4 | **"10+ Years in Business"** | `settingsService.ts:146` | Unverified. |
| C5 | **"24h Dispatch Promise" / "24h dispatch pan-India"** | `settingsService.ts:134,150,204,215` | Contradicts the confirmed `Outside Surat — 2–3 days`. Two different promises ship simultaneously. |
| C6 | **"Same-day delivery available — order by 2pm"** | `ProductDetail.tsx:271` | A cutoff time that exists nowhere else and is not owner-confirmed. |
| C7 | **"2–4 days · Pan-India"** | `settingsService.ts:126,186` | Conflicts with confirmed "2–3 days". |
| C8 | **"Next-day · South Gujarat"** | `settingsService.ts:125,186` | A third tier the confirmed two-tier copy does not have. |
| C9 | **"GST invoice on every order"** ×5 | `settingsService.ts:135,156,190,216`, `Cart.tsx:334`, `ProductDetail.tsx:709` | Plausible (owner is GST-registered) but `gst_enabled` is **stored-only and not wired to any cart math** (CLAUDE.md). Verify, then keep or soften. |
| C10 | **"we respond within 2 business hours"** ×2 | `settingsService.ts:194,200` | An SLA with no mechanism behind it. |
| C11 | **"bulk orders unlock better rates"** | `settingsService.ts:161` | **Directly contradicts settled pricing** — "NO slab or tier pricing. One rate." |
| C12 | **"Food-grade materials from verified manufacturers"** | `settingsService.ts:166` | "Verified" by whom? No certification data exists (`brands.certifications` is empty). |
| C13 | **"Quality-checked supply"** | `settingsService.ts:165` | No QC process modelled. |
| C14 | **"Order in under a minute" / "wholesale in under 60 seconds"** | `settingsService.ts:131,212` | Performance claim; §8.1 measures ~278 kB gzip before first paint. |
| C15 | **"slab pricing"** in the bulk-quote banner | `settingsService.ts:200` | Same contradiction as C11, in the CTA. |
| C16 | **"Sign in to see exact prices"** | `ProductCard.tsx:198`, `settingsService.ts:161` | Not false, but the settled copy is **"Sign in for rates"**. Align. |

**C11 and C15 are the sharpest:** the site currently advertises slab pricing that
the V3 model explicitly does not implement.

### 12.3 Recommended disposition

Delete C1, C2, C3, C4, C11, C15. Rewrite C5/C7/C8 to the single confirmed
two-tier dispatch line. Drop C6 unless the owner confirms a cutoff. Soften C10,
C12, C13, C14. Confirm C9. Align C16.

**All of this is admin-editable copy** (`site_content` + fallbacks), so PR 13
changes fallbacks and the owner can adjust live without a deploy.

---

## 13. Risk register

### 13.1 Live-database findings that change the plan

Ten facts, verified read-only **[db]**. Four contradict `CLAUDE.md`.

**A. The guest price-sort bug is REAL and live — now proven.**
ORDERING_MODEL §7.4 recorded this as *unverified* because that task forbade running
SQL. Executed as `anon`:

```
anon ORDER BY price          → FAILED: permission denied for table products
anon ORDER BY display_order  → SUCCEEDED
anon SELECT moq              → FAILED: permission denied for table products
anon WHERE price > 0         → FAILED: permission denied for table products
```

`Catalog.tsx` offers "Price: Low to High" to signed-out visitors in **three**
places (`:268`, `:474`, `:650`) with no auth gate. **Every signed-out visitor who
picks a price sort today gets a failed query and an empty catalogue.** Fixed in PR 4.

**B. `CLAUDE.md`'s "Publish gate is TypeScript-only" is STALE.** The live
`products` policies are `anon_read_published_products` USING `(is_active AND
status='published')` and `auth_read_published_products` USING `(… OR is_admin())`.
The gate **is** enforced in RLS.

**C. `CLAUDE.md`'s "any signed-in customer can edit or delete any product" is
STALE.** No `auth_update_products` / `auth_delete_products` / `auth_insert_products`
policies exist. Writes go through `Admins can manage products` USING `is_admin()`.
The `docs/sql/pr1-rls-publish-gate.sql` work appears to have been applied or
superseded. **CLAUDE.md's Known Issues section must be corrected** — leaving it
implies a hardening PR that is already done.

**D. The `product_masters` RLS hole the brief asks Phase 2 to fix is ALREADY
FIXED.** Live policies are `Admins can manage masters` USING `is_admin()` WITH
CHECK `is_admin()`, plus a read policy for active rows. Same for
`product_master_images`. **No policy needs dropping — the Phase 2 "STOP and ask"
risk does not arise.** Phase 2 should verify and record, not change.

**E. "Reorder from past orders" has no data model.** `orders` columns are
`id, created_at, customer_name, phone, status, total_amount, item_count, notes,
source` — **there is no `user_id`**, and no order-history UI exists anywhere in
`client/src`. The brief lists reorder as settled ("yes, keep it"), but there is
nothing to keep. It needs an additive `orders.user_id uuid REFERENCES auth.users`
plus a user-scoped RLS policy. **§14, Q2.**

**F. Three real authorization holes remain** (none in the brief's Phase 2 scope):
- `orders` / `order_items`: `SELECT` USING `auth.role() = 'authenticated'` —
  **any signed-in customer can read every other customer's orders**: name, phone,
  totals. This gets worse the moment reorder ships.
- `inquiries`: `authenticated` can read, update **and delete** all rows.
- `site_content`: `auth write` USING `auth.role() = 'authenticated'` — **any
  signed-in customer can rewrite the storefront's copy**, including the hero.
  Note §9.2 puts the theme setting here too.

Fixing these means **replacing** existing policies, which the brief forbids
without asking. **§14, Q3.**

**G. `sql/02-public-read-policies.sql` is a live landmine.** It creates
`"Public can read active products"` USING `(is_active = true)` — **no status
check**. That policy does **not** exist on the live DB (superseded by
`anon_read_published_products`). But RLS policies are **OR-ed**: re-running this
file — which its own header invites, "run this if the catalog shows 0 products" —
would silently re-expose **every draft product to anonymous users**, defeating the
publish gate. Its header is also wrong about how it is idempotent (it claims
`CREATE POLICY IF NOT EXISTS`, invalid Postgres per Critical Rule #4; the body
actually uses `DROP` + `CREATE`). **Archive or annotate this file in PR 2.**

**H. `pg_trgm` v1.6 is already installed** — §7.3.

**I. 17 of 38 active categories have zero live products** — §6.

**J. 89% of catalogue images are on Google Drive** — §8.3.

### 13.2 Standard risks

| Risk | How we notice | Rollback |
| ---- | ------------- | -------- |
| **Phase 2 SQL deployed after the code that reads it** | Guest product queries fail wholesale ("permission denied") — total storefront outage, not a partial one. | Ordering is mandatory: **SQL first, merge second** (PROPOSAL header). Rollback = revert the deploy, then `R2`. |
| **`price_per_piece` granted to `anon` by accident** | Verification query V3 lists it. Run after *every* grant change, per the brief. | `REVOKE SELECT (price_per_piece) … FROM anon` (`R3`) — closes without dropping. |
| **Cart migration eats live carts** | `version` bump discards old carts by design; a user mid-order loses it. | Only 2 orders exist in the DB **[db]**; the site is not live. Acceptable now, would not be later. |
| **packs/pcs confusion reaches money** | `lineTotal(packs, price)` makes passing pieces a *type* error; vitest covers the ORDERING_MODEL §10 cases. | Revert PR 4; cart shape is self-contained. |
| **Category tiles vanish** (§6 hides 17) | Home shows ~21 tiles, not 38 — visible immediately. | Feature-flag the `count > 0` filter for one release if the owner prefers a staged reveal. |
| **Trigram index churn on bulk import** | GIN writes slow inserts. Import is admin, batched, and rare. | `DROP INDEX` is instant; search degrades to today's seq scan. |
| **Drive images fail in production** | PR-0 measured 90/90 failures on localhost vs 0 in production — **never judge image work from a local screenshot.** | Fallback chain (§5) means a failure degrades to an icon, never a blank tile. |
| **Bundle work breaks a route** | `npm run check` + a click-through of all 5 routes per PR. | PR 12 is isolated and independently revertable. |

---

## 14. Questions for the owner — Gate 1

These four genuinely change what gets built. Everything else in this plan is
decided.

**Q1 — Does a signed-out visitor see MOQ?**
The V3 card spec asks for an MOQ chip and the prototype says "MOQ shown on every
card" **[proto]** — but `anon` has **no SELECT grant on `moq`** **[db]**, and
CLAUDE.md Architecture Rule #3 lists `moq` among the protected columns.
Options: **(a)** grant `moq` to `anon` — it is a quantity, not a price, and cannot
be used to reconstruct one *(recommended)*; **(b)** show the pack chip only, and
reveal MOQ after sign-in.
*This is additive either way and must be settled before PR 2.*

**Q2 — Reorder from past orders: build the data model, or defer?**
`orders` has no `user_id` and no history UI exists (§13.1-E). Options: **(a)** add
`orders.user_id` + a user-scoped read policy in PR 2 and build history in a later
PR *(recommended — the column is additive and cheap now, expensive to backfill
later)*; **(b)** defer entirely and drop the reorder screens from V3 scope.

**Q3 — May I fix the three authorization holes in §13.1-F?**
`orders`, `inquiries` and `site_content` currently let **any signed-in customer**
read all orders, delete all inquiries, and rewrite the storefront's copy. Fixing
them requires **replacing existing policies** — which the brief forbids without
asking. Options: **(a)** scope them to `is_admin()` / owner-only in a dedicated
PR *(recommended — `site_content` is the most urgent, since §9.2 adds the site
theme to that table)*; **(b)** leave as-is and record them.

**Q4 — Confirm the §12.3 copy dispositions.**
Sixteen live claims. The two that most need a decision: **C11/C15** advertise
*slab pricing* that V3 explicitly will not implement, and **C1** puts **"free
delivery"** into the generated SEO meta description while the settled rule is no
freight claim at all.

---

## Appendix — verification commands

```bash
npm run check          # exit 0 on this branch
npm run build          # exit 0; numbers in §8.1
```

Read-only SQL used for every **[db]** claim: column privileges for `anon`;
`pg_policy` dump for 12 tables; `storage.buckets`; `information_schema.columns`
for `orders`/`order_items`; product/category/order counts; the per-category live
count join; the image-host census; `pg_available_extensions`; and a
`SET LOCAL ROLE anon` probe of `ORDER BY price`, `ORDER BY display_order`,
`SELECT moq` and `WHERE price > 0`.
