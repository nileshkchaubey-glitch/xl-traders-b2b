# Storefront Design Proposals

**Status: research/proposal document — nothing here is implemented.** Written for review;
pick which proposals to build, then they become normal PRs. No new npm dependencies, no
new Supabase tables/columns. Stack used throughout: Tailwind v4 (`@theme` tokens in
`client/src/index.css`), shadcn/ui primitives already in `client/src/components/ui/`,
`lucide-react` icons, `framer-motion` (already a dependency, used by Home today).

Audience reminder: B2B wholesale buyers **and** street-food vendors / cloud kitchens in
Surat, mostly on a phone, Hindi/English mixed. Every proposal below is judged against that
first, "looks impressive on a 27″ monitor" second.

---

## 1. Current-State Critique

### 1.1 Typography — no scale, just vibes

`docs/DESIGN_SYSTEM.md` §1.4 already flags this: *"There is no formal type scale token set
yet… components use Tailwind text utilities directly."* In practice that means arbitrary
pixel values chosen per-component by eye:

- `client/src/pages/Home.tsx:108` — hero H1 is `text-4xl lg:text-[46px]`, a one-off pixel
  value not on Tailwind's scale.
- Body/meta text ranges unpredictably: `text-[11px]` (Home.tsx:219, tracking labels),
  `text-[11.5px]` (ProductCard.tsx:144/155/167, price sub-lines), `text-[12.5px]`
  (Header.tsx:264 utility bar, Catalog.tsx:236 breadcrumb), `text-[13px]` (Home.tsx:112
  hero subline), `text-[13.5px]` (Header.tsx:369 search input) — five near-identical sizes
  within 2.5px of each other, with no rule for which component gets which.
- Weight is similarly ad hoc: `font-bold`, `font-semibold`, `font-extrabold` all appear as
  the "emphasis" weight in sibling components (compare Home.tsx:108 `font-extrabold` H1 vs.
  ProductCard.tsx:298 `font-bold` product name vs. Header.tsx:292 `font-extrabold` logo).

Net effect: nothing reads as *designed* rhythm — it reads as "whatever looked fine in that
one PR." Section 4 proposes a real scale.

### 1.2 Container width — two systems that happen to agree today

`client/src/index.css:213-239` defines a `.container` utility class (responsive padding,
caps at `max-width: 1280px` above 1024px) — but grep shows it's used only by `Cart.tsx`,
`InstallPrompt.tsx`, and the **dead** home components (§1.7). Every live storefront section
— Home (`Home.tsx:94,156,177,221,255,282,331,380`), Header (`Header.tsx:260,285`), Catalog
(`Catalog.tsx:234`), ProductDetail (`ProductDetail.tsx:399`), Footer (`Footer.tsx:51,139`)
— hand-rolls `max-w-7xl mx-auto px-4 lg:px-8` inline instead. `max-w-7xl` (80rem/1280px)
happens to equal the `.container` cap, so today nothing visibly breaks, but it's two
unrelated mechanisms that could silently drift (someone "fixes" `.container` and nothing
downstream changes). Worth consolidating onto one, even before any visual redesign.

### 1.3 Spacing rhythm — every section picks its own vertical padding

Home.tsx section paddings, in document order: hero `py-12 lg:py-14` (Home.tsx:94), trust
strip `py-2.5` (Home.tsx:156), marquee `py-3.5` (Home.tsx:175), sign-in hook `pt-7`
(Home.tsx:221), category grid `py-12 md:py-16` (HomeCategoryGrid.tsx:227), featured
products `py-12 md:py-16` (HomeFeaturedProducts.tsx:161), bulk banner `py-6` (Home.tsx:255),
trust `py-8` (Home.tsx:282), service areas `py-4` (Home.tsx:331), FAQ `py-10`
(Home.tsx:380). That's nine different vertical-padding values for nine sections with no
discernible step size — a page that should feel like one composition instead feels stitched
from parts built at different times (which, per `CLAUDE.md`, they were). Section 4 proposes
spacing tokens to fix this in one pass.

### 1.4 Hero composition — competent but generic

`Home.tsx:84-152`: radial red-tinted gradient background + two blurred color blobs
(`Home.tsx:86-93`) behind a headline/CTA column and a 2×2 motion-tile grid. This is the
default "modern SaaS hero" formula (soft gradient + blob + bold headline + two buttons) —
functional, but it doesn't say *wholesale packaging distributor in Surat* any more than it
would say any other B2B product. Two concrete issues:
- **Redundant trust badge:** the rating+businesses pill renders once inside the hero
  (`Home.tsx:100-107`) and again, near-identically, in the trust strip immediately below it
  (`Home.tsx:155-172`) — same two data points, twice, in the first 150px of the page.
- The hero's only truly distinctive element — `HeroMotionTiles` — is visually strong
  (auto-rotating real product photography, Ken Burns zoom, `HeroMotionTiles.tsx`) but is
  fighting for attention against blob glows and a badge/headline/subline/bullets stack that
  looks like every other B2B template.

### 1.5 Card design — solid bones, flat surface, one hover trick

`ProductCard.tsx` (grid: 279-306, list: 246-276) is clean and functional: image, brand
line, name, price/enquiry block, cart control. But:
- The *only* interactive affordance is `hover:shadow-lg hover:-translate-y-0.5`
  (ProductCard.tsx:280) — every card on every page gets the identical lift, so nothing
  feels considered per-context (e.g. no distinct press state, no image zoom on hover, no
  skeleton while the image itself loads before `handleImgLoad` fires opacity — currently a
  correct but visually abrupt fade-in).
- **Aspect ratio is inconsistent across the site**, which reads as sloppiness once you
  compare pages back to back: `ProductCard.tsx:282` grid image is `aspect-square`,
  `ProductDetail.tsx:419` main image is `aspect-square`, but
  `HomeFeaturedProducts.tsx:42`/`:207` cards are `aspect-[4/3]`, and
  `HomeCategoryGrid.tsx:114` mosaic quadrants are `aspect-square` again. Four components,
  two different ratios, no documented reason for the split.

### 1.6 Color usage — brand red is used well, but the palette goes flat outside the hero

Section 1.3 of `docs/DESIGN_SYSTEM.md` already documents red/emerald/amber/slate semantics
correctly, and call sites mostly follow it. The gap is *visual interest*: past the hero's
two blob glows (Home.tsx:86-93), the rest of the page — categories, featured products, bulk
banner, trust, service areas, FAQ — is white/`slate-50` cards on a `slate-50` page
background with red accents only on interactive elements. It's clean but visually inert;
nothing besides the hero and the dark bulk-banner/sign-in-hook blocks (`Home.tsx:223`,
`:257`) breaks the pattern of "white rounded-2xl card on light gray."

`HomeCategoryGrid.tsx:35-57` (`GRADIENT_PAIRS`, `ICON_COLORS`) is the other extreme: 10
hardcoded pastel gradient pairs (red/orange, blue/cyan, green/emerald, purple/pink, …)
cycling by array index with no relationship to the category's actual content — a category
gets "blue" or "purple" purely because of its position in the list, which reads as random
rather than designed, and several of those hues (blue, purple, indigo, lime) sit outside
the red/emerald/amber/slate palette `docs/DESIGN_SYSTEM.md` §1.3 documents as canonical.

### 1.7 Two things worth knowing before touching Home.tsx

- **`HomeFeaturedProducts.tsx`'s tabs are cosmetic, not real segmentation.** Its own comment
  admits it (`HomeFeaturedProducts.tsx:147`): *"Segment products by tab — simple heuristic
  since we don't have real tags."* "Trending" is literally the first 8 published products in
  display order (`:153`) and "New Arrivals" is the *reverse* of that same list (`:155`) — on
  a catalog under ~150 products both tabs frequently show overlapping or identical items.
  Worse: it calls `productService.getAll()` with **no `pageSize`** (`:136`), so it pulls the
  *entire* published catalog into the browser on every Home load just to `.slice(0, 8)`
  client-side — this will silently degrade as the catalog grows toward the stated 1000-
  product goal (`CLAUDE.md` "Current data" note), and it ignores the `featured` filter that
  already exists server-side (`productService.ts:294`, `applyPublicScalarFilters` line 307).
  Proposal 3 below replaces this section entirely with a design that uses real filters.
- **Seven `home/` components are dead code**, not wired into any route:
  `HomeHero.tsx`, `HeroBrandsSlider.tsx`, `HeroTrustStrip.tsx`, `HomeUseCases.tsx`,
  `HomeBrandSection.tsx`, `HeroProductShowcase.tsx`, `HeroTopBar.tsx` — confirmed via grep,
  none are imported anywhere. They look like earlier design explorations. Not a design
  problem, but flagging it so nobody mistakes them for the live pattern to extend, and so a
  future cleanup PR knows they're safe to delete (or worth reviewing for salvageable ideas
  first — not evaluated as part of this doc).

---

## 2. Hero Section — 3 Concepts

All three keep the same admin-managed content contract: `site_content.hero`
(`titleLead`/`titleAccent`/`subline`/`bullets`) and `trust_badge`
(`rating`/`businesses`), read via `settingsService.getAllContent()` exactly as
`Home.tsx:57-68` does today. **No new `site_content` keys required** for any of the three —
copy stays 100% admin-editable with zero code deploys, per `CLAUDE.md`'s Phase B contract.

### A. Bold-Typography-Led Hero

Lean into the one thing every wholesale buyer actually wants in the first two seconds:
proof this place stocks what they need, at a size they can act on immediately.

- **Layout:** single column, left-aligned, full-bleed on mobile. No blob glows — replace
  `Home.tsx:86-93`'s gradient/blob background with a flat `bg-slate-50` or a very subtle
  1px `bg-[linear-gradient(...)]` hairline pattern (SVG dot-grid at 4% opacity, brand-safe,
  no new asset needed — pure CSS). `HeroMotionTiles` moves from a 2×2 grid beside the text
  to a **single wide strip** below the headline (`aspect-[21/9]` or similar), so the type
  gets full width to breathe at the top.
- **Type scale:** headline jumps to `text-[56px] lg:text-[72px]` (see §4's proposed
  `--text-display` token), tight `leading-[0.95]`, `font-extrabold`. `titleAccent` (the red
  span, `Home.tsx:110`) rendered noticeably larger or on its own line on mobile so it reads
  as a statement, not a color swap mid-sentence. Subline drops to a fixed `text-lg
  text-slate-600 max-w-xl` — no more ad hoc `text-[13px]`.
- **Imagery treatment:** the wide `HeroMotionTiles` strip below the headline — same
  crossfade+Ken Burns mechanic already built, just reshaped and demoted to "supporting
  visual" rather than 50% of the hero's real estate.
- **CTA placement:** two buttons directly under the subline (unchanged component logic from
  `Home.tsx:116-131`), but visually heavier — `h-14`, bigger radius — since they're now the
  clear next action instead of competing with a facing image column.
- **Mobile:** headline drops to `text-4xl`, motion strip becomes `aspect-[4/3]` single tile
  (reuse existing mobile-safe crossfade), buttons stack full-width exactly as today
  (`Home.tsx:115` already has `flex-col sm:flex-row`).
- **Effort:** M — mostly Tailwind class changes to `Home.tsx`'s hero block +
  `HeroMotionTiles.tsx` reshaping its grid to a single strip; no new component.

### B. Product-Collage / Bento Hero

Show the catalogue's breadth instead of describing it — closer to how a street vendor
actually shops (scan photos, not read copy).

- **Layout:** two-column on desktop (`grid lg:grid-cols-[1fr_1.2fr]`, flipped ratio from
  today's `1.1fr_1fr` at `Home.tsx:94` since imagery becomes the star), text column stays
  left, right column becomes a **bento grid**: one large tile (2×2) + three small tiles
  (1×1), all pulling from the same `/images/hero/*.png` set `HeroMotionTiles.tsx:8-45`
  already ships, just laid out asymmetrically instead of 4 equal tiles.
- **Type scale:** headline shrinks slightly vs. concept A (`text-4xl lg:text-5xl`) since it
  now shares visual weight with the bento grid rather than dominating; badge
  (`trustBadge`) moves to sit *above* the headline as a small eyebrow instead of a pill, to
  avoid the duplicate-badge problem in §1.4 — the trust strip below the hero
  (`Home.tsx:155-172`) becomes the *only* place the rating/businesses numbers render.
- **Imagery treatment:** each bento tile keeps the crossfade rotation logic
  (`HeroMotionTiles.tsx:63-119`) but the large tile rotates on a slower interval (e.g. 6s)
  than the three small ones (3s) so the eye has a clear "anchor" instead of four things
  moving at once.
- **CTA placement:** primary "Browse Products" CTA overlaps the bottom-left of the large
  bento tile as a floating pill (glassmorphism — see §5), secondary WhatsApp CTA stays in
  the text column. This puts the action directly on the imagery a vendor is scanning.
- **Mobile:** bento collapses to the existing 2×2 `HeroMotionTiles` grid (already mobile-
  tuned), text column stacks above it unchanged.
- **Effort:** L — new bento layout variant of `HeroMotionTiles` (different tile sizes/
  timing), floating CTA needs its own positioning logic.

### C. Motion-Tile Evolution (extends what's already shipped)

The lowest-risk option — `HeroMotionTiles` is already the most distinctive thing on the
page (per §1.4); this concept sharpens it instead of replacing it.

- **Layout:** keep today's two-column split (`Home.tsx:94`) and the 2×2 tile grid
  structurally, but fix the two things diluting it: drop the blob glows (`:86-93`) in favor
  of a plain background so the tiles read as the focal point, and dedupe the trust badge
  (§1.4) by keeping it only in the hero, removing the redundant trust-strip copy
  (`:155-172`) — replace that section with a single-line stat ticker instead (years/
  businesses/rating as one inline row, not a repeat of the same pill).
- **Type scale:** unchanged from today structurally, just applying §4's real scale tokens
  instead of the current one-off pixel values (`Home.tsx:108,112`).
- **Imagery treatment — the actual evolution:** add a 5th "wildcard" tile state that
  occasionally shows a **live category chip** instead of a product photo (e.g. "12
  categories · 140+ products" as a text tile that fades in every ~5th rotation), pulling the
  count from `categoryService.getAll()` / product count already fetched elsewhere on Home
  — gives the rotation a data-driven beat instead of purely decorative cycling. Also bump
  tile corner radius and add a subtle `1px` inner ring on hover (`ring-1 ring-white/40`) for
  a more tactile feel per §5.
- **CTA placement:** unchanged (`Home.tsx:116-131`).
- **Mobile:** unchanged grid (`Home.tsx` already handles this responsively); the wildcard
  tile is skipped on mobile to keep the 2×2 grid purely photographic there (less clutter on
  small screens).
- **Effort:** S — smallest surface area of the three; mostly deletions (blobs, duplicate
  badge) plus one new tile variant in `HeroMotionTiles.tsx`.

**Recommendation for phasing purposes:** Concept C is the safest first move (low effort,
fixes two concretely-identified problems), Concept A is the highest-impact if the team wants
a real visual step-change, Concept B is the most ambitious and best saved for a dedicated PR
once A or C validates the new type scale.

---

## 3. Interactive Product/Catalogue Showcase (main ask)

Goal: a Home-page section that *feels* like shopping (tap a chip, see products update) but
stays a taster — it must not become a second Catalog page.

### Data source

Reuse exactly what exists, no new queries:
- **Chips:** `categoryService.getCategoriesGroupedByGroup()` (`productService.ts:187`,
  already called by `Header.tsx:84-87` and `Catalog.tsx:83`) for group names, or
  `categoryService.getAll()` (already called by `HomeCategoryGrid.tsx:212-215`) for flat
  category list — reuse whichever the surrounding Home refactor keeps loaded; no new
  service method.
- **Products:** `productService.getAll({ categoryId | categoryIds, sort: "newest",
  pageSize: 10 })` (`productService.ts:391-435`) — the exact same paginated, published-
  only, price-gated call `Catalog.tsx:130-137` uses. This is also the fix for §1.7's
  performance problem: never fetch the whole catalog, always pass `pageSize`.
- **"All" chip:** omit filters entirely, same call with no `categoryId`.

### Behavior

- Chip row: `flex gap-2 overflow-x-auto scrollbar-hide` (the utility already exists,
  `index.css:243-249`, used today by `Catalog.tsx:483` and `HomeCategoryGrid.tsx:254`) on
  mobile; wraps or stays single-row with more breathing room on desktop. One chip active at
  a time (red-filled per `docs/DESIGN_SYSTEM.md` §1.3 semantics — brand red = active/
  selected), matching the exact visual language `Catalog.tsx:505-517`'s group chips already
  use, so a user who's seen this on Home recognizes the identical control on `/catalog`.
- Tapping a chip re-fetches via the same `getAll` call above (client-side `useState` +
  `useEffect`, same pattern `Catalog.tsx:118-155` already uses) and swaps the grid content
  with a brief fade (`framer-motion` `AnimatePresence`, same pattern
  `HomeFeaturedProducts.tsx:216-233` already uses today — so no new animation primitive).
- Grid uses the **real `ProductCard`** component (`client/src/components/ProductCard.tsx`),
  not a bespoke card like `HomeFeaturedProducts.tsx`'s `FeaturedProductCard` — this fixes
  §1.5's aspect-ratio inconsistency for free (one card component, one `aspect-square`, used
  everywhere) and inherits ProductCard's already-correct price/On-Enquiry/cart-stepper
  logic instead of re-implementing it (`FeaturedProductCard` currently re-implements price
  display and lacks the cart stepper entirely — a real feature gap versus the actual
  Catalog/ProductCard experience).

### Products per view

- **Mobile:** 6 products, 2-column grid (matches `Catalog.tsx:537`'s smallest breakpoint
  `grid-cols-2`) — enough to feel like a real shelf without a wall of scrolling.
- **Desktop:** 10 products, `grid-cols-5` (matches `Catalog.tsx:537`'s `xl:grid-cols-5`) —
  two visual rows at the widest breakpoint.
- Always end with a **"View all in [category] →"** card/link styled distinctly from
  product cards (e.g. a dashed-border tile or a simple text link row below the grid)
  pointing at `/catalog?category=<slug>` or `/catalog?group=<name>` — this is the guardrail
  that keeps it a taster, not a duplicate catalog.

### Loading skeletons

Use the shadcn `skeleton` primitive already installed (`docs/DESIGN_SYSTEM.md` §3.1 lists
it, and `<DataTable>`'s loading state already reuses it per that doc's §3.3 item 20) —
render N skeleton cards matching the ProductCard grid footprint (image block + 2 text lines
+ button-height block) while the fetch is in flight, replacing
`HomeFeaturedProducts.tsx:200-214`'s existing hand-rolled `animate-pulse` divs with the real
primitive for consistency.

### Empty state

If a category genuinely has 0 published products (edge case, but possible mid-catalog-
build per the 1000-product roadmap goal), show a small inline message ("More arriving here
soon — ask us on WhatsApp") with the WhatsApp enquiry link, reusing the same "we probably
stock it" pattern `Header.tsx:196-213`'s search-no-results state already established —
keeps the tone consistent site-wide rather than inventing a new empty-state voice.

### Placement & scope note

This section **replaces** `HomeFeaturedProducts.tsx` in the Home.tsx render order
(`Home.tsx:250`) rather than sitting alongside it — running both a fake-tab showcase and a
real-chip showcase on the same page would be redundant and confusing. `HomeCategoryGrid`
(`Home.tsx:247`) stays as-is; it's a different job (browse-by-category cards, no products
shown) and complements rather than duplicates this section.

- **Effort:** M — new component (`HomeCatalogueShowcase.tsx` or similar), reuses
  `ProductCard`, `categoryService`, `productService.getAll`, `ui/skeleton`. No new service
  methods, no new deps.

---

## 4. Typography & Spacing System

### Type scale (proposed `@theme` additions, `client/src/index.css`)

Tailwind v4 supports paired font-size/line-height custom properties. Proposed additions
inside the existing `@theme { ... }` block (`index.css:49-65`), additive — doesn't touch
shadcn's existing OKLCH color tokens:

```css
@theme {
  /* … existing tokens … */

  --text-display: 3rem;        /* 48px */
  --text-display--line-height: 1.05;
  --text-display--font-weight: 800;

  --text-h1: 2rem;             /* 32px */
  --text-h1--line-height: 1.15;
  --text-h1--font-weight: 800;

  --text-h2: 1.5rem;           /* 24px */
  --text-h2--line-height: 1.2;
  --text-h2--font-weight: 700;

  --text-h3: 1.125rem;         /* 18px */
  --text-h3--line-height: 1.3;
  --text-h3--font-weight: 700;

  --text-body-lg: 1rem;        /* 16px */
  --text-body-lg--line-height: 1.5;

  --text-body: 0.875rem;       /* 14px */
  --text-body--line-height: 1.5;

  --text-body-sm: 0.8125rem;   /* 13px */
  --text-body-sm--line-height: 1.4;

  --text-caption: 0.6875rem;   /* 11px */
  --text-caption--line-height: 1.3;
  --text-caption--letter-spacing: 0.04em;
}
```

Usage becomes `text-display`, `text-h1`, `text-body-sm`, etc. — Tailwind v4 auto-generates
the utility from the paired tokens, so call sites collapse from `text-4xl lg:text-[46px]`
+ manual `leading-[1.08]` + manual `font-extrabold` (today's `Home.tsx:108`) down to a
single `text-display` class carrying weight+line-height+size together. Mobile scaling
uses the existing Tailwind breakpoint pattern (`lg:text-h1` etc.) applied at call sites, not
baked into the token — keeps the token set small (8 sizes total, matching the 8 real jobs
text does on this site: display, h1, h2, h3, body-lg, body, body-sm, caption) instead of
the ~12 ad hoc pixel values in use today (§1.1).

Migration is call-site-only — no component restructuring, just swapping arbitrary values
for the named token at each of the ~15 sites cataloged in §1.1.

### Spacing rhythm (proposed `@theme` additions)

```css
@theme {
  --spacing-section-sm: 2rem;   /* 32px  — dense/utility sections (trust strip, marquee) */
  --spacing-section-md: 3.5rem; /* 56px  — standard content sections */
  --spacing-section-lg: 5rem;   /* 80px  — hero, major dividers */
}
```

Applied as `py-(--spacing-section-md)` (Tailwind v4 arbitrary-property-from-token syntax)
or, more simply, as three fixed utility pairs documented in `docs/DESIGN_SYSTEM.md`:

| Token | Mobile | Desktop | Use for |
| --- | --- | --- | --- |
| `section-sm` | `py-8` | `py-8` | Trust strip, marquee, sign-in hook |
| `section-md` | `py-12` | `py-16` | Category grid, showcase, bulk banner, trust, service areas |
| `section-lg` | `py-14` | `py-20` | Hero only |

This directly replaces §1.3's nine-different-values problem with three deliberate steps —
every section on Home picks the step that matches its visual weight instead of an
arbitrary number.

### Container consolidation

Fold `max-w-7xl mx-auto px-4 lg:px-8` (repeated ~10 times per §1.2) into the existing but
under-used `.container` utility (`index.css:213-239`) by adding the missing `max-w-7xl`
equivalent there if not already exact, then replacing every inline occurrence with
`className="container"`. One mechanism instead of two that happen to agree today.

- **Effort:** S for the token additions themselves (pure CSS), M for the call-site migration
  across ~6 files (mechanical find/replace, but touches every page).

---

## 5. Modern Touches Inventory

Prioritized by impact/effort. "Effort" assumes the type/spacing tokens from §4 already
exist where relevant.

| # | Touch | Description | Effort | Impact |
| --- | --- | --- | --- | --- |
| 1 | Remove duplicate trust badge | Delete the redundant rating/businesses repeat between hero (`Home.tsx:100-107`) and trust strip (`:155-172`) — pick one | S | Med |
| 2 | Section eyebrows everywhere | Standardize the `text-[11px] font-bold tracking-[0.12em] uppercase text-red-600` eyebrow pattern already used ad hoc (`Home.tsx:259`, `:285`, `HomeCategoryGrid.tsx:186`) into one `<SectionEyebrow>` component/class so every section header matches exactly | S | Med |
| 3 | Consistent product-card aspect ratio | Standardize all product imagery on `aspect-square` (ProductCard's existing choice) — fixes `HomeFeaturedProducts.tsx:42` inconsistency, moot if §3's showcase replaces that file | S | Med |
| 4 | Card hover micro-interactions | Add `motion-safe:` image `scale-105` on hover inside `ProductCard.tsx`'s image wrapper (currently only the whole card lifts, `:280`) + a subtle border-color shift to `border-red-200` on hover, matching the pattern `HomeFeaturedProducts.tsx:39` already uses (`hover:border-red-200`) but `ProductCard` doesn't | S | Med |
| 5 | Skeleton loading states | Replace hand-rolled `animate-pulse` blocks (`HomeFeaturedProducts.tsx:200-214`, `Catalog.tsx:521-524`'s plain-text loading) with the shared `ui/skeleton` primitive everywhere products load | S | Med |
| 6 | Empty-state consistency | Give `Catalog.tsx:525-531`'s "No products found" the same WhatsApp-fallback treatment `Header.tsx:196-213`'s search empty state already has, instead of a dead-end message | S | Med |
| 7 | Category mosaic palette cleanup | Replace `HomeCategoryGrid.tsx:35-57`'s 10 arbitrary hue pairs with a curated 4-tone rotation drawn from the actual brand palette (red/amber/emerald/slate tints) so category tiles feel designed, not randomized | M | Med |
| 8 | Gradient/mesh accent, used sparingly | One subtle brand-toned mesh gradient (red↔amber, very low saturation) behind the showcase (§3) or FAQ section — currently only the hero has any gradient treatment (§1.6) | M | Med |
| 9 | Glassmorphism on floating elements | Frosted-glass CTA pill for Hero Concept B's floating button (`backdrop-blur-md bg-white/70 border border-white/40`) — tasteful because it's one element, not a whole panel | M | Low-Med |
| 10 | Sticky category nav on Catalog scroll | Convert `Catalog.tsx:483-518`'s mobile group-chip row into a `sticky top-[header-height]` bar once scrolled past the hero/breadcrumb, so filtering stays reachable on long lists | M | Med |
| 11 | Marquee refinement | `Home.tsx:174-215`'s brand marquee currently mixes real brand names and generic value props inconsistently sized; standardize entry pill styling (icon + label) instead of plain text, and slow the animation slightly (`xl-marquee` 28s → ~34s, `index.css:29`) for readability at typical reading speed | S | Low |
| 12 | Real "Trending"/"New" data | If the fake-tabs pattern (§1.7) is kept anywhere rather than replaced by §3, wire "New Arrivals" to actual `sort: "newest"` server-side instead of a client-side `.reverse()` (`HomeFeaturedProducts.tsx:155`) | S | Low (moot if §3 ships) |
| 13 | Reduced-motion audit | Confirm every new animation (chip-swap fade, card hover scale, mesh accent) respects `prefers-reduced-motion` the way `HeroMotionTiles`/marquee already do (`index.css:36-41`) — a checklist item, not a build task | S | High (accessibility) |

---

## 6. Recommended Phasing

Three presentation-layer-only PRs, ordered by impact/effort ratio. Each is independently
shippable and independently revertable.

### PR 1 — Foundation: type scale + spacing tokens + container consolidation (§4)

Smallest, least visible individually, but everything else in §2/§3/§5 looks better *and*
easier to build once it exists. Touches `index.css` (additive `@theme` tokens) plus
mechanical call-site swaps across `Home.tsx`, `Header.tsx`, `Catalog.tsx`,
`ProductDetail.tsx`, `Footer.tsx`. Zero behavior change — pure visual/consistency diff, easy
to review, easy to smoke-test (nothing moves, spacing just becomes deliberate). Include
touches #1, #2, #6, #13 from §5 since they're small and naturally fall out of this pass.

### PR 2 — Interactive showcase, replacing the fake-tabs section (§3)

The main ask. Deletes `HomeFeaturedProducts.tsx`'s tab heuristic (§1.7), ships the chip-
filtered `ProductCard`-based showcase in its place. Depends on PR 1's tokens for a clean
look but isn't blocked by it — could ship first if sequencing needs to flip. Include
touches #3, #4, #5, #10 from §5 since they're either prerequisites (aspect ratio) or land
naturally with new showcase code (skeletons, hover states).

### PR 3 — Hero evolution + remaining polish (§2 + §5 leftovers)

Ship whichever hero concept is chosen from §2 (recommend starting with **Concept C**, the
lowest-risk evolution of the existing `HeroMotionTiles`, saving Concepts A/B as a follow-up
once C validates the new type scale in the highest-visibility spot on the site). Bundle in
the remaining §5 items not already covered (#7 category palette, #8 mesh accent, #9
glassmorphism, #11 marquee, #12 if still relevant). This is the PR most likely to want a
live preview + explicit sign-off given it changes the first thing every visitor sees.

---

## Appendix — Files referenced

- `client/src/pages/Home.tsx`
- `client/src/components/Header.tsx`
- `client/src/components/Footer.tsx`
- `client/src/components/ProductCard.tsx`
- `client/src/pages/Catalog.tsx`
- `client/src/pages/ProductDetail.tsx`
- `client/src/components/home/HeroMotionTiles.tsx`
- `client/src/components/home/HomeCategoryGrid.tsx`
- `client/src/components/home/HomeFeaturedProducts.tsx`
- `client/src/lib/settingsService.ts`
- `client/src/lib/productService.ts`
- `client/src/index.css`
- `docs/DESIGN_SYSTEM.md`
