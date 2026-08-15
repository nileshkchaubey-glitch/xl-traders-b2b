# PCS-Based Ordering Model — Design Spec

**Status: PARTIALLY IMPLEMENTED (updated 15 Aug 2026).**

- **§1 schema — DONE.** `order_unit`, `order_step` and their CHECKs, plus the §7.2
  `price_per_piece` generated column and index, were executed on 15 Aug 2026 as
  Storefront V3 Phase 2. See [`docs/sql/v3-phase2-schema.sql`](sql/v3-phase2-schema.sql)
  and its verification output. Additive only; nothing backfilled.
- **§2–§10 application code — NOT YET BUILT.** `orderingModel.ts`, the cart reshape and
  every UI surface remain unimplemented. Note the brief for that work names the exports
  `resolveOrderSpec` / `pcsFromPacks` / `packsFromPcs` / `snapPcsToStep` / `lineTotal` /
  `formatOrderQty`; where those differ from the names sketched in §2.1 below, **the brief's
  names win**.
- **§7.4 is no longer an open question — the bug is CONFIRMED.** See the note in that
  section.

**Date:** 11 Aug 2026
**Companion file:** [`docs/sql/PROPOSAL-ordering-model.sql`](sql/PROPOSAL-ordering-model.sql) (owner-run, not executed)

---

## 0. The rule this model exists to protect

CLAUDE.md, canonical unit-of-sale rule (owner decision, 25 Jul 2026):

> `price` is **the price of ONE SELLING UNIT (the pack / case)**, never a per-piece
> rate. `quantity_in_unit` is descriptive — how many pieces are inside that pack.
> `moq` counts **selling units**, not pieces.

This proposal does **not** change that rule. It changes **what the customer types
into a stepper**, exactly as `lib/priceEntryMode.ts` changed what the _operator_
types into a price box without changing what is stored.

The one-sentence invariant:

> **Money is `packs × price`. `packs` is an integer. A piece count is a display and
> input convenience that is converted to packs before any arithmetic involving money
> happens.**

Worked example (from the task brief), which the test plan in §10 asserts literally:

```
quantity_in_unit = 3000, moq = 1 pack, order_unit = 'pcs', order_step = 3000
UI ladder:  3000 → + → 6000 → + → 9000 → − → 6000 → − → 3000 → − → 0 (line removed)
Never 1000, 2000 or 4500.
Total = (pcs / 3000) × price
```

---

## 1. Field design

### 1.1 Verdict on the proposed shape: **adopt, with two additions**

| Proposal                                                                           | Verdict                                                        | Note                                                                           |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `ADD order_unit TEXT NOT NULL DEFAULT 'pack' CHECK (order_unit IN ('pack','pcs'))` | **Adopt as written**                                           | —                                                                              |
| `ADD order_step INTEGER NULL` (NULL ⇒ fall back to `quantity_in_unit`)             | **Adopt**, plus `CHECK (order_step IS NULL OR order_step > 0)` | The NULL-means-inherit semantics are the right call and are argued for in §1.3 |
| **Do not** add `pack_size`                                                         | **Adopt** — `quantity_in_unit` already is it                   | §1.4                                                                           |
| **Do not** add a pcs-based MOQ; derive `moq × quantity_in_unit`                    | **Adopt**                                                      | §1.5                                                                           |

Two additions the proposal did not mention, both argued below:

- `CHECK (order_step IS NULL OR order_step > 0)` — cheap, and `order_step = 0`
  would make the stepper an infinite loop rather than a visible error.
- **No** cross-column CHECK tying `order_unit = 'pcs'` to `quantity_in_unit IS NOT NULL`.
  §1.6 explains why that constraint is tempting and wrong for this codebase.

### 1.2 The two columns

```sql
order_unit TEXT    NOT NULL DEFAULT 'pack' CHECK (order_unit IN ('pack','pcs'))
order_step INTEGER NULL                    CHECK (order_step IS NULL OR order_step > 0)
```

`order_unit` is _how the customer counts_, not what is stored and not what is priced.
`order_step` is _the size of one click_ in pieces, and only has meaning when
`order_unit = 'pcs'`.

### 1.3 Why `order_step` is nullable rather than defaulted

The obvious alternative is `order_step INTEGER NOT NULL DEFAULT 1`, or writing
`quantity_in_unit`'s value into `order_step` at the moment pcs mode is switched on.

Both create a **stale-copy bug**. Pack sizes change during the catalogue rebuild —
`quantity_in_unit` is an ordinary editable cell in the Catalog Editor table
(`productValidation.ts:83-84`, label "Pack quantity") and in the Workbench Product
section. If `order_step` held a copy of it, editing a pack from 3000 → 2500 would
leave `order_step = 3000`: the customer's stepper would move in 3000s across a
2500-piece pack, so every click would be 1.2 packs and the money would be fractional.
Nothing in the admin UI would show that anything was wrong.

`NULL = "one pack, whatever a pack currently is"` makes the common case
self-maintaining. `order_step` is then only ever set when the operator genuinely
means _"this product is sold in lots of more than one pack"_ — which is the only
thing it should be for.

### 1.4 Why `pack_size` must not be added

`quantity_in_unit` is already the pack size, and it is already load-bearing in six
places that would each have to choose between the two columns:

| Site                      | Reads `quantity_in_unit` as | Reference                                            |
| ------------------------- | --------------------------- | ---------------------------------------------------- |
| Card spec line            | pieces per pack             | `ProductCard.tsx:146-151` → `"3000 pcs/pack"`        |
| Card per-piece rate       | the divisor                 | `ProductCard.tsx:175-179`                            |
| PDP price card            | pieces per pack             | `ProductDetail.tsx:530-534` → `"/ pack of 3000 pcs"` |
| PDP per-piece rate        | the divisor                 | `ProductDetail.tsx:542-555`                          |
| Per-piece **price entry** | the multiplier              | `priceEntryMode.ts:43-50` (`packDivisor`)            |
| Admin validation          | "Pack quantity"             | `productValidation.ts:83-84`                         |
| Guest column grant        | granted to `anon`           | `sql/04-price-column-security.sql:29`                |

**What breaks if `pack_size` is added anyway.** Two columns that must agree, with no
UI that edits them atomically, on a catalogue being hand-rebuilt row by row
(Critical Rule #13). The first time they disagree — say `quantity_in_unit = 480`,
`pack_size = 500` — the product page renders `"₹4897 / pack of 480 pcs"` and
`"₹10.20/pc"` from one column while the stepper moves in 500s and the cart divides
by the other. The customer's screen contradicts itself and neither number is
flagged as wrong.

Worse, `packDivisor()` is the input transform for the admin's per-piece **price
entry**. If it were pointed at the wrong one of the two columns, an operator typing
`10.20` would store `10.20 × 480 = ₹4896` while the ordering model believed a pack
was 500 pieces — a silently wrong price, which is precisely the DE-01 failure class
the entire PR-A safety layer and `scripts/check-price-entry.ts` exist to prevent.

There is no benefit on the other side of that trade. `pack_size` would hold exactly
the number `quantity_in_unit` already holds.

### 1.5 Why a pcs-based MOQ must not be added

`moq` is a single number that flows into a single `CartItem.moq` field
(`cartStore.ts:13`) and is consumed at **nine** sites:

```
ProductCard.tsx:28, 65-67      moq default + MOQ pre-fill on first add
ProductDetail.tsx:237, 629-640 stepper seed + "Below MOQ" / "✓ MOQ n met"
AddToCartButton.tsx:19, 150    moq default + "Min. order qty: n"
Cart.tsx:39, 136, 174-181      anyMoqWarn, per-line warn, "Fix to {moq}"
CartDrawer.tsx:195-199         "Min: {moq}"
```

A second column (`moq_pcs`) forces every one of those nine to decide which MOQ it
means, and `CartItem` to carry both. But the drift would not come from the
components — it would come from the **write paths**, which only ever write one
number:

- the bulk-bar **Set MOQ** action (`bulkUpdateField`) writes `moq`;
- the import template's `moq` column (CLAUDE.md, Import Template v3) writes `moq`;
- AI Smart Paste extracts one MOQ;
- `v_product_health.missing_moq` audits `moq` and nothing else — a second column
  would be permanently invisible to the health system, which Architecture Rule #2
  makes the only legitimate source of missing-data logic.

So the second column would be written by exactly one surface (the new Ordering
section) and ignored by four others, and no health check would ever notice.

**Derivation instead:** `minPcs = moq × packSize`. This is total, not partial —
§6.1 shows that whenever `packSize` is unusable, pcs mode is unavailable anyway, so
the derivation is never asked to divide by an unknown.

### 1.6 Why there is no cross-column CHECK

A constraint like

```sql
CHECK (order_unit = 'pack' OR quantity_in_unit IS NOT NULL)   -- REJECTED
```

reads well and would be wrong here. Product rows are edited **one column at a time**:
the Catalog Editor's inline cells patch a single field per commit, and the Workbench
persists a primary image as a one-column patch specifically so an upload isn't lost.
Under that constraint, clearing `quantity_in_unit` on a pcs product — a perfectly
ordinary intermediate state during a rebuild — returns a raw Postgres constraint
violation to a UI that has no handler for it, from a field the operator was not
editing.

**Decided instead:** two softer layers, specified in §6.1 and §9.

1. **Refuse at entry** — admin validation blocks switching to pcs without a usable
   pack quantity, with a written message.
2. **Degrade at render** — `resolveOrdering()` downgrades an impossible pcs row to
   pack mode. The customer sees a correct pack product; the operator sees the
   unfinished row in admin.

The constraint is included **commented out** in the SQL proposal so the decision is
visible rather than merely absent.

---

## 2. The conversion boundary

### 2.1 The module

**`client/src/lib/orderingModel.ts`** — adopted as proposed. Pure, no React, no
Supabase, no formatting of currency. It is modelled directly on `lib/priceEntryMode.ts`
(pure module + `scripts/check-price-entry.ts` regression file), which is the
established pattern in this repo for "one arithmetic rule, many surfaces".

Proposed surface:

```ts
export type OrderUnit = "pack" | "pcs";

/** The resolved truth for one product. Nothing downstream reads the raw columns. */
export interface OrderingSpec {
  unit: OrderUnit; // resolved — never the raw column (may be downgraded, §6.1)
  packSize: number; // pieces per pack; 1 when unknown/unusable
  step: number; // pcs per click (pcs mode) — always a multiple of packSize
  minPacks: number; // moq, >= 1, in packs
  minPcs: number; // the pcs floor, snapped UP to a whole step (§6.2)
  noun: string; // selling-unit noun for copy: "box" | "pack" | ... (§8.1)
}

export function resolveOrdering(
  p: Pick<
    Product,
    "order_unit" | "order_step" | "quantity_in_unit" | "moq" | "unit_of_measure"
  >
): OrderingSpec;

// ── quantity conversion — the ONLY place these two multiply/divide ──
export function pcsFromPacks(packs: number, s: OrderingSpec): number;
export function packsFromPcs(pcs: number, s: OrderingSpec): number;

// ── stepper behaviour ──
export function snapPcs(pcs: number, s: OrderingSpec): number; // nearest step, ties up, clamped
export function stepPcs(pcs: number, delta: 1 | -1, s: OrderingSpec): number;
export function stepPacks(
  packs: number,
  delta: 1 | -1,
  s: OrderingSpec
): number;

// ── money — note the signature ──
export function lineTotal(
  packs: number,
  price: number | null | undefined
): number;

// ── copy (§8) ──
export function formatQty(
  packs: number,
  s: OrderingSpec
): { primary: string; secondary: string | null };
```

**`lineTotal` takes packs and has no piece parameter.** That is the enforcement
mechanism, not a convention: there is no way to pass a piece count into the money
function, so "money derived from pcs" is not expressible. Its body is
`packs * cartLinePrice(price)`, composing the existing single price rule
(`priceUtils.ts:17-19`) so a NULL price yields `0`, never `NaN`.

`resolveOrdering` imports **`packDivisor` from `lib/priceEntryMode.ts`** and does not
reimplement it. That function already answers exactly the question "is this
`quantity_in_unit` a usable pieces-per-pack divisor?" (`priceEntryMode.ts:43-50`,
NULL/blank/junk/≤1 → `null`). Two independent answers to that question is the
`pack_size` mistake in function form. This is the **only** permitted import between
the two modules — see §9.4 for why they otherwise stay apart.

### 2.2 Call sites that must route through it

Everything below currently performs quantity arithmetic inline. After this change,
**no file outside `orderingModel.ts` may contain `* price`, `/ packSize`, `± 1` on a
quantity, or a comparison against `moq`.** The only exception is `cartStore.getTotal`,
which calls `lineTotal`.

**Storefront — quantity + stepping**

| File                  | Lines                   | What changes                                                         |
| --------------------- | ----------------------- | -------------------------------------------------------------------- |
| `ProductCard.tsx`     | 28                      | `const moq = product.moq ?? 1` → `resolveOrdering(product)`          |
|                       | 52-71                   | `handleAdd` — seeds at `spec.minPcs` / `spec.minPacks`               |
|                       | 73-77                   | `step()` — `cartLine.quantity + delta` → `stepPcs` / `stepPacks`     |
|                       | 146-151                 | spec line — pcs variant only (§8.2)                                  |
|                       | 175-179                 | per-piece display — keep, but read `spec.packSize`                   |
|                       | 213                     | stepper readout → `formatQty(...).primary`                           |
| `ProductDetail.tsx`   | 160, 231-233            | `qty` state becomes the pcs/packs value seeded from `spec`           |
|                       | 235-261                 | `handleAddToCart`                                                    |
|                       | 591-615                 | stepper +/− and the free-text input (must snap on commit)            |
|                       | 617-627                 | quick-add chips `+5/+10/+25` (§8.3 changes these in pcs mode)        |
|                       | 629-641                 | MOQ note                                                             |
|                       | 649-650, 804-805        | `Add to Cart · ₹{price × qty}` → `lineTotal(packs, price)`           |
|                       | 285-287                 | `handleEnquire` quantity line                                        |
| `AddToCartButton.tsx` | 19, 21-44, 46-50, 150   | same three concerns: moq, add, step                                  |
| `Cart.tsx`            | 36-39                   | `getTotal` / `getItemCount` / `anyMoqWarn`                           |
|                       | 136, 174-181            | below-MOQ warn + "Fix to {moq}"                                      |
|                       | 196-222                 | stepper (incl. the free-text `<input>` at 205-213 — snap on commit)  |
|                       | 225-229                 | line amount                                                          |
|                       | 256-273                 | summary subtotal/total                                               |
| `CartDrawer.tsx`      | 44-49, 152-163, 174-199 | totals, line price, stepper, min hint                                |
| `CartBar.tsx`         | 16, 21, 63, 88          | total + the `"· {qty} pcs"` label (**pre-existing mislabel — §8.6**) |
| `MobileNav.tsx`       | 17                      | badge count                                                          |
| `Header.tsx`          | 74                      | badge count                                                          |

**Store and services**

| File                    | Lines   | What changes                                                                                     |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `stores/cartStore.ts`   | 4-14    | `CartItem` shape (§3)                                                                            |
|                         | 39-57   | `addItem` — `quantity: 1` → `packs: 1`                                                           |
|                         | 65-75   | `updateQuantity` → `setPacks` (§3.3)                                                             |
|                         | 81-84   | `getTotal` / `getItemCount` (§3.4, §3.5)                                                         |
|                         | 86-89   | `persist` config — `version` + `migrate` (§4)                                                    |
| `lib/orderService.ts`   | 6-7     | order total + item count                                                                         |
|                         | 25-34   | `order_items` rows                                                                               |
|                         | 44-71   | `buildWhatsAppMessage` (§8.5)                                                                    |
| `lib/productService.ts` | 23-26   | `GUEST_PRODUCT_COLS` += `order_unit,order_step` (**must not ship before the grant runs — §7.4**) |
|                         | 326-337 | `applyPublicSort` (§7)                                                                           |
| `lib/supabase.ts`       | 45-83   | `Product` gains `order_unit` / `order_step`                                                      |

**Admin** — reads and writes the columns; must contain **no** conversion arithmetic.

| File                                       | What changes                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `components/admin/CatalogProductPanel.tsx` | new **Ordering** section (§9)                                           |
| `components/admin/CatalogWorkbench.tsx`    | same fields inside the existing Product section                         |
| `components/admin/CatalogTreeEditor.tsx`   | hidden-by-default "Order unit" column, mirroring how Brand landed in P1 |
| `lib/productValidation.ts`                 | `order_step` joins `EditableField` (§9.3)                               |
| `hooks/useProductForm.ts`                  | two new form fields                                                     |

### 2.3 The rule, stated so it can be grepped

> `orderingModel.ts` is the only file in `client/src/` that may contain both a
> quantity and a pack size in the same expression.

A reviewer can check this with:
`rg 'quantity_in_unit|packSize' client/src --glob '!**/orderingModel.ts' --glob '!**/priceEntryMode.ts'`
and confirm every hit is a _render_ of the number, never arithmetic on it.

---

## 3. Cart shape

### 3.1 Current (`cartStore.ts:4-14`)

```ts
export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  price: number; // price of ONE PACK
  priceOnEnquiry?: boolean;
  quantity: number; // ← packs. The name does not say so.
  unit: string;
  imageUrl?: string;
  moq: number; // packs
}
```

### 3.2 Proposed

```ts
export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  price: number; // UNCHANGED — price of ONE PACK
  priceOnEnquiry?: boolean;
  packs: number; // RENAMED from `quantity`. Canonical. Integer. Money multiplies THIS.
  unit: string; // UNCHANGED — unit_of_measure
  imageUrl?: string;
  moq: number; // UNCHANGED — in packs

  // ── ordering snapshot: display + stepping only, never money ──
  orderUnit: OrderUnit; // 'pack' | 'pcs' — resolved, already downgraded if impossible
  packSize: number; // pieces per pack at add time (1 when unusable)
  orderStep: number; // pcs per click (pcs mode); 1 in pack mode
}
```

**There is deliberately no `pcs` field.** The piece count is
`pcsFromPacks(item.packs, spec)` — derived at render, exactly as the per-piece
_rate_ is derived at render today and never stored (CLAUDE.md, canonical rule).
Persisting both numbers would recreate the `pack_size` problem inside
`localStorage`, where the two could drift across sessions with no way to tell which
one the customer actually chose.

**Why rename `quantity` → `packs` rather than leave it alone.** All twelve current
readers of `item.quantity` mean packs today, and after this change some screens will
be showing piece counts a few pixels away from that field. `quantity` is precisely
the word that will be misread. Renaming turns every unmigrated call site into a
**TypeScript compile error** — `npm run check` becomes an exhaustive, zero-cost
call-site audit, which matters a great deal in a repo whose only automated check is
`tsc` plus one hand-rolled script.

**Why snapshot `packSize` / `orderStep` at all, given they can go stale.** The cart
is persisted and the product can change underneath it. But `price` (line 8) is
_already_ snapshotted with exactly that property, and checkout already tells the
customer "GST & final pricing confirmed on WhatsApp" (`Cart.tsx:275`) — staleness is
the accepted model of this cart, and the snapshot does not make it worse because the
snapshot never touches money. Re-validating a persisted cart against the live
catalogue on load is a real improvement and is **out of scope**; noted for a later PR.

### 3.3 `updateQuantity` → `setPacks` + `setPcs`

`updateQuantity(productId, quantity)` (`cartStore.ts:65-75`) is renamed
`setPacks(productId, packs)` with identical semantics (`<= 0` removes the line —
`cartStore.ts:66-69` — which is how the ladder reaches `0 → line removed`).

A sibling `setPcs(productId, pcs)` is added for pcs-mode surfaces. It is a thin
wrapper: snap the pcs to the line's own step, convert to packs, delegate. It exists
so no component ever writes `packsFromPcs(...)` into a store call itself.

### 3.4 `getTotal` — line 82

```ts
// before
getTotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

// after
getTotal: () => get().items.reduce((sum, i) => sum + lineTotal(i.packs, i.price), 0),
```

Arithmetically identical for every existing cart (`packs` holds what `quantity`
held), but the multiply now lives in one function whose signature cannot accept a
piece count. On-enquiry lines already carry `price: 0` from `cartLinePrice` at
add-time (`ProductCard.tsx:59`, `ProductDetail.tsx:245`, `AddToCartButton.tsx:28`),
and `lineTotal` routes through `cartLinePrice` again, so the zero is guaranteed at
both ends.

### 3.5 `getItemCount` — line 84

This one needs a decision, because the word "item" is doing three jobs today:

| Consumer                      | Renders                                         | Means                         |
| ----------------------------- | ----------------------------------------------- | ----------------------------- |
| `Header.tsx:74`               | cart badge number                               | packs                         |
| `Cart.tsx:37`                 | `"{count} units"`, `"Subtotal ({count} units)"` | packs                         |
| `CartDrawer.tsx:45`           | badge + `"Total ({count} items)"`               | packs                         |
| `CartBar.tsx:21` (own copy)   | `"· {qty} pcs"`                                 | **packs, mislabelled as pcs** |
| `MobileNav.tsx:17` (own copy) | badge                                           | packs                         |

**Decided:** replace it with three explicitly named selectors and delete the
ambiguous one.

```ts
getPackCount:  () => items.reduce((n, i) => n + i.packs, 0),                  // selling units
getPieceCount: () => items.reduce((n, i) => n + i.packs * i.packSize, 0),     // pieces
getLineCount:  () => items.length,                                            // distinct products
```

`getItemCount` is **removed, not aliased** — the same compile-error-as-audit
argument as §3.2. Every current consumer maps to `getPackCount()`, so every badge
and label keeps today's number.

**Open decision, flagged not taken:** it is arguable that the header badge should
show `getLineCount()` (distinct products) rather than pack count — most B2B carts
do, and "2" reads better than "2" meaning 6000 pieces. That would change a visible
number for existing pack products, which §5 forbids, so this proposal keeps
`getPackCount()`. It is a one-line change if the owner wants it, and it should be
an explicit choice rather than a side effect of this work.

---

## 4. localStorage migration

### 4.1 What is on disk today

`cartStore.ts:86-89` configures `persist` with `name: "xl-cart-storage"` and **no
`version`**. zustand's `persist` defaults `version: 0` and writes
`{ state: {...}, version: 0 }`, so existing carts are already tagged `0` — a
`migrate` keyed on version 0 will see them correctly. `partialize` (line 88)
persists `items` and `customer`; the new `CartItem` fields live inside `items`, so
they persist with no config change.

### 4.2 Strategy

```ts
{
  name: "xl-cart-storage",
  version: 1,
  partialize: state => ({ items: state.items, customer: state.customer }),
  migrate: (persisted: any, fromVersion: number) => {
    if (fromVersion >= 1) return persisted;

    // v0 → v1. The ONLY thing a v0 cart knows is a pack count, held under the
    // old ambiguous name `quantity`. It knows nothing about pack sizes or
    // steps, and migrate() is synchronous and offline — there is no Supabase
    // call available here, by design.
    const items = (persisted?.items ?? [])
      .filter((i: any) => i && typeof i.productId === "string")
      .map((i: any) => ({
        productId: i.productId,
        sku: i.sku ?? i.productId,
        name: i.name ?? "",
        price: Number.isFinite(i.price) ? i.price : 0,
        priceOnEnquiry: i.priceOnEnquiry,
        packs: Number.isFinite(i.quantity) && i.quantity > 0
          ? Math.floor(i.quantity)
          : 1,
        unit: i.unit ?? "pcs",
        imageUrl: i.imageUrl,
        moq: Number.isFinite(i.moq) && i.moq > 0 ? Math.floor(i.moq) : 1,
        // Conservative, and deliberately not guessed — see below.
        orderUnit: "pack" as const,
        packSize: 1,
        orderStep: 1,
      }));

    return { items, customer: persisted?.customer ?? { name: "", phone: "" } };
  },
}
```

### 4.3 The three decisions inside that function

**Migrated lines land in pack mode, always.** A v0 cart records a pack count and
nothing else. Setting `orderUnit: 'pack', packSize: 1, orderStep: 1` makes the line
behave exactly as it does today: stepper in packs, money `packs × price`, the same
number on screen as before the deploy. The alternative — fetching each product on
rehydrate and re-deriving its spec — is rejected: it makes the store async, and it
would mean a cart the customer built yesterday silently redisplays "6000 pcs"
tomorrow. A stale-but-correct pack line beats a surprising piece line.

**A migrated line converts to pcs on the customer's next deliberate action**, not
in the background. When the customer opens that product's card or PDP, the fresh
spec is available and the add/step handlers use it; the persisted line is upgraded
at that point, from a user action, visibly.

**Malformed entries are dropped, not repaired.** The `.filter()` on `productId`
plus the `Number.isFinite` guards mean a corrupted blob yields a shorter cart rather
than an exception during rehydrate. An exception here white-screens every storefront
page, because `Header` — and therefore `MobileNav` and `CartBar` — subscribes to
this store on every route.

### 4.4 Known, accepted gaps

- A second tab still running the old bundle can write a v0 blob back over the v1
  one. It will simply be re-migrated on next load. Unsolvable without a broadcast
  channel; not worth it for a WhatsApp-checkout cart.
- `xl_recently_viewed` (`ProductDetail.tsx:32`) is a separate key and is untouched.

---

## 5. Fallback for the ~142 existing products

### 5.1 The mechanical argument

Every existing row gets `order_unit = 'pack'` from the column DEFAULT and
`order_step = NULL` (no backfill statement exists in the SQL proposal — see the
verification query that asserts this). Feeding that through `resolveOrdering`:

```
unit     = 'pack'                       (the column value; nothing downgrades it)
packSize = packDivisor(quantity_in_unit) ?? 1
step     = 1                            (pack mode: one pack per click)
minPacks = moq ?? 1
minPcs   = n/a in pack mode
```

**The only branch on new behaviour anywhere in the design is `spec.unit === 'pcs'`.**
No existing row can produce it: the column DEFAULT is `'pack'`, the CHECK admits only
two values, and no statement in the proposal writes `'pcs'`. Reaching pcs mode
requires an operator to open the Ordering section and change the control.

So for all ~142 rows the pack branch executes — and the pack branch is today's code
with variables renamed.

### 5.2 Surface by surface

| Surface                         | Today                                                               | After (pack mode)                                                          | Identical?    |
| ------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------- |
| **Card** spec line              | `3000 pcs/pack · MOQ 1` (`ProductCard.tsx:146-151`)                 | same literal — the pcs variant is gated on `unit === 'pcs'`                | ✅ byte       |
| **Card** price block            | untouched — reads `price`/`quantity_in_unit`, never ordering fields | unchanged file region                                                      | ✅ byte       |
| **Card** add                    | `addItem(...)` then `updateQuantity(id, moq)` (`:65-67`)            | `addItem(...)` then `setPacks(id, spec.minPacks)`; `minPacks === moq ?? 1` | ✅            |
| **Card** stepper                | `cartLine.quantity + delta` (`:76`)                                 | `stepPacks(packs, delta, spec)` = `packs + delta`                          | ✅            |
| **PDP** qty seed                | `setQty(currentProd?.moq ?? 1)` (`:232`)                            | `setPacks(spec.minPacks)`, same value                                      | ✅            |
| **PDP** `+5/+10/+25`            | `q + n` packs (`:617-627`)                                          | pack mode keeps `+5/+10/+25` packs verbatim                                | ✅ byte       |
| **PDP** MOQ note                | `Below MOQ — minimum {moq}` / `✓ MOQ {moq} met` (`:637-639`)        | same literals in pack mode                                                 | ✅ byte       |
| **PDP** button                  | `Add to Cart · ₹{price × qty}` (`:649-650`)                         | `₹{lineTotal(packs, price)}` = `price × packs`                             | ✅            |
| **Cart** line qty               | bare number in the input (`:206`)                                   | `formatQty(...).primary` = bare number, `secondary` = `null`               | ✅ byte       |
| **Cart** below-MOQ              | `Below MOQ — minimum {moq}.` + `Fix to {moq}` (`:173-181`)          | same literals                                                              | ✅ byte       |
| **Cart** line amount            | `₹{price × quantity}` (`:228`)                                      | `lineTotal`                                                                | ✅            |
| **Cart** summary                | `Subtotal ({count} units)` (`:257`)                                 | `count = getPackCount()` = old `getItemCount()`                            | ✅ byte       |
| **CartDrawer**                  | `₹{price × qty}` + `(₹{price} × {qty})` (`:158-161`)                | same, `packs` substituted                                                  | ✅            |
| **WhatsApp** line               | `{quantity} x {name} — ₹{price × quantity}` (`:46-48`)              | `{formatQty().primary} x {name} — …`; pack primary is the bare number      | ✅ byte       |
| **WhatsApp** totals             | `Total: ₹{n}` / `Items: {n}` (`:60, 70`)                            | `Items` = pack count = old item count                                      | ✅ byte       |
| **orders / order_items**        | `quantity: item.quantity`, `subtotal: price × quantity` (`:29-33`)  | `item.packs`; column still means selling units                             | ✅ byte       |
| **Admin** table/panel/workbench | no ordering fields exist                                            | new section renders `Per pack` preselected, Order Step hidden              | ✅ (additive) |
| **Health** `v_product_health`   | 8 dimensions                                                        | untouched — no new dimension proposed                                      | ✅            |
| **Import** v3 template          | no ordering columns                                                 | untouched — deliberately deferred                                          | ✅            |

### 5.3 One intentional exception, flagged for veto

`CartBar.tsx:63` and `:88` render `"{items.length} items · {qty} pcs"` where `qty` is
a **pack** count (`CartBar.tsx:21`). That label is wrong today: a cart holding two
packs of 3000 says "2 pcs". This proposal fixes it to `"· {qty} units"`.

It is the **only** string in the whole design that changes for a pack product. It is
listed here rather than buried because §5's guarantee is otherwise absolute. If the
owner would rather keep the mislabel for now, dropping this one change costs nothing
else in the design.

### 5.4 The 11 Hinged box rows

They inherit `order_unit = 'pack'` like everything else and are therefore covered by
§5.1 — byte-identical. **No script, no backfill, no detection heuristic.** See §6.5.

---

## 6. Edge cases — each with a decided answer

### 6.1 `quantity_in_unit` is NULL, 0 or 1

**Decision: `packSize` falls back to `1`, and pcs mode is _downgraded to pack mode_
at resolve time.**

```ts
const divisor = packDivisor(p.quantity_in_unit); // priceEntryMode.ts:43
const packSize = divisor ?? 1;
const unit: OrderUnit =
  p.order_unit === "pcs" && divisor != null ? "pcs" : "pack";
```

Reusing `packDivisor` means NULL, `""`, junk and `<= 1` all resolve to `null` in one
place, with one already-tested rule.

- **NULL / 0** — there is no divisor, so a piece count cannot be converted to packs
  and therefore cannot be converted to money. Pack mode is the only safe answer.
  (`0` is unreachable through admin validation — `validatePositiveInt` refuses `<= 0`,
  `productValidation.ts:51` — but is reachable through import and legacy rows.)
- **1** — pieces and packs are the same number, so pcs mode would add labels and no
  capability. This matches the reasoning already written into `packDivisor`'s
  docblock for per-piece price entry (`priceEntryMode.ts:38-42`).

**Downgrade, not error.** A row mid-edit is a normal state during the rebuild. The
customer gets a correct pack product; the operator sees the row flagged in admin
(§9.3), where it can be fixed.

### 6.2 `order_step` is not a divisor/multiple of `quantity_in_unit`

**Decision: `order_step` must be a positive integer _multiple_ of `packSize`.
Refused at entry; degraded at render.**

- **Entry** — admin validation refuses a non-multiple with
  `Order step must be a whole number of boxes — try 3000, 6000 or 9000` (§9.3).
- **Render** — `resolveOrdering` faced with a stored non-multiple (import, legacy,
  a pack size edited after the step was set) **falls back to `step = packSize`**, i.e.
  behaves as if the step were unset. Never a crash, never a surprise for the
  customer, and the bad value is still visible in admin.

**Why a multiple and not "any positive integer".** Allowing a sub-pack step (1500 on
a 3000-pack, a genuine "half case") makes `packs` fractional, and `packs` is the
number that flows into `order_items.quantity` (`orderService.ts:30`), the cart total,
and the MOQ comparison. Fractional packs would need: a confirmed non-integer type on
`order_items.quantity`, a rounding policy for `subtotal`, and a rethink of what
"MOQ 1" means when 0.5 is orderable. That is a larger design than this one and it is
**explicitly deferred**, not overlooked. Under the multiple rule, `packs` is always a
positive integer and every downstream type is unchanged. The SQL proposal includes a
read-only query reporting `order_items.quantity`'s data type, so the half-case
question can be reopened with facts.

**What `order_step` still buys**, given it must be a multiple: products sold only in
multi-pack lots — a step of 6000 on a 3000-piece pack gives the ladder
`6000 → 12000 → 18000`, two cases at a time.

**MOQ interaction.** `minPcs` is the MOQ **snapped up to a whole step**:

```ts
const rawMinPcs = minPacks * packSize;
const minPcs = Math.ceil(rawMinPcs / step) * step;
```

Without that, an MOQ of 1 pack against a step of 2 packs would leave the floor
unreachable by the stepper.

**Snapping rule for typed input:** nearest step, **ties round up**, then clamp to
`minPcs`. So typing `4500` against a 3000 step gives `6000`; typing `1000` gives
`3000` (nearest is 0, clamped up to the `minPcs` floor). `1000`, `2000` and `4500`
are never _retained_, which is the brief's requirement.

### 6.3 `price` is NULL (On Enquiry) — steppers must still work

**Decision: no function in `orderingModel.ts` takes `price` as an input, except
`lineTotal`.**

The stepper is driven entirely by `OrderingSpec`, which is built from
`order_unit`, `order_step`, `quantity_in_unit`, `moq` and `unit_of_measure` — no
price. So an on-enquiry product's stepper is structurally identical to a priced one.

This matches what already ships: `ProductCard`'s cart controls (`:203-240`) are gated
on authentication, never on price, and `cartLinePrice` (`priceUtils.ts:17-19`) zeroes
the money at add time so a NULL price cannot poison a total.

Copy for a pcs on-enquiry product:

- Card: stepper works, price block shows `Price on enquiry` in amber (unchanged).
- PDP: `Add to Cart` with no `· ₹total` suffix — already the behaviour
  (`ProductDetail.tsx:649`), because the suffix is gated on `!isPriceOnEnquiry`.
- Cart line: quantity `6000 pcs` / `2 boxes × 3000 pcs`; amount column `—`
  (unchanged, `Cart.tsx:227`).
- WhatsApp: `6000 pcs (2 boxes × 3000) x {name} — price on enquiry`.
- An all-enquiry cart still shows `On enquiry` instead of `₹0`
  (`Cart.tsx:38`, `orderService.ts:57-60`) — untouched.

### 6.4 Variants where master and variant disagree

**Decision: they cannot disagree. Ordering is per-variant, always.**

`product_masters` carries name, slug, category, brand, description and SEO
(CLAUDE.md schema) — no quantity, no MOQ, no price — and **this proposal adds no
ordering column to it**. Every variant is a full `products` row with its own
`quantity_in_unit`, `moq`, `order_unit` and `order_step`, which is correct on the
merits: a 250ml and a 1000ml variant of the same master genuinely have different
pack sizes.

`ProductDetail` already reads every field off `currentProd = selectedVariant || product`
(`:228`), so `resolveOrdering(currentProd)` is a one-line substitution.

The real hazard is the **variant switch**, and it has its own decision:

> **On variant change, reset the stepper to the new variant's minimum. Never carry a
> piece count across the switch.**

6000 pieces of a 3000-piece variant is 2 packs; 6000 pieces of a 1000-piece variant
is 6 packs — carrying the number across would silently triple the order. The existing
effect at `ProductDetail.tsx:231-233` already resets on `currentProd?.id` change; it
keeps that shape and reseeds from `spec` instead of `moq`.

Admin needs no change: `AdminMasters` / `MobileMasterSheet` link each variant to the
full editor, where the Ordering section is per-row like every other field.

### 6.5 The 11 Hinged box rows entered per-piece

**Decision: nothing is scripted, detected, or written for these rows. At all.**

Per CLAUDE.md's carve-out, their `price` values conflict with their standalone
duplicates and reconciling them is a pricing call the owner makes by hand. This
proposal:

- writes no UPDATE touching them (the SQL file contains no UPDATE at all);
- adds no heuristic that infers "this price looks per-piece";
- leaves them at `order_unit = 'pack'` via the DEFAULT, so their behaviour is
  byte-identical to today (§5.1).

**One thing to know before the owner enables pcs mode on them.** pcs mode does not
change the arithmetic — money stays `packs × price` — so it neither fixes nor
worsens whatever those prices are. What it _does_ do is make the error louder: the
UI would print `6000 pcs · 2 boxes · ₹{2 × price}` in a context that asserts `price`
is a pack price. **Reprice first, switch second.** The SQL proposal includes a
read-only query that lists these rows so the owner can see exactly which are excluded.

---

## 7. Sorting

### 7.1 The problem

`applyPublicSort` maps `"price-low"` to `.order("price", { ascending: true, nullsFirst: false })`
(`productService.ts:331`), and `Catalog.tsx:268` offers it as "Price: Low to High".
That sorts on the **pack** price. Once a per-piece rate is the primary displayed
figure, a ₹120 pack of 100 sorts above a ₹90 pack of 1000 — the cheaper product per
piece, by a factor of 13, appears further down. CLAUDE.md already records this exact
limitation for the admin table's per-piece display; this is the storefront half of it.

### 7.2 Proposed: a generated column + partial index

```sql
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_per_piece NUMERIC
  GENERATED ALWAYS AS (
    CASE
      WHEN price IS NULL OR price <= 0 THEN NULL
      WHEN quantity_in_unit IS NULL OR quantity_in_unit <= 0 THEN price
      ELSE price::numeric / quantity_in_unit
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS products_price_per_piece_idx
  ON public.products (price_per_piece)
  WHERE is_active AND status = 'published';
```

- **Generated, not a trigger** — it cannot drift from `price` / `quantity_in_unit`,
  which is the whole argument of §1.4 applied at the database level.
- **The `CASE` mirrors `isPriceOnEnquiry`** (`priceUtils.ts:11-13`): NULL and
  `<= 0` both mean "no price", so they sort as NULL and land last with
  `nullsFirst: false`, matching how the pack-price sort already behaves.
- **`quantity_in_unit <= 0 THEN price`** keeps a packless product in the ordering at
  its pack price rather than dropping it out — the same "fall back to the pack figure
  and say so" rule the admin table uses.
- **`STORED`, not `VIRTUAL`** — Postgres only supports STORED, and it is what an
  index needs. It rewrites the table once; at ~142 rows that is instant, and it will
  still be fast at the 1000-row goal.
- **Partial index** matching the storefront's `status='published' AND is_active`
  filter, so it is small and actually used.

A plain expression index was considered and rejected: PostgREST's `.order()` can only
name a column, so the client could not reference the expression.

### 7.3 🔴 Security — this is the sharp edge

`price_per_piece` is derived from `price`. Architecture Rule #3 makes column-level
grants the real price boundary, and `sql/04-price-column-security.sql` deliberately
withholds `price`, `mrp` and `discount_percent` from `anon`.

> **`price_per_piece` must NOT be granted to `anon`.** Guests _can_ read
> `quantity_in_unit` (`sql/04:29`), so a granted per-piece rate multiplied by the
> pack size reconstructs the exact wholesale price. That is a total bypass of the
> B2B price gate.

Consequences, all of them intended:

- The new column is **absent** from the `GRANT SELECT (...)` list in the proposal.
  Because `sql/04` revoked the blanket table grant, a newly added column is
  ungranted by default — the failure mode is closed, not open. The proposal states
  this rather than relying on it.
- `price_per_piece` must **not** be added to `GUEST_PRODUCT_COLS`
  (`productService.ts:23-26`).
- Per-piece sorting is **authenticated-only**, exactly like pack-price sorting. In
  `applyPublicSort`, a guest requesting a price sort must fall back to
  `display_order` rather than emitting an ORDER BY on an ungranted column.

### 7.4 ⚠️ A likely pre-existing bug, surfaced by this work — not fixed here

`sql/04:44-48` documents that a `WHERE` on a column `anon` cannot SELECT raises
`permission denied`, which is why `status` had to be granted. **The same is true of
`ORDER BY`** — and `applyPublicSort` currently emits `ORDER BY price` for guests too,
since `getAll` chooses columns via `productSelectCols()` (`:417`) but applies the
sort unconditionally (`:427`), while `Catalog.tsx` offers the price-sort options to
everyone (`:268`, `:650`).

**CONFIRMED against the live database on 15 Aug 2026.** Executed as the `anon`
role:

```
anon ORDER BY price          -> FAILED: permission denied for table products
anon ORDER BY display_order  -> SUCCEEDED
```

So a signed-out visitor choosing "Price: Low to High" on `/catalog` gets a failed query
and an empty catalogue **today**, independently of this model. `Catalog.tsx` offers the
price sorts with no auth gate in three places (`:268`, `:474`, `:650`). The fix — guest
price sorts fall back to `display_order` — belongs in the ordering PR.
A verification query for it is included in the SQL proposal, and the fix (guest price
sorts fall back to `display_order`) belongs in the implementation PR, since §7.3
requires touching `applyPublicSort` anyway.

### 7.5 Owner-run

The generated column and its index are **DDL and are owner-run**, and they are
separated in the SQL file from the two ordering columns so they can be applied
independently. They are also strictly optional for the ordering model itself:
ordering works without them; only the _sort order_ is affected.

---

## 8. UI copy spec

### 8.1 The selling-unit noun

The brief's example line is `2 boxes x 3000 pcs`. "box" is a **selling-unit noun**,
and the schema has no column for one. Three options were considered:

1. Hardcode `"pack"` → the line reads `2 packs × 3000 pcs`. Correct, slightly flat.
2. Use `unit_of_measure` → contradicts CLAUDE.md's PR-5 note that `unit_of_measure`
   "names the pieces INSIDE the pack and never the selling unit".
3. Add a column → the brief says not to, and §1.4's argument applies.

**Decided: option 4 — a derivation, in `orderingModel.ts`, with no new column.**

```ts
const PIECE_WORDS = new Set(["pcs", "pc", "piece", "pieces", "nos", "no"]);
// unit_of_measure holds a PIECE word ("pcs") on some rows and a PACK word
// ("box", "roll", "set" — see the Import Template v3 unit list in CLAUDE.md)
// on others. When it is not a piece word, it is naming the selling unit.
const noun = PIECE_WORDS.has(unit_of_measure?.trim().toLowerCase() ?? "")
  ? "pack"
  : unit_of_measure!.trim() || "pack";
```

This reconciles a genuine tension in the existing docs: the import template's `unit`
column lists `pcs/box/kg/set/roll/meter/litre/packet` (CLAUDE.md), so on a `box` row
`unit_of_measure` demonstrably names the pack, while on a `pcs` row it names the
pieces. The derivation reads it correctly in both cases and produces the brief's
exact wording.

**Flagged for owner confirmation.** If the live `unit_of_measure` data does not
support this reading, the fallback is a hardcoded `"pack"` — one constant, no other
change. Pluralisation is naive (`+ "s"`), which is right for box/pack/roll/set/carton
and wrong for nothing in the current unit list.

Below, `{U}` = the noun, `{Us}` = its plural.

### 8.2 ProductCard

**Pack mode — every string byte-identical to today.**

| Element         | pcs mode                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Spec line       | `3000 pcs/box · MOQ 3000 pcs` _(today, pack mode: `3000 pcs/pack · MOQ 1`)_                                             |
| Stepper readout | `6000 pcs`                                                                                                              |
| Under stepper   | `2 boxes`                                                                                                               |
| Add button      | `Add to Cart` _(unchanged)_                                                                                             |
| Add toast       | `Added — 3000 pcs (1 box, MOQ)` _(pack mode keeps `Added — {moq} {unit} (MOQ pre-filled)`)_                             |
| Anon            | price block and `Sign in for exact price` unchanged; the spec line above renders for anon too, exactly as it does today |

### 8.3 ProductDetail (PDP)

| Element         | pcs mode                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Price card      | `₹4,897 / pack of 3000 pcs` … `₹1.63/pc` _(unchanged — it already reads this way)_              |
| Quantity label  | `Quantity (pcs)` _(pack mode keeps `Quantity ({unit_of_measure})`)_                             |
| Stepper         | `6000`, moving in 3000s                                                                         |
| Under stepper   | `= 2 boxes × 3000 pcs · steps of 3000`                                                          |
| Quick-add chips | `+1 box` `+2 boxes` `+5 boxes` _(pack mode keeps `+5` `+10` `+25`)_                             |
| Below MOQ       | `Below MOQ — minimum 3000 pcs (1 box)`                                                          |
| MOQ met         | `✓ MOQ 3000 pcs met`                                                                            |
| Add to Cart     | `Add to Cart · ₹9,794` _(money from packs; unchanged shape)_                                    |
| Enquire message | `Quantity: 6000 pcs (2 boxes × 3000)` _(pack mode keeps `Quantity: {quantity_in_unit} {unit}`)_ |

**Why the quick-add chips change.** `+5` on a 3000-piece step means +5 _pieces_,
which the snapper would discard — a button that visibly does nothing. In pcs mode
they add whole packs, which is the same intent (`+5 packs`) expressed in the unit the
customer is now counting in.

### 8.4 Cart line — the brief's example

```
6000 pcs                     ← primary, in the stepper
2 boxes × 3000 pcs           ← secondary, directly beneath
₹4,897 / box  (₹1.63/pc)     ← unit price line (pack mode today: ₹{price} / {unit})
                    ₹9,794   ← line amount, right-aligned (= 2 × 4,897)
```

| Element           | pcs mode                                                            | pack mode                                                                 |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Below MOQ chip    | `Below MOQ — minimum 3000 pcs.` + `Fix to 3000 pcs`                 | `Below MOQ — minimum {moq}.` + `Fix to {moq}` _(unchanged)_               |
| Stepper `+` / `−` | ±3000 pcs; at `3000` a further `−` goes to `0` and removes the line | ±1 pack _(unchanged)_                                                     |
| Typed input       | snapped on commit (§6.2): `4500` → `6000`, `1000` → `3000`          | integer, unchanged                                                        |
| Title             | `· {items.length} items, {count} units`                             | _(unchanged)_                                                             |
| Subtotal          | `Subtotal ({count} units)`                                          | _(unchanged — "units" is accurate for both; packs **are** selling units)_ |
| Total             | `₹9,794` / `On enquiry`                                             | _(unchanged)_                                                             |

### 8.5 WhatsApp message (`orderService.buildWhatsAppMessage`)

```
🛒 New Order from XL Traders
Customer: Rajesh
Phone: 9876543210
──────────
6000 pcs (2 boxes × 3000) x Cling Film 12in — ₹9,794
2 x Hinged Box 250ml — ₹1,200
1500 pcs (5 packs × 300) x Paper Napkin — price on enquiry
──────────
Total: ₹10,994
Items: 8
```

- **pcs line:** `{pcs} pcs ({packs} {Us} × {packSize}) x {name} — ₹{total}`
- **pack line:** `{packs} x {name} — ₹{total}` — **byte-identical to today**
  (`orderService.ts:46-48`)
- **on-enquiry:** `… — price on enquiry` in both modes _(unchanged)_
- `Total:` / `Total: Price on enquiry` — unchanged (`:57-60`)
- `Items: {n}` — pack count, i.e. the same number as today (`:54`)

The message is a manual-fulfilment document. Both the piece count (what the customer
asked for) and the pack count (what gets picked off the shelf) belong in it, which is
why the pcs line carries both rather than choosing.

### 8.6 CartBar

`{n} items · {qty} units` — the mislabel fix from §5.3, and the only pack-product
string change in the document.

---

## 9. Admin "Ordering" section

### 9.1 Placement

- **`CatalogProductPanel`** (the side drawer): a new **Ordering** section between
  Pricing and Availability.
- **`CatalogWorkbench`** fields pane: the same fields appended to the existing
  **Product** section (Name, Price, Pack qty, MOQ, Unit) — ordering is bought-with-price
  information, and the owner's 26 Jul 2026 grouping decision put those fields first
  because that is the order data entry happens in.
- **`CatalogTreeEditor`** table: a hidden-by-default **Order unit** column, following
  exactly how the Brand column landed in PIM P1.

### 9.2 Fields

| #   | Control                                                       | Behaviour                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Customers order in** — Select: `Packs` (default) / `Pieces` | Disabled with the hint `Needs a pack quantity above 1` when `packDivisor(quantity_in_unit) == null`. This mirrors, pixel for pixel, the disabled state the Workbench already shows for per-piece price entry.                   |
| 2   | **Pack size** — read-only                                     | Text, never an input: `3000 pcs per box — edit "Pack qty" above`. Two inputs bound to one column is how columns drift; the mirror is there so the operator can see the number the step must be a multiple of without scrolling. |
| 3   | **MOQ** — the existing field                                  | Stored value stays in **packs**, unchanged. In pcs mode a derived line appears beneath: `1 box = 3000 pcs minimum`. No second field, no second column (§1.5).                                                                   |
| 4   | **Order step** — integer input                                | Only rendered when #1 is `Pieces`. Placeholder `3000 (one box)`. Empty = one pack.                                                                                                                                              |

**Live preview line** under the section, so the operator sees the customer's ladder
without leaving admin:

> `Customers will order 3000 → 6000 → 9000 pcs. Minimum 3000 pcs (1 box).`

and, when a stored value has been degraded by §6.2's render-time fallback:

> ⚠ `Saved step 1000 isn't a whole number of boxes — customers are stepping by 3000 until this is fixed.`

### 9.3 Validation rules

`productValidation.ts` gains `order_step` to `EditableField`, following the existing
`validatePositiveInt` shape (`:41-53`) so the messages stay consistent:

| Input                                          | Result                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| blank                                          | `{ patch: { order_step: null } }` — inherit the pack size                                                                             |
| non-numeric                                    | `Order step must be a number`                                                                                                         |
| non-integer                                    | `Order step must be a whole number`                                                                                                   |
| `<= 0`                                         | `Order step must be more than 0`                                                                                                      |
| not a multiple of `packSize`                   | `Order step must be a whole number of boxes — try 3000, 6000 or 9000` (the three suggestions are `1×`, `2×`, `3×` the live pack size) |
| switching to `Pieces` with no usable pack size | `Set a pack quantity above 1 before ordering by piece`                                                                                |

Note what is deliberately absent: **blank is never an error**, matching MOQ and pack
quantity, and matching the DE-01 principle that a cleared field means "unknown" and
never a silent business decision.

### 9.4 🔶 The naming collision with per-piece price entry

This is the part most likely to cause a real mistake, so it gets its own decisions.

Two unrelated things would otherwise both be called "per piece", **in the same fields
pane**:

|               | Price entry (**exists**, `lib/priceEntryMode.ts`) | Ordering (**proposed**)           |
| ------------- | ------------------------------------------------- | --------------------------------- |
| Scope         | The whole editor, one UI preference               | Per product                       |
| Persisted     | URL param `priceEntry`, no DB                     | Column `products.order_unit`      |
| Default       | **`piece`** (`DEFAULT_PRICE_MODE`, `:29`)         | **`pack`**                        |
| Audience      | The operator, alone                               | Every customer                    |
| Effect        | The string in the price box before validation     | The stepper, cart lines, WhatsApp |
| Touches money | Never (`:14-16`)                                  | Never                             |

Two toggles, opposite defaults, one visible only to the operator and one visible to
every customer. Selecting "per piece" in the wrong one is a mistake with no feedback.

**Proposed wording — the two must never share a phrase:**

- **Price entry** keeps its place in the Pricing section, relabelled from
  `Enter as: Per pack | Per piece` to:
  > **Price I'm typing:** `Per pack` `Per piece`
  > _Affects this box only — not the customer._
- **Ordering** never uses the bare phrase "per piece" anywhere. The control is:
  > **Customers order in:** `Packs` `Pieces`
  > _Pieces snap to the step below — 3000, 6000, 9000…_

The distinguishing words are therefore **"I'm typing"** vs **"Customers"**, and
**"Per piece"** vs **"Pieces"** — a difference in grammatical person, which survives
being skim-read in a way that two identical labels in different sections does not.

**Code-level guards:**

- `orderingModel.ts` imports exactly one symbol from `priceEntryMode.ts`
  (`packDivisor`, §2.1) and nothing else. `PriceEntryMode` and `OrderUnit` are
  separate types with different member names (`"pack" | "piece"` vs `"pack" | "pcs"`)
  so they cannot be assigned to one another by accident.
- Both files' header comments gain a cross-reference naming the other and stating in
  one line what it is **not**.

---

## 10. Test plan

### 10.1 What exists today

`package.json` has `check` (`tsc --noEmit`), `check:price`
(`node scripts/check-price-entry.ts`) and `format`. There is **no test runner and no
test dependency**, and `scripts/check-price-entry.ts` is run by Node's native type
stripping specifically to avoid adding one. That precedent is followed here rather
than introduced against.

### 10.2 Automated: `scripts/check-ordering-model.ts`

New script, same shape as `check-price-entry.ts` (a `check(label, actual, expected)`
helper, a failure counter, `process.exit(failures === 0 ? 0 : 1)`), wired as:

```json
"check:ordering": "node scripts/check-ordering-model.ts",
"check:all": "npm run check && npm run check:price && npm run check:ordering"
```

Assertions, grouped as they will appear in the output:

**A. Defaults — the ~142-row guarantee (§5)**

- no ordering columns at all → `{ unit:'pack', packSize:1, step:1, minPacks:1 }`
- `order_unit:'pack'` with `quantity_in_unit:3000, moq:2` → `{ unit:'pack', packSize:3000, step:1, minPacks:2 }`
- `stepPacks(n, ±1, packSpec) === n ± 1` for the fixtures — literally today's arithmetic

**B. The worked example ladder (§0)**

- `q=3000, moq=1, unit='pcs', step=null` → `{ unit:'pcs', packSize:3000, step:3000, minPcs:3000 }`
- the exact sequence `3000 → 6000 → 9000 → 6000 → 3000 → 0` via `stepPcs`
- `snapPcs` of `1000`, `2000`, `4500`, `2999`, `4501` never returns any of `1000/2000/4500`
- `stepPcs(3000, -1)` → `0` (line removal, matching `cartStore.ts:66-69`)

**C. Degradation (§6.1, §6.2)**

- `unit:'pcs'` with `quantity_in_unit` of `null`, `0`, `1`, `""`, `"abc"` → `unit === 'pack'` in all five
- `step:1000` on `packSize:3000` (non-multiple) → `step === 3000`
- `step:6000` on `packSize:3000` (valid multiple) → `step === 6000`, ladder `6000 → 12000`
- `moq:1, packSize:3000, step:6000` → `minPcs === 6000` (snapped up, §6.2)

**D. Money never comes from pcs**

- `lineTotal(2, 4897) === 9794` across the `check-price-entry.ts` fixture prices
- `lineTotal(n, null) === 0` and `lineTotal(n, 0) === 0` (composes `cartLinePrice`)
- **round-trip invariant:** for every legal pcs value `x` (a step multiple `≥ minPcs`),
  `pcsFromPacks(packsFromPcs(x, s), s) === x`, across a matrix of packSize × step —
  the assertion that catches any rounding introduced into the conversion pair, which
  is the failure `check-price-entry.ts` was written to catch on the pricing side

**E. The v0 → v1 cart migration (§4)** — `migrate` is a pure function and is exported
for this purpose

- a realistic v0 blob → every line has `packs` equal to the old `quantity`,
  `orderUnit:'pack'`, `packSize:1`, `orderStep:1`
- an item missing `productId` → dropped, no throw
- `quantity: 0` / `NaN` / absent → `packs: 1`
- `fromVersion: 1` → returned unchanged (idempotent re-run)

**F. Copy (§8)** — `formatQty` is pure and cheap to assert

- pack mode → `{ primary: "2", secondary: null }` — the byte-identity guarantee for
  the cart stepper and the WhatsApp line
- pcs mode → `{ primary: "6000 pcs", secondary: "2 boxes × 3000 pcs" }`
- noun derivation: `"box"` → `box/boxes`; `"pcs"` → `pack/packs`; `null` → `pack/packs`

Each assertion is written so that **deleting the guard it covers makes it fail** —
the standard `check-price-entry.ts` states in its header and applies to its
open-and-close block.

### 10.3 `npm run check` is the call-site audit

The `quantity` → `packs` rename (§3.2) and the `getItemCount` removal (§3.5) make
`tsc --noEmit` enumerate every unmigrated site. A clean `npm run check` is therefore
not a formality on this PR — it is the completeness proof for §2.2's table.

### 10.4 Manual QA checklist

Six fixture products, created as drafts and published only for the run
(`ZZ-TEST-PRODUCT` is the standing scratch row; Critical Rule #13 makes extra rows
cheap):

| #   | Fixture                                                                |
| --- | ---------------------------------------------------------------------- |
| P1  | legacy pack product, `moq 2`, `quantity_in_unit 3000`, priced          |
| P2  | pcs, `step = null` (⇒ 3000), `moq 1`, priced — **the brief's example** |
| P3  | pcs, `step 6000` (2 packs), `moq 1`, priced                            |
| P4  | pcs flagged but `quantity_in_unit` NULL — must render as P1 does       |
| P5  | pcs, **price NULL** (on enquiry)                                       |
| P6  | a master with two variants at different pack sizes (3000 / 1000)       |

Each fixture × each surface, signed **out** and signed **in**:

- [ ] Card: spec line, price block, add, stepper ladder, toast
- [ ] Card in **list** view (a separate render path, `ProductCard.tsx:262-295`)
- [ ] PDP desktop: price card, stepper, quick-add chips, MOQ note, Add-to-Cart total
- [ ] PDP **mobile** sticky bar (`:789-815` — a second copy of the button and total)
- [ ] Variant switch on P6: stepper resets to the new variant's minimum, never carries pcs
- [ ] `/cart`: primary/secondary quantity, unit price line, below-MOQ + Fix, typed-input snapping, line amount, subtotal, total
- [ ] `CartDrawer` (still mounted alongside `/cart`)
- [ ] `CartBar` mobile + desktop, and the min-order progress strip
- [ ] `MobileNav` badge, `Header` badge
- [ ] WhatsApp message text — copied out and compared literally, priced and on-enquiry
- [ ] `orders` + `order_items` rows after a real submit — `quantity` is packs, `subtotal = price × packs`
- [ ] Admin: Ordering section in panel + Workbench, all six §9.3 validation messages, the degraded-value warning on P3 after editing its pack size to a non-divisor
- [ ] Admin: per-piece **price entry** toggle still behaves exactly as before, and `npm run check:price` still passes — the two features must not have merged

**Byte-identity regression (§5), run first and recorded:**

- [ ] On `main`, for P1 and one real live product, capture verbatim: card spec line,
      card price block, PDP MOQ note, cart line + subtotal + total, and the full
      WhatsApp message body.
- [ ] Repeat on the branch. Diff must be **empty**, except the single documented
      `CartBar` label change (§5.3).

**Migration:**

- [ ] Build a cart on `main` (3 lines, one on-enquiry), deploy the branch over it
      _without clearing storage_, reload: same products, same pack counts, same total,
      all lines in pack mode.
- [ ] Hand-corrupt `xl-cart-storage` (drop a `productId`, set `quantity: "x"`) and
      reload: the storefront renders, the bad line is gone, no white screen.

---

## 11. Sequencing

1. Owner runs [`docs/sql/PROPOSAL-ordering-model.sql`](sql/PROPOSAL-ordering-model.sql),
   **including the `anon` grant**, and logs it to `docs/CHANGELOG_SQL.md`.
2. Only then does the implementation PR merge. A deploy that requests
   `order_unit` before the grant exists returns `permission denied` to every guest
   product query — the exact failure `sql/04:44-48` documents for `status`.
3. The generated column + index (§7.2) is a separate, independent step and can come
   later; ordering does not depend on it.

Per the Autonomous Merge Policy, the implementation PR touches **database schema**
and **cart/pricing money logic** — two of the listed exceptions — so it must stop
for explicit go-ahead even with everything green.

---

## 12. Open questions for the owner

1. **Selling-unit noun (§8.1)** — is deriving it from `unit_of_measure` right, or
   should everything just say "pack"? This is the one place the spec reads live data
   in a way the docs do not fully settle.
2. **Header badge (§3.5)** — keep pack count (today's behaviour, preserved here), or
   switch to distinct-products?
3. **`CartBar` label (§5.3)** — fix the `pcs`/`units` mislabel in this PR, or leave it?
4. **Sub-pack steps (§6.2)** — is a "half case" a real requirement? If so it is a
   follow-up design, not a parameter change.
5. **Guest price sorting (§7.4)** — needs one live check to confirm or dismiss.
