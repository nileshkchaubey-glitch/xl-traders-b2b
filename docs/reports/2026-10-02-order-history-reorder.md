# User-scoped order history and reorder

Verified defect: Account rendered a coming-soon history paragraph. The existing
production orders/user_id and order_items/order_id schema is compatible. Live
inspection on 2 October found two orders/two items; both order headers have null
user_id. They are preserved, unassigned and remain admin-only under current RLS.
No historical customer identity is inferred or customer data copied into reports.

Account now loads its verified Auth user's history with explicit selected fields,
an explicit user_id filter, newest-first stable ordering and 50-row pagination.
The existing customer-own/admin policies also gate nested items. Load errors are
visible and retryable. Guest/sign-out/account-switch rendering immediately hides
history; in-flight old-user results cannot refill the cart after sign-out.

Reorder re-reads the owned order and current published+active products. Historical
prices/names/order snapshots are not used to price the new cart. The shared
orderingModel rounds saved selling-unit counts up to current MOQ/whole steps;
current pack sizes determine display. Matching cart lines are merged at fresh
rates/rules, unrelated lines/customer details preserved. The entire operation is
atomic in the cart: an unavailable/inaccessible saved product or invalid quantity
leaves it unchanged with an error. No partial silent reorder or DB order write.
The UI explains current rates/rules and separate review/confirmation. Existing
checkout still refreshes prices, explicitly reconfirms changes and calls only
the protected atomic RPC. No new price, minimum, availability or ordering policy.

Verification on Node 20.20.2:

- Focused service/cart tests: 21 passed, including identity mismatch, denied
  reads, owned-order filtering, current publication gates/rates, unavailable
  lines, invalid historical quantities, step/MOQ and atomic cart preservation.
- Disposable in-memory PostgreSQL: 13 assertions in one scenario with the
  inspected relevant live policies. Anonymous reads see zero orders/items;
  customers each see only their own header/items and cannot insert; admins see
  all including unowned legacy orders. No external URL/customer rows/network.
- npm run ci: 270 application tests plus existing 41 authorization, 12 minimum
  and 13 reconfirmation assertions; TypeScript, guardrails, build/PWA passed.
- Actual Chrome at 390×844 and 1440×900, real Account/Cart/service components
  with synthetic Auth/PostgREST responses: history pagination, read-failure retry,
  logout privacy and pending-reorder race, unavailable-product atomicity and
  fresh cart merge passed. Reorder made zero order writes/WhatsApp calls. A later
  price change needed a second explicit click; only then was one confirmed RPC
  and one intercepted WhatsApp invocation recorded. No actual message, hosted
  write, page error or overflow. Summary tiles remain unset; history shows the
  actual loaded/total order count, without inventing saved-list/spend statistics.

Hosted customer history/positive checkout remains NOT TESTED without valid test
access; Chrome viewports are not physical mobile hardware. Production inspection
was metadata/policies/aggregate counts only. No SQL, grants, data, Auth accounts
or migration changed. Customer-owned positive orders are synthetic fixtures.

Deployment: code-only build after required checks pass. Verify exact main CI and
Pages guest/account/cart behavior. Rollback: revert this focused code commit;
preserve all order/customer/catalogue data and existing RLS. History and reorder
remain read-only services; cart changes use the existing persistence version.
