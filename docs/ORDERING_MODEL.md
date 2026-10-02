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

The current initialPacks/pack stepper still need multi-pack-step alignment before
the new admin controls expose custom steps. This verified code/SQL mismatch is
tracked in launch status; do not claim that every custom step is already valid.

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

The approved Ordering section must show order unit, the read-only pack-size
mirror, MOQ and order step. Reject pcs without usable pack size; warn/reject
invalid multiples. Do not confuse customer ordering with priceEntryMode.
Template ordering fields and controls are still pending at this record; existing
CSV/Excel importer mappings are not evidence of a complete template workflow.
Never invent or automatically reconcile the 11 Hinged Box price conflicts.

## Verification

`npm test` exercises orderingModel, price entry, cart/message parity and services.
`npm run test:orders` and `test:price-reconfirmation` verify server semantics on
synthetic disposable schemas. `npm run ci` also runs authorization, TypeScript,
guardrails and build/PWA. Full restored-schema concurrency/rollback evidence is
in reports; hosted Auth/PostgREST checkout and fixtures are different test scopes.
Actual applied migration names and operations belong in CHANGELOG_SQL.md.
