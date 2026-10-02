# Admin customer-ordering controls and step alignment

Verified before change: both editors omitted order_unit/order_step from their
forms/save payloads. initialPacks returned raw MOQ; pack stepping and repeated
cart adds used one pack even when the server required a larger step. Two planted
regression tests failed (MOQ 2 packs, size 100, step 300 produced 2 instead of 3).
Production aggregate inspection found 143 products, no pieces-mode products,
no multi-pack custom steps and ten MOQ values above one. No catalogue row changed.

Both editors now share Customer Ordering controls and productToForm/save mapping.
Pack size is a read-only mirror of quantity_in_unit; MOQ remains packs, step
remains pieces and products.price remains selling-unit price. Shared validation
blocks unsupported sizes/units/fractional inputs and invalid multiples before
any category lookup or write. Blank settings persist as null; new products remain
drafts. No duplicate pack_size or database migration is introduced.

orderingModel now owns effective minimum, pack/piece steps, pack snapping and
quantity validity. Cart adds/sets/totals reuse it. Old off-step persisted lines
are explicitly flagged and checkout/enquiry is blocked until adjusted; the
existing storage version is retained and customer carts are preserved. Guest
enquiries still do not query prices or create orders. Server protections and
minimum/reconfirmation behavior are unchanged.

Validation: Node 20.20.2 npm run ci passed, including 197 application tests,
41 authorization, 12 minimum-order and 13 reconfirmation assertions, TypeScript,
storefront checks and production build/PWA. Initial cart test failures were a
Node test-storage harness issue (Zustand uses window.localStorage); the harness
was corrected without changing runtime storage or weakening assertions.

Real Chrome component checks use the actual route editor, catalogue drawer and
shared stepper at 390×844 and 1440×900. Synthetic service responses prevent hosted
writes. Each editor loads existing settings, shows a read-only mirror, rejects
step 150 for size 100, saves step 300/pcs/MOQ 2 with price 150 unchanged. Both
stepper modes climb and descend valid steps and reach removal. Hosted admin
editing is NOT TESTED because available test Auth access is invalid. Fixture
checks are not production login/bucket verification.

Deployment: normal Pages release after required GitHub checks; verify immutable
deployment and guest cart on main. Rollback: revert this code PR; no SQL/data
rollback is needed. Do not enable custom ordering configurations on the earlier
client until reapplying the fix. No production operation except aggregate read SQL.
