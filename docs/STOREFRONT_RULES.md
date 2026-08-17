# Storefront Rules

**These are invariants, not preferences.** Each one exists because breaking it
produced a real defect in this codebase — the incident is cited so the rule can
be argued with on evidence rather than treated as taste.

`scripts/check-storefront.mjs` enforces the mechanically checkable subset and
runs in CI on every PR. Rules marked **[manual]** cannot be grepped and must be
checked by a human; they are on the PR checklist.

Run locally: `npm run check:storefront`

---

## 1. Price gate

### 1.1 A guest sees no price. At all.

No number, no range, no "from", no struck-through figure. The price slot shows
**"Sign in for rates"**.

The guest branch cannot render a price because the guest query never selects
one — `productSelectCols()` returns `GUEST_PRODUCT_COLS`, which omits every
price column. The UI rule and the data rule agree, deliberately.

### 1.2 These columns must NEVER appear in `GUEST_PRODUCT_COLS`

```
price · mrp · discount_percent · price_per_piece · bulk_price · bulk_threshold
```

`price_per_piece` is the subtle one: it is derived from `price`, and `anon` can
already read `quantity_in_unit`, so a granted per-piece rate multiplied by the
pack size **reconstructs the wholesale price exactly**.

*Enforced: `check-storefront.mjs` — `guest-price-columns`.*

### 1.3 Never `SELECT *` or `ORDER BY price` on `products` in a public path

Postgres refuses both for `anon`, which holds no grant on the price columns —
and it refuses an `ORDER BY` on an unreadable column exactly as it refuses a
`WHERE`.

> **Incident.** `applyPublicSort` emitted `ORDER BY price` for everyone, so a
> signed-out visitor choosing "Price: Low to High" got a **failed query and an
> empty catalogue**. Proved live: `permission denied for table products`.
>
> **Incident.** `masterService.getVariantsByMasterId` did
> `.select("*").order("price")`. Both halves are refused for `anon`; the error
> was swallowed by a `catch` and returned `[]`, so a signed-out visitor saw an
> **11-variant product as if it had no variants at all**.

Any service reading `products` for a public surface goes through
`publicProductQueryShape()`.

*Enforced: `check-storefront.mjs` — `public-select-star`, `unguarded-price-order`.*

---

## 2. Ordering arithmetic

### 2.1 `lib/orderingModel.ts` is the only module that converts packs, pieces and money

Outside it, no file may contain `* price`, `/ packSize`, a `± 1` on a quantity,
or a comparison against `moq`. The single exception is `cartStore.getTotal`,
which calls `lineTotal`.

Money is **always** `packs × price`. `products.price` is the price of one
selling unit; a piece count is a display and input convenience that is converted
to packs *before* any money arithmetic happens.

*Enforced: `check-storefront.mjs` — `arithmetic-outside-model`.*

### 2.2 `lineTotal` takes a branded `Packs`, never a number

That is the enforcement mechanism, not a convention: passing a piece count is a
**compile error**, so "money derived from pieces" is not expressible.

```
error TS2345: Argument of type 'number' is not assignable to parameter of type 'Packs'.
```

### 2.3 An `OrderSpec` is constructed in exactly one module

`resolveOrderSpec` (from product columns) and `specFromSnapshot` (from a cart
line) both live in `orderingModel`. Nothing else builds one.

> **Incident.** `specOfCartItem` rebuilt the spec inline and passed
> `unit_of_measure` through raw as the noun, skipping `sellingUnitNoun`. The
> cart rendered **"5 pcses"** and **"MOQ 2 pcses"** while the card, going
> through `resolveOrderSpec`, correctly said "pack". Same product, two nouns —
> and it hit nearly every line, because 138 of 139 live products have
> `unit_of_measure = 'pcs'`.

*Enforced: `check-storefront.mjs` — `inline-orderspec`.*

### 2.4 Cart, cart bar, saved order and WhatsApp message all use `cartTotals`

The WhatsApp message is the document the business **physically fulfils and
invoices against**. A divergence between it and the cart the customer approved
is a dispute, not a rendering bug. All four surfaces call the same function, so
they cannot disagree. Do not reintroduce a local `reduce`.

*Enforced: `check-storefront.mjs` — `local-cart-total`. Parity asserted by
`orderMessage.test.ts`.*

---

## 3. Copy

### 3.1 Claims that must never ship

| Banned | Why |
| --- | --- |
| Customer counts (`500+ businesses served`) | Unverifiable; owner instruction |
| SKU / product counts | Owner instruction |
| Ratings (`4.8`, `4.8★`) | Unverifiable |
| Years in business (`10+ years`) | Unverified |
| Any freight or free-delivery claim | **The rule is unsettled — omit the line entirely rather than state a threshold** |
| Stock availability (`In stock`, `Out of stock`) | No such field exists on `Product` |
| Slab / tier pricing, "bulk unlocks better rates" | **V3 implements ONE rate.** Advertising slabs describes a product we do not have |
| `MRP`, struck-through prices, discount badges | Owner instruction |

> **Incident.** `free delivery` sat in the **generated SEO meta description**
> (`catalogHealth.ts`), so it reached search results, not just the page.

### 3.2 Dispatch copy is per product, from one source

`Surat — same day · Outside Surat — 2–3 days`, from the `dispatch`
`site_content` key. Not a global banner promise, and never a second wording
hardcoded elsewhere.

### 3.3 Copy lives in `site_content`, and the stored row wins

> **Incident.** `settingsService` merges a stored row **over** its in-code
> fallback. Editing `FALLBACKS` alone changed nothing on a site whose rows
> already existed — every banned claim above was live in the **database**. A
> copy change that does not also update the row is cosmetic.

*Enforced: `check-storefront.mjs` — `banned-claims` (source only; the DB half is
**[manual]**).*

---

## 4. Presentation

### 4.1 The card must not change height between auth states **[manual]**

`PriceSlot` pins its own height in both branches. Verify at 390px and 1440px.

### 4.2 Category counts come from `v_category_live_counts`, and are never zero

The rule (`published AND active`) lives in SQL, in one place.
`categoryService.getLiveCategories` drops zero-count categories at the source,
so no component needs its own guard and none can disagree.

17 of 38 active categories currently have no live products. One of them has two
**draft** products, so a naive count over `products` would advertise "2 items"
and lead to an empty page.

### 4.3 An empty promo slot renders nothing

No box, no skeleton, no placeholder, no reserved space. `null` before any
wrapper exists. A storefront with no banners configured must look deliberate.

### 4.4 Festival theming changes accent colour and hero gradient. Nothing else.

Never layout, never prices. The theme is written to `<html data-xl-theme>` and
consumed **only** by CSS custom properties — no component reads it, so there is
no scope in which a theme value could reach a layout or pricing decision.

Adding spacing, sizing, `display`, or anything price-related to a
`[data-xl-theme]` block breaks that guarantee.

*Enforced: `check-storefront.mjs` — `theme-block-scope`.*

### 4.4b The selling-unit noun: 'pcs' is an ABSENT value, not a unit

`unit_of_measure` names the selling unit — "box", "bag", "roll", "packet". When
it is **null, empty, or a piece word** (`pcs`, `pc`, `piece(s)`, `nos`, `no`,
`unit(s)`), it is treated as **absent** and the noun falls back to `pack`, so
the card reads **"Pack of 900"**.

Nobody sells "one pcs of 900". `pcs` is an absent value wearing the costume of a
present one, and rendering it produced "1 pcs of 900" and "5 pcses" before this
rule existed.

**Do not "fix" this by hardcoding `"pack"`.** The catalogue genuinely contains
boxes, bags and rolls; the derivation is correct and the data is empty. Live
today: **138 of 139 published products have `unit_of_measure = 'pcs'`**, so
almost everything renders "Pack of N" — which is right, not a bug.

**Do not populate the column by hand either.** The catalogue is being reimported
from Excel (DATA-01), so values entered now are discarded. Real units arrive
with the real catalogue: the import already maps the sheet's `unit` column to
`unit_of_measure` (`bulkImportService.ts:454,588`).

> **Sheet guidance for the reimport:** `unit` should be the **selling unit** —
> what one purchasable item is called (`box`, `bag`, `roll`, `packet`, `carton`,
> `set`). Use `pcs` only when the product genuinely has no pack noun; it will
> render as "Pack of N".

### 4.5 Images

Sized WebP from Supabase Storage, generated **at upload** — the owner's settled
decision is that paid Supabase transformations are not bought (see CLAUDE.md).
Fixed aspect ratios, lazy below the fold, `width`/`height` set.

**Never a base64 data URI in source.** The bundle carries no image bytes.

Do not emit a `srcSet` for renditions that do not exist yet.

*Enforced: `check-storefront.mjs` — `base64-image`.*

### 4.6 Internal navigation uses wouter `<Link>`, never `<a href="/…">`

*Enforced: `check-storefront.mjs` — `raw-internal-anchor`.*

---

## 5. Architecture

### 5.1 Components never import `supabase` directly

`components → lib/*Service.ts → supabase`. (`components/admin/**` is
grandfathered and out of storefront scope.)

*Enforced: `check-storefront.mjs` — `supabase-in-component`.*

### 5.2 Deleted API stays deleted

`getItemCount` was removed and **not aliased**, so every consumer had to state
whether it meant packs, pieces or lines. Do not reintroduce it.

*Enforced: `check-storefront.mjs` — `revived-getitemcount`.*

---

## 6. Verification standard

Set by the RLS work and expected of security-adjacent changes:

> **Prove the hole exists, then prove it is closed** — as the real role, with
> real output, in the same transaction. A catalog listing is not proof; a policy
> can look right and still leak.

For UI, `tsc` passing is not verification.

> **Incident.** The "5 pcses" bug type-checked cleanly and was only found by
> putting a real cart in a browser and reading what it said.
