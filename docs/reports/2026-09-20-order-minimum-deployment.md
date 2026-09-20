# Server minimum-order enforcement: deployment review

Status: prepared and tested locally; **not applied to production**.

## Verified defect and scope

`client/src/pages/Cart.tsx` checks the configured `site_content` minimum, but
`place_order_from_cart` in the original atomic-order migration does not. Calling
that RPC bypasses the browser check. An ephemeral PostgreSQL test reproduced a
stored total of 125 with `min_order_enabled=true` and `min_order_value=1000`.

The new migration checks the inserted header's database-derived total before
inserting lines. A failure raises an exception, rolling back the header as well.
It changes no configuration values or RPC signature. The existing storefront
rules remain: priced/mixed orders must reach the configured minimum; all-enquiry
orders are exempt; absent settings default to disabled/zero. Authenticated admins
use the same RPC rule as customers; this does not change direct admin order editing.

## Validation

Run `npm run test:orders`, also included in `npm run ci` and GitHub CI. It uses
PGlite with a minimal synthetic schema, no URL, credentials, persistent database,
or network. The original migration first reproduces the bypass; the new migration
is then applied twice. Checks cover rejection without orphan rows, spoofed prices,
mixed/enquiry carts, threshold boundaries, disabled/zero/missing settings, and
anonymous RPC denial. Accepted headers and line totals are compared.

This fixture does not prove compatibility with every production trigger, policy,
or migration. Full-schema staging verification remains a deployment prerequisite.
No real order has been submitted for this test.

## Deployment (owner approval required)

1. Compare the live function definition and schema against the original
   `20260919123000_atomic_order_creation.sql`. Save the current function definition
   and execute grants before proceeding; stop if another migration has changed it.
2. On a disposable database with the production schema, run the original/new
   migrations and representative role/order tests. Verify `site_content.key` is
   unique and the enabled/value settings are JSON boolean/number as written by
   `AdminSiteContent`. Record the effective minimum without changing it.
3. After explicit owner approval, apply only
   `supabase/migrations/20260920042455_enforce_minimum_order_value.sql` using the
   normal migration workflow. No frontend deployment or environment changes are
   needed to activate the server check.
4. Verify the installed definition/grants and migration history. Any production
   order test needs a separately approved test/cleanup plan; do not create real
   orders merely to smoke-test this migration.

## Rollback (owner approval required)

Restore the saved previous `place_order_from_cart(text,text,jsonb)` definition and
its execute grants through a new rollback migration. If the preflight confirms
the checked-in original is exactly the predecessor, its function definition and
grant statements can supply the rollback. Do not remove authorization policies
or re-enable customer direct inserts. Retain migration history and test rollback
on staging first. Rollback reopens the known minimum-order bypass and must be an
explicit operational decision. Reverting the Git commit alone does not undo SQL
already deployed.

## Separate unresolved checkout issues

This focused migration does not decide how customers should confirm changed
prices. The RPC uses current database prices, while `Cart.handlePlaceOrder` builds
the WhatsApp message from stored cart prices. Customer confirmation versus
automatic repricing remains an owner decision. The existing RPC also reads
products more than once; concurrent product updates are not covered by this
single-connection fixture. These limits prevent a claim of complete checkout
readiness.
