# Customer price reconfirmation — validation and deployment

The owner selected customer reconfirmation on 23 September. This change is
merged in #193, applied and verified on 2 October as
`20261002045327_require_cart_price_reconfirmation`. The owner's instructions authorize
reviewed production migrations and safe merges. Actual application status is
recorded in `docs/CHANGELOG_SQL.md`; approval is not evidence of deployment.

Post-deployment definitions, owners, search paths and execute grants matched the
reviewed SQL. Six rolled-back production denial/validation assertions passed;
no real data was written. Main CI and the immutable Cloudflare deployment
`https://4866f65a.xl-traders-b2b.pages.dev` passed mobile/desktop guest catalogue/PDP
checks. Hosted authenticated browser checkout was not tested because the available
Auth admin credential failed; no account was created. Positive order behavior was
validated on disposable staging and the isolated browser fixture described below.

## Behavior

Checkout reads fresh published/active product prices with the customer's own
permissions. A price change updates the cart, displays before/after rates, and
stops without creating an order or opening WhatsApp. The customer must click
again. Changes in either direction and transitions to/from enquiry need review.

The new `place_order_from_confirmed_cart(text,text,jsonb)` endpoint requires an
`expected_price` for every line. It locks product rows in ID order through the
existing minimum/MOQ/step validation and header/line writes. A changed price
raises `CART_PRICE_CHANGED` without writes; the UI refreshes and asks again,
never automatically retries. Errors keep the cart. The WhatsApp message uses
the same reviewed price snapshot accepted by the database.

The old endpoint is revoked from customer/anonymous/public roles, preventing
legacy clients from bypassing confirmation. An old client must reload after
deployment. The new frontend fails closed if its new endpoint is not deployed.

## Evidence and limits

- Full local CI passed after main synchronization: 160 application tests, 41 authorization assertions,
  12 minimum-order checks, 13 reconfirmation checks, TypeScript, storefront
  guardrails, production build and PWA generation.
- A temporary local fixture exercised the real Cart component with synthetic
  auth, prices and order submission at mobile (requested 390x844; DOM width 391)
  and desktop (1440x900). Initial change and simulated database-race rejection
  both retained the cart with zero saved orders/WhatsApp opens; the subsequent
  explicit confirmation saved once at the reviewed price. No horizontal overflow
  or console errors were observed. WhatsApp opening was intercepted. The fixture
  was removed before commit; no real user, order or message was involved.
- Pure price-review and service tests cover changes, unavailable products,
  expected-price payloads, no automatic retry, and a missing new endpoint.
- `npm run test:price-reconfirmation` restores the existing minimal fixture in
  a free disposable in-memory PostgreSQL engine and applies the migration twice.
  It tests stale/missing/malformed prices, enquiry transitions, minimum-order
  inheritance, unpublished products, anonymous denial, legacy endpoint denial,
  and consistent accepted header/line totals.
- A native, free disposable PostgreSQL restore was validated again on 2 October:
  **47 checks passed**. It restores all 15 public tables, both public views,
  auth.users and four Auth helpers, including columns, constraints, indexes,
  triggers, 35 application policies, owners, grants and captured default ACLs.
  Live production metadata was compared again and matched that snapshot.
- Role tests passed **41 assertions before and 41 after** migration/rollback.
  Minimum/MOQ/step, malformed input, published/active gates, anonymous denial,
  legacy denial, exact decimal totals and forced line-write rollback passed.
- Actual independent sessions prove both race directions: an earlier price
  writer makes a waiting order reject without rows; an order holding product
  locks makes a later writer wait through consistent header/line insertion.
- Both migrations were applied twice in sequence, the exact saved predecessor
  function/grants were restored, and both were reapplied. The synthetic committed
  order survived rollback/reapply. No customer/product/order rows were copied.
- Local PostgreSQL is Windows 17.11 with locale C; production is Linux 17.6.
  The complete public application schema and required Auth definitions were
  restored. Hosted Supabase Auth, PostgREST, Storage and internal platform schemas
  are outside this test; it is not a hosted Supabase clone.
- Reproduction: `python scripts/validate-order-staging.py --snapshot-dir
  tmp/launch-validation-20260924`. Requires the prepared empty localhost database
  `xl_launch_staging` on 127.0.0.1:55437, captured schema/settings and psycopg 3.
  The script has no remote URL/host option and verifies the local target first.
  Saved evidence is ignored by Git; the schema snapshot SHA256 is
  `17bbb8079c366d2b8cd58af2b2e06c6692939028185523d468be76b4a951f5e7`.

## Deployment sequence

1. Obtain an approved current schema-only export and save the installed function
   definitions, owners and grants. Restore on a free disposable local database
   with matching dependencies and seed synthetic users/products/settings only.
2. Validate the #191 minimum-order migration followed by this migration twice,
   role access, real concurrent price changes, header/line atomicity, frontend
   confirmation, and rollback against that schema. Compare the predecessor
   definitions to the reviewed migrations; stop on drift.
3. Verify the current live predecessor and migration history once more immediately
   before applying. The owner's 2 October authorization covers this operation.
4. Apply #191 first, then `20260923165549_require_cart_price_reconfirmation.sql`.
   Deploy this frontend immediately after the functions/grants are verified.
   Do not apply #191 again after this migration: it grants the legacy endpoint.
5. Check installed definitions/grants, role denials and migration history. Test
   requests must roll back or target synthetic fixtures; never send real customer
   messages or delete customer/catalogue/order data for deployment verification.

## Rollback

Keep the saved predecessor definitions and grants. A coordinated, approved
rollback restores the previous frontend and its legacy RPC execute grant via a
new migration; revoke/drop the new endpoint only after clients are switched.
That rollback reopens the price-confirmation bypass. Reverting Git alone does
not undo SQL, and restoring an earlier function must not reopen direct table
inserts or remove the authorization fixes. Test this sequence on staging first.

The exact predecessor is saved in
`tmp/launch-validation-20260924/rollback-order-functions.sql` (SHA256
`cd74d073367336cd12e460af5cbed9bfd495f5c265d04c73f9c2d0790772f56d`).
This rollback was actually rehearsed on the disposable restore. Keep it and the
schema snapshot before any production modification; neither contains customer rows.
