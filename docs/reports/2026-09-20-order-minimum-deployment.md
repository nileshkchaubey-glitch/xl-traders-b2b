# Server minimum-order enforcement: deployment review

Status: merged in #191 and **applied and verified in production on 2 October**.
Installed migration: `20261002045031_enforce_minimum_order_value`. #193 was applied
afterward and now restricts customers to the confirmed endpoint. See the actual
operations and runtime verification in [SQL Changelog](../CHANGELOG_SQL.md).

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

Additional validation completed on a disposable native PostgreSQL 17.11 restore:
47 checks passed, including the complete captured public application schema,
Auth dependencies, 41 role assertions before and after, actual concurrent price
updates, atomic writes, idempotence and exact predecessor rollback. Production
runs PostgreSQL 17.6; hosted Auth/PostgREST services are outside that local test.
On 2 October, all captured relations/functions/ACLs/default privileges were
compared with live production again and matched. No customer rows were copied.

## Deployment

The owner's 2 October authorization permits reviewed migrations after validation.
This file was applied after validation; the current status is recorded in
`docs/CHANGELOG_SQL.md`. The live minimum is enabled at ₹2,000.

1. Compare the live function definition and schema against the original
   `20260919123000_atomic_order_creation.sql`. Save the current function definition
   and execute grants before proceeding; stop if another migration has changed it.
2. On a disposable database with the production schema, run the original/new
   migrations and representative role/order tests. Verify `site_content.key` is
   unique and the enabled/value settings are JSON boolean/number as written by
   `AdminSiteContent`. Record the effective minimum without changing it.
3. After validation, apply only
   `supabase/migrations/20260920042455_enforce_minimum_order_value.sql` using the
   normal migration workflow. No frontend deployment or environment changes are
   needed to activate the server check.
4. Verify the installed definition/grants and migration history. Any production
   order test must roll back or use synthetic fixtures with safe cleanup; do not
   create real orders merely to smoke-test this migration.

## Rollback

Restore the saved previous `place_order_from_cart(text,text,jsonb)` definition and
its execute grants through a new rollback migration. If the preflight confirms
the checked-in original is exactly the predecessor, its function definition and
grant statements can supply the rollback. Do not remove authorization policies
or re-enable customer direct inserts. Retain migration history and test rollback
on staging first. Rollback reopens the known minimum-order bypass and must be an
explicit operational decision. Reverting the Git commit alone does not undo SQL
already deployed.

## Dependent checkout protection

The owner selected customer reconfirmation. PR #193 adds the reviewed-price
endpoint and holds product locks through validation and writes. Apply this
minimum migration before that migration. Never reapply it after #193: its grant
would reopen the legacy customer endpoint. See the reconfirmation validation
report for coordinated deployment and rollback.
