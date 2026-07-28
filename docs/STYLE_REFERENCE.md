# STYLE_REFERENCE.md

> **Repo path:** `docs/STYLE_REFERENCE.md`
> **Status:** Active. The `⚠️ TODO` items resolved during the PR-0 investigation are closed
> inline below; the ones still needing Nilesh's input are listed at the bottom.
> **Audience:** Claude Code, during storefront UI work.

---

## 0. How to use this file

Read this file **together with** `docs/DESIGN_SYSTEM.md`. They have different jobs:

| File | Answers |
|---|---|
| `DESIGN_SYSTEM.md` | *What are the tokens?* Colors, type scale, spacing, radii. **Binding.** |
| `STYLE_REFERENCE.md` | *How do we compose them?* Density, hierarchy, IA patterns. **Guidance.** |

If the two ever disagree, **`DESIGN_SYSTEM.md` wins.** If this file suggests a value that is not
already a token in `index.css` `@theme`, stop and ask — do not hardcode it.

**This file describes patterns, not pixels.** We are extracting *structural principles* observed in
reference apps. We are not reproducing any other company's visual identity — no copied logos,
illustrations, color palettes, brand voice, or photography. XL Traders' own tokens (red `#DC2626`,
green `#16A34A`, slate) stay unchanged.

### Phase order (authoritative)

Work the storefront in exactly this sequence. Do not reorder or merge phases. `CLAUDE.md`
§Roadmap 0b carries the same list — keep the two in sync.

```
PR-0 bugs → A-1 asset audit → PR-1 trust/hero → PR-2 card
  → PR-3 category tiles → PR-4 mobile shell → PR-5 order again
```

| Phase | Owns | Sections |
|---|---|---|
| **PR-0** ✅ shipped | The four anti-patterns live in our own build | §2.4 #1–#4 |
| **A-1** | Asset audit — bucket, path convention, `product_images` scope. Gates every later visual phase | §4.2 |
| **PR-1** | Trust de-duplication + hero, incl. delivery promise | §2.4 #5, §2.1-A6 |
| **PR-2** | **`toCardModel` + the spec line**, then the rest of the card spec | §4.1, §3.1 |
| **PR-3** | Category tiles, incl. **product counts** | §3.2, §2.2-B1 |
| **PR-4** | Mobile shell — sticky cart, mobile category grid | §2.1-A4, §5 |
| **PR-5** | Order again | §2.3 |

---

## 1. Reference set

Apps studied, and what each was studied *for*:

| App | Segment | Studied for |
|---|---|---|
| PACKZEN | Packaging B2B, mobile-first | Section rhythm, sticky cart, card action placement |
| Hyperpure (Zomato) | Restaurant supply | Delivery-context bar, per-piece pricing, ADD-on-image |
| AaharPack | Packaging B2B | MOQ display, price-range presentation |
| Blinkit | Q-commerce | Delivery promise as hero, "Order Again" as nav tab |
| chfmart | Restaurant supply | Department sectioning |
| DeoDap | General B2B | Price-band browsing |

**Scale caveat — read this before adopting anything.**
PACKZEN and chfmart operate catalogues in the **thousands** of SKUs. XL Traders has **~140**.
Density patterns that look rich at 5,000 SKUs look *abandoned* at 140. Every pattern below carries an
explicit verdict for this reason.

---

## 2. Extracted principles

### 2.1 ADOPT

**A1 · Predictable section rhythm**
Every content block is the same shape: `section header (title + optional subtitle + "View all") →
one row of content (rail or grid)`. No bespoke section layouts. The user learns the pattern once.

**A2 · Every card ends in an action**
No card is a dead end. Product card → `Add` / `Enquire`. Category tile → navigates. A card with
nothing to do is wasted vertical space.

**A3 · Action button overlaps the image, bottom-right**
Frees ~36px of card height vs. a full-width button below the text block. At 2-col mobile this is
the difference between 4 and 5 cards per screen.

**A4 · Persistent cart affordance**
B2B carts are large and built over multiple sessions. Running total (₹ + line count) must be
visible without navigating. Sticky bar above bottom nav on mobile; header pill on desktop.

**A5 · Price always shows unit economics**
Never show only the pack price. Always `₹pack` **and** `₹/pc`. A kitchen buyer compares per-plate
cost; a pack price alone is not decision-grade.

**A6 · Delivery promise is a first-class element, not a footnote**
Blinkit makes it the largest text on the page. For same-day-in-Surat, this is the single strongest
differentiator we have. It currently sits as a small ✓ tick below the hero — that is backwards.

### 2.2 ADAPT

**B1 · Category grid → collapse to real groups**
PACKZEN shows ~40 category tiles. At 140 SKUs that produces mostly-empty categories.
**Adapted rule:** show top-level groups only (currently 5), each with a live product count.
**Never render a category whose count is 0.**
*Status: grouping is live (`HomeCategoryGrid`). The product count is **not** built yet — see §3.2.*

**B2 · Image-forward cards → only where images are distinct**
This is the biggest risk in the whole migration. PACKZEN's image-dominant cards work because their
SKUs look different from each other. Our catalogue is largely black containers and white cups —
twelve near-identical thumbnails in a row conveys nothing.
**Adapted rule:** image gets ~55% of card height (not 70%), and the **spec line
(`pcs/pack · MOQ`) is a permanent, non-truncating element** — for us it is the primary
differentiator, not decoration.
*Status: the spec line shipped in PR-0 and renders in every auth state.*

**B3 · Horizontal rails → cap at 8, always end with a "View all" card**
Infinite rails hide inventory. Cap and hand off to the category page.

**B4 · Price-band browsing → convert to per-piece bands**
DeoDap browses by absolute price ("Under ₹99"). Meaningless at wholesale pack prices.
**Adapted:** `Under ₹0.50/pc · ₹0.50–1 · ₹1–3 · ₹3–8 · ₹8+`. No new data — per-piece is already derived.

### 2.3 REJECT

| Pattern | Why rejected |
|---|---|
| Stacked promo banners (5+ per page) | No campaigns to run; reads as a 2015 marketplace |
| Strikethrough MRP + "% OFF" badges | Wholesale buyers price-check instantly; fake anchors destroy credibility |
| Star ratings on product cards | Zero product reviews exist. Empty stars are worse than none |
| "Trending" / "Recommended" / "New arrivals" rails | No behavioural data — site is pre-launch. Fabricated signal |
| Brand circle rail at top | We stock 3 brands, one of which is a data placeholder |
| Wishlist as a nav tab | B2B repeat buying is served by cart + order history, not wishlist |
| Scrolling trust marquee | Repeats the static trust row directly above it |
| Recently Viewed | Meaningless across a 140-SKU catalogue |

### 2.4 Anti-patterns currently live in our own build

Fix these before layering anything new on top.

1. ~~**Fake 2×2 collage.**~~ **FIXED (PR-0).** Category tiles composited 4 images; since a category
   only ever carries one `image_url`, that meant the same photo rendered four times at 220% zoom —
   verified live as **23 of 25 tiles**, with `maxUniqueSrcsAnyTile === 1`, i.e. the mosaic could
   *never* show four distinct images. Now a single `aspect-[4/3] object-cover` image with the
   in-repo lucide icon as the fallback layer (§3.2, §4.3).
2. ~~**Grid does not stretch.**~~ **FIXED (PR-0).** Desktop rows were a flex row of fixed-width
   (`w-44 xl:w-48`) tiles left-aligned in a wider container: measured **192px of dead space per row
   at 1440px**, ~500px at 1920px, and *clipping* at ~1000px. Now a `1fr` grid whose column count is
   driven by the tile count, so the row reaches the container edge at every width.
3. ~~**`unit_of_measure` leaking into the brand line**~~ — cards rendered `Fortune Petpack · pcs`.
   **FIXED (PR-0).** The unit is not brand information; pack size moved to the spec line.
4. ~~**`Generic` shown as a brand.**~~ **FIXED (PR-0).** It is a null-brand placeholder. Suppressed
   centrally by `brandLabel()` (§4.4) across product cards, product detail, the Home brand chips and
   the marquee.
5. **Trust content repeated 4×** — trust row, marquee, stats block, GST/pricing/quality cards.
   **STILL OPEN → PR-1 (trust/hero).** Not addressed in PR-0.

---

## 3. Card hierarchy spec

### 3.1 Product card — reading order

```
1  product image      ~55% of card height        fallback chain, §4.3
2  action             Add / Enquire              overlaps image, bottom-right
3  brand              mono, 9px, uppercase       hidden entirely when brand is null/Generic
4  name               600, 2-line clamp, fixed min-height
5  spec line          `N pcs/pack · MOQ n`       ← never truncate
6  price block        ₹pack large + ₹/pc
```

> **Resolved:** the original spec opened with a **stock-state badge** and a pack-quantity chip over
> the image. **The stock badge is dropped — the field does not exist.** `Product`
> (`client/src/lib/supabase.ts`) has no stock column, and `productService.ts` explicitly notes that
> `stock_status` belongs to a different schema and is omitted. Do not reintroduce it without a
> schema change (owner-run SQL).

> **Not yet built → PR-2 (card):** items 1–2 (image proportion, action overlapping the image
> bottom-right) and the mono/green-badge treatment on 3 and 6. PR-0 shipped items 3, 4, 5 and the
> On-Enquiry colour only; PR-2 completes the rest alongside `toCardModel` (§4.1).

**Hard rules**
- `price === null || price === 0` → render **"On enquiry"** in amber. **Never `₹0`.** Never a
  strikethrough. The action becomes `Enquire`, not `Add`.
- Per-piece is **derived**, never stored: `price / quantity_in_unit`. Guard against `null` and `0`
  divisor — if `quantity_in_unit` is missing, omit the per-piece badge rather than printing `∞`.
- `price` is the price of **one selling unit (pack/case)**. `quantity_in_unit` is descriptive.
  `moq` counts selling units. (Canonical rule, 25 Jul 2026.) Note this makes `pcs` in the spec line
  **literal** — it counts pieces inside the pack and is *not* `unit_of_measure`.

### 3.2 Category tile

```
1  image             fixed aspect-[4/3], object-cover, single image only
2  name              600, 1 line, ellipsis
3  product count     mono, 10px, muted          ← NOT BUILT — see below
```

**Never** composite multiple images. **Never** render a tile with count 0.

> **Product count → PR-3 (category tiles).** Not shipped. `productService.countPublished()` already
> exists and accepts `categoryId` / `categoryIds`, but it is per-category — 25 calls for one Home
> render. A grouped variant (one published+active query returning `Record<categoryId, number>`) is
> needed first, which is a **service addition** and therefore outside a presentation-only PR. Until
> it lands, the "never render a count of 0" half of §2.2-B1 cannot be enforced either; `Bouffant Cap`
> and `Gloves` are the likely zero-count candidates.

---

## 4. Catalog & asset integration

### 4.1 Service-layer contract is unchanged

The redesign is **presentation-only**. Do not change what `lib/*Service.ts` returns.

```
components  →  toCardModel()  →  lib/*Service.ts  →  Supabase
              (pure, no I/O)
```

Add one pure mapper — proposed `src/lib/catalog/toCardModel.ts` — that turns a service-layer product
into a view model:

```ts
type ProductCardModel = {
  id: string
  name: string
  brandLabel: string | null      // null when brand is absent or 'Generic'
  packLabel: string              // "480 pcs/pack · MOQ 1"
  priceState: 'priced' | 'enquiry'
  priceLabel: string             // "₹5,760"  |  "On enquiry"
  perPieceLabel: string | null   // "₹12.00/pc" | null
  imageSrc: string               // resolved through the fallback chain
}
```

**Why a mapper and not inline logic:** the On-Enquiry rule and the per-piece formula must exist in
**exactly one place**. One pure function is also unit-testable without a DB.

> **Status: `toCardModel` is PR-2 (card).** The full mapper is **not built**. PR-0 shipped only the
> brand half of it as `client/src/lib/brandUtils.ts` (`brandLabel`, `realBrands`), because that rule
> alone had four divergent call sites, plus the **spec line** — which PR-2 also owns and folds in.
> The price rule already lives in one place — `lib/priceUtils.ts`. PR-2 consolidates all three
> (brand, spec line, price/per-piece) into `toCardModel.ts`.

> **Resolved:** the per-piece divisor concern is **data-only, not code.** `ProductCard` already
> guards `quantity_in_unit > 1` before dividing, so no code fix is needed; inconsistent hinged-box
> rows come from per-piece data entry the owner is reconciling manually.

### 4.2 Image storage

⚠️ **STILL OPEN → A-1 (asset audit).** This is the phase immediately after PR-0 and gates every
later visual phase. Proposal:

- Supabase Storage bucket `product-images`, public read.
- Path convention: `products/{sku}/main.webp`, `products/{sku}/2.webp`, …
- Category defaults: `categories/{slug}.webp`
- Brand logos: `brands/{slug}.svg`
- Card requests 400w; PDP requests 800w. WebP only.
- Multi-image needs a `product_images` table (`product_id, path, sort, role`).
  **Nilesh runs this SQL manually in the Supabase SQL Editor. Agents never run migrations.**

> **Field note (PR-0):** category images are currently Google-Drive-hosted
> (`drive.google.com/thumbnail?id=…`). These **fail to load on localhost but work in production** —
> verified 90/90 failing on `localhost:5000` vs 0 failing on `xl-traders-b2b.pages.dev`. Never judge
> image work from a local screenshot; use a preview deploy. This is a strong practical argument for
> the bucket migration above.

### 4.3 Image fallback chain

Applies to every surface. There is no fourth state — nothing ever renders as a blank grey box.

```
product image
  → category default image
    → in-repo category icon (inline SVG, ships with the bundle)
```

`HomeCategoryGrid` implements the last tier with its `FALLBACK_ICONS` lucide set, layered *under*
the image so a failed load reveals it with no JS toggling.

### 4.4 Brand display

- `brand === null || brand === 'Generic'` → render **nothing**. Not the word "Generic", not an
  empty line, not a placeholder chip.
- Supplier brand names (Fortune Petpack, Packworld) are shown as plain text to identify what we
  stock. Do not add supplier logo images without checking with Nilesh first — plain text is the
  safe default.

> Implemented as `brandLabel()` / `realBrands()` in `client/src/lib/brandUtils.ts`. This is a
> **presentation** rule only: `productService.getBrands()` still returns the stored value, so the
> admin PIM keeps seeing `Generic` as the data it is.

---

## 5. Responsive mapping

**One route, one component tree.** Adapt with Tailwind breakpoints. Reserve `useIsMobile` for cases
where the *chrome genuinely differs* — bottom nav vs. header nav, sticky cart bar vs. header pill.
Do **not** branch on `useIsMobile` for grid columns, spacing, or type size; those are breakpoints.

**Token reconciliation (done — PR-0).** Measured against the real `@theme` block in
`client/src/index.css`:

| Proposed | Reality |
|---|---|
| Card name 12.5px | **No token.** Use `text-body-sm` (13px) |
| 13px / 14px | ✅ `text-body-sm` / Tailwind `text-sm` |
| 9px, 9.5px, 10px (§3.1 mono meta) | **No token — deliberately unresolved.** Smallest real token is `--text-caption` (11px), which is what ships. Adding sub-11px sizes needs an `@theme` entry + a `DESIGN_SYSTEM.md` row first |
| `mono` | `font-mono` works, but resolves to **Tailwind's default** mono stack — it is not a project token and is undocumented. Decide before adopting it widely |
| Rail card width 158/172/200px | **No token.** Moot for category tiles — replaced by `1fr` grid columns |

| Surface | mobile | `sm` | `lg` | `xl` |
|---|---|---|---|---|
| Product grid | 2 | 3 (`md`) | 4 | 5 |
| Category tiles (Home groups) | scroll strip | — | **driven by tile count (≤5)** | same |
| Section gap | `gap-2.5` | `gap-3` | `gap-4` | `gap-4` |
| Card padding | `p-2.5` | `p-3` | `p-4` | `p-4` |

> **Deviation, deliberate (PR-0):** the original proposal was 3 / 4 / 6 / 6 category tiles. `pickTop`
> caps a group at 5, so a 6-column grid would leave a permanently empty cell — reintroducing the
> exact dead-space bug §2.4 #2 is about. Columns are instead derived from `shown.length` via a static
> `GROUP_COLS` map, guaranteeing a full row for any group size. Mobile keeps its horizontal scroll
> strip; converting it to a 3-up grid is **PR-4 (mobile shell)**.

**Container.** Single shared container class, applied consistently. Grids must **stretch** (`grid` +
`1fr`), never fixed-width children that leave a ragged right edge.

> ⚠️ **Known container discrepancy (found in PR-0, not fixed).** Two `.container` rules ship: ours in
> `index.css` `@layer components` **and Tailwind's own `container` utility**. Tailwind's wins the
> cascade, so the real caps are 640 / 768 / 1024 / 1280 / **1536px** — not the "1280px above 1024px"
> that `DESIGN_SYSTEM.md` §1.4 claims. Practical effects: at 1000px viewport the content is only
> 768px wide, and above 1536px it expands to 1536px. Site-wide, so out of scope for a bug-fix PR —
> but it is why the same row looked ~192px short at 1440px and ~500px short at 1920px.

**Density intent.** Mobile is optimised for *scan depth* — the first real price should be visible
within roughly one screen of scroll. Desktop is optimised for *comparison* — more columns, more
whitespace, spec lines fully legible side by side.

---

## 6. What this file does not cover

Motion, illustration style, photography direction, and email/print. Add sections here as decisions
are made — do not invent them at implementation time.

---

## ⚠️ Open items

- [ ] **A-1** · §4.2 — confirm bucket name, path convention, and whether a `product_images` table is
      in scope. Gates every later visual phase
- [ ] **PR-1** · §2.4 #5 — de-duplicate the trust content (currently 4 surfaces)
- [ ] **PR-2** · §4.1 — build `toCardModel.ts`, folding in the spec line, brand and price rules;
      then finish §3.1 (image proportion, overlapping action, mono / green badge)
- [ ] **PR-3** · §3.2 — grouped category product-count service method, then enforce "never render
      count 0"
- [ ] **PR-4** · §5 — mobile category strip → 3-up grid; sticky cart affordance (§2.1-A4)
- [ ] **PR-5** · §2.3 — order again, off cart + order history
- [ ] *unassigned* · §5 — decide whether sub-11px type and a project `--font-mono` token enter
      `@theme`
- [ ] *unassigned* · §5 — decide the `.container` cap (adopt Tailwind's 1536px, or pin our own) and
      fix the `DESIGN_SYSTEM.md` §1.4 claim to match
- [x] ~~§3.1 stock state~~ — dropped; field does not exist
- [x] ~~per-piece divisor~~ — data-only, code already guards it
- [x] ~~§5 token reconciliation~~ — done above
