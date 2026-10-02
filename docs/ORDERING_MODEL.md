# Locked ordering model — current implementation

## 0. Invariant

products.price is the price of one selling unit. Money is packs × price. Packs
are integers; piece counts are input/display converted before money arithmetic.
quantity_in_unit is pack size, moq counts packs, order_unit controls customer
counting, order_step is pieces per allowed step. Never add another pack_size.
This is independent of the admin per-piece price-entry toggle.

The original full design spec is preserved in archive. Its 'application code
not built', naive box pluralization and old helper/test names are superseded.
Numbered section references in older code comments refer to that historical spec.

## Implementation and code evidence

`client/src/lib/orderingModel.ts` owns branded Packs, asPacks, resolveOrderSpec,
specFromSnapshot, piece/pack conversion, snapping, steppers, initialPacks,
lineTotal, derived per-piece rate and quantity/chip copy. priceEntryMode owns the
existing usable-divisor and admin price-entry conversion helpers it reuses.
CartStore owns persisted snapshots/cartTotals. orderMessage builds the shared
quantity phrases and guest/authenticated WhatsApp messages; orderService is the
query/write boundary. ProductCard, PDP, Cart and QuantityStepper reuse this model.

resolveOrderSpec uses a usable pack size greater than one for pcs mode. Missing,
zero, one or invalid sizes degrade to pack mode. Invalid/non-multiple steps fall
back to one pack. Missing/invalid MOQ resolves to one pack. minPcs rounds the
MOQ floor up to a whole step. asPacks floors/clamps; packsFromPcs rounds up;
snapPcsToStep rounds to the nearest step (positive ties up), then MOQ, preserving
zero for line removal. Selling-unit piece words such as pcs fall back to pack;
box pluralizes as boxes. Derived per-piece rates never become stored money.

initialPacks uses the effective MOQ rounded up to a whole step. Both pack and
piece steppers move by that step; an old off-step cart moves to the next valid
quantity in the chosen direction. Cart add/set operations use the same helpers.
Persisted invalid quantities are flagged and blocked before enquiry/checkout
until the customer adjusts them; carts are not discarded or silently rewritten.

## Checkout and privacy

Only authenticated customers query current published+active prices. Changed
rates update the cart and ask for a second explicit confirmation; no write or
WhatsApp occurs on the first review. The protected confirmed endpoint checks
expected prices, current availability/MOQ/step and configured minimum while
locking product rows and writing header/lines atomically. Never auto-retry.
Legacy RPC and customer direct table writes cannot bypass it. All-enquiry orders
retain the existing minimum exemption; no new business rule is introduced.

Guests have sign-in plus quantity-only cart enquiry. prepareGuestCart never calls
Supabase and buildGuestCartMessage never includes prices/totals, even from stale
persisted prices. The enquiry preserves the cart and creates no database order.
Guest catalogue/PDP reads must use explicit columns; no price sorting or rate
leakage. Auth state invalidates the service's session-sensitive column cache.

## Admin/import constraints

Account history is scoped to the verified signed-in user and existing RLS.
Reorder reads fresh published+active products and rounds saved selling-unit
counts up to current MOQ/steps inside orderingModel. It merges fresh snapshots
into the cart while retaining unrelated lines. Any unavailable item blocks the
entire reorder without changing the cart. This is cart preparation only; current
rate review and explicit protected checkout remain required. Historical unowned
orders are not assigned automatically.

Both editors use the shared Customer Ordering section: order unit, a read-only
pack-size mirror, MOQ in packs and order step in pieces. The existing Qty / pack
field edits quantity_in_unit. Shared save validation rejects pcs without a usable
pack size, fractional/nonpositive inputs and steps that are not whole pack-size
multiples. Blank overrides persist as null; the selling-unit price is unchanged.
The effective minimum is shown when MOQ needs rounding up to a step. Customer
ordering is separate from priceEntryMode. CSV, XLS, XLSX and Google Sheets use
the same numeric/ordering validator. The template includes order_unit and
order_step; unit (or unit_of_measure) names the selling unit. MOQ counts packs
and order_step counts pieces. Existing SKU blank ordering fields/pack size are
preserved; new rows use pack/size-step defaults. Invalid combined settings are
reported in dry-run and rejected before product writes. Clear a custom step in
the Ordering editor. New imported products remain drafts; existing blank status
preserves publication. The template examples must be replaced before import.
Never invent or automatically reconcile the 11 Hinged Box price conflicts.

## Verification

`npm test` exercises orderingModel, price entry, cart/message parity and services.
`npm run test:orders` and `test:price-reconfirmation` verify server semantics on
synthetic disposable schemas. `npm run ci` also runs authorization, TypeScript,
guardrails and build/PWA. Full restored-schema concurrency/rollback evidence is
in reports; hosted Auth/PostgREST checkout and fixtures are different test scopes.
Actual applied migration names and operations belong in CHANGELOG_SQL.md.
