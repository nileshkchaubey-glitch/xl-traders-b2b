# Customer price reconfirmation — validation and deployment hold

The owner selected customer reconfirmation on 23 September. This change is
prepared for review, **not approved for production migration or launch**.

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

- Full local CI passed: 157 application tests, 41 authorization assertions,
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
- This fixture is **not** a current production-schema export. It does not prove
  compatibility with production triggers, all policies, extensions, or real
  concurrent sessions. Full-schema and concurrent-session validation remain open.
- Production schema SQL reads were rejected by automatic approval review under
  the prior SQL prohibition. The owner then explicitly chose to keep all
  production SQL blocked. No production query or migration was executed.
- An existing current schema-only export is needed to continue full validation.
  Do not substitute historical SQL or inferred metadata, bypass the access
  restriction, copy customer data, or create paid staging infrastructure.

## Deployment sequence — only after full validation and final approval

1. Obtain an approved current schema-only export and save the installed function
   definitions, owners and grants. Restore on a free disposable local database
   with matching dependencies and seed synthetic users/products/settings only.
2. Validate the #191 minimum-order migration followed by this migration twice,
   role access, real concurrent price changes, header/line atomicity, frontend
   confirmation, and rollback against that schema. Compare the predecessor
   definitions to the reviewed migrations; stop on drift.
3. Present actual results and request final production migration approval.
4. Apply #191 first, then `20260923165549_require_cart_price_reconfirmation.sql`.
   Deploy this frontend immediately after the functions/grants are verified.
   Do not apply #191 again after this migration: it grants the legacy endpoint.
5. Check installed definitions/grants and migration history. Do not create real
   orders or send customer messages as a deployment test without authorization.

## Rollback

Keep the saved predecessor definitions and grants. A coordinated, approved
rollback restores the previous frontend and its legacy RPC execute grant via a
new migration; revoke/drop the new endpoint only after clients are switched.
That rollback reopens the price-confirmation bypass. Reverting Git alone does
not undo SQL, and restoring an earlier function must not reopen direct table
inserts or remove the authorization fixes. Test this sequence on staging first.
