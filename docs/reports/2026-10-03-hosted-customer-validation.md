# Hosted customer validation — 3 October 2026

This supersedes the customer-login, Storage-access and file-permission limits in
the [2 October report](2026-10-02-hosted-file-validation.md).
Owner confirmed Chrome file-URL permission OFF; browser policy prevents independent
inspection of that internal setting. No credentials extracted or account created.

## Actual hosted checks

The approved primary-site customer has an active, non-admin database profile.
Its cart/history were initially empty. One existing published/active, non-Hinged
product was used; no catalogue data or business price changed.

| Check | Actual result |
| --- | --- |
| Customer pricing / PDP / cart | Working: selling-unit rate, one pack of 1,000 pieces, MOQ and step agree. Desktop 1489×623 and mobile 391×844 had no horizontal overflow. |
| Checkout | Working: one click created one disposable header/item. Current orderService uses the protected price-confirmed RPC; SQL verified ownership, quantity and total. No network trace claimed. |
| WhatsApp handoff | Working: actual Share on WhatsApp page held the expected order draft. No Open app, Continue or Send action; no payment or fulfilment. |
| Positive own-user history | Working desktop/mobile: only the customer's single test order appeared with the correct saved item/total. Original unowned orders were not displayed. |
| Reorder | Working mobile: prepared one cart line with current pack/price/MOQ/step. Desktop inspection confirmed it. No additional order was created. |
| Order/cart cleanup | Working: full rows saved, current FKs inspected, strict transactional removal of only the test header/item. Original two orders/items remain; customer history/cart empty, synthetic customer inputs blank again. |
| Customer admin access | Broken on predecessor: dashboard stayed loading. Fixed in [#217](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/217); deployed dashboard desktop and editor mobile redirect the approved customer to Home. |
| Guest authorization/privacy | Working on exact #217 Pages: /admin redirects to /auth; PDP shows Sign in for rates without currency. Actual WhatsApp enquiry draft contains no protected price. No message/order created. This was PDP enquiry, not a newly seeded hosted guest cart. |

Checkout/history/reorder ran on main 649c58cc457313491c942a22711ed8d786a06778.
The guard fix then merged at 4a9c1903c5797c599742cbbd55ef972644018eb6; its
[main CI 37108527699](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/actions/runs/37108527699)
and exact [Pages 7bc1f42a](https://7bc1f42a.xl-traders-b2b.pages.dev) passed.
All 34 primary-site JS hashes match that deployment. Both known-format private-key,
service-role JWT, direct Anthropic and private-VITE scans were negative.
Pattern scans do not detect every possible secret format. Live settings/import-log
write policies still require is_admin(); profile privilege trigger remains installed.
Confirmed-price RPC EXECUTE is false for anon / true for authenticated; legacy
cart RPC EXECUTE is false for both roles.

Final read-only history reconciliation matches all four repository migration names
to installed history. No unapplied repository migration remains and none was applied
today. The earlier order migrations are
20260920042455_enforce_minimum_order_value.sql (installed 20261002045031) and
20260923165549_require_cart_price_reconfirmation.sql (installed 20261002045327).

## Production operations

Only test order c03ee632-b836-4917-931f-a4e4b8ccb1b5 and its single item
a5dd7955-90c2-47d2-aab4-7a1d142f722e were removed by guarded SQL.
Full predecessor rows/command are saved locally; [SQL log](../CHANGELOG_SQL.md)
records the executed transaction. Counts remain 143 products / 139 public,
two original orders / two items. Customer remains non-admin; anon price and
health-view SELECT grants remain false.

A distinct banner d5a032db-5c75-4338-86f5-fb95968d9489 was newly created outside
this test and publicly active with synthetic validation text. It was not yesterday's
deleted fixture. Owner explicitly approved hiding it. Full row preserved and exact
ID/content/timestamps verified before setting only is_active=false. Its content,
image and timestamps remain; refreshed Home no longer shows it. Actual SQL and
rollback information are logged. No real banner, catalogue or profile was deleted.

Owner confirmed permanent deletion of the two remaining test WebPs at action time.
Normal dashboard Storage deletion removed IDs 203344a5-acf3-4836-b54e-83fc478985af
and 3353ed23-80f2-4291-a79e-711fda6febef. The original PNG was already observed
absent outside agent deletion. All three exact original object records are gone;
each public URL returned HTTP 400 with Object not found / statusCode 404 / NoSuchKey.
Supabase automatically retained a zero-byte .emptyFolderPlaceholder, not image
data. It was left intact; the bucket and owner-created global images are preserved.
All three local recovery copies retain verified original SHA-256 hashes.
No SQL Storage metadata deletion, bucket deletion or new backend was used.

## Tests and practical limits

Pinned Node 20.20.2 and npm run ci passed for #217: 297 application tests,
41 authorization assertions, 12 minimum-order and 13 reconfirmation checks,
storefront guardrails, TypeScript and production/PWA build. Ten guard tests cover
both pages, pending profiles, guests/customers, stale flags, allowed admins and
revocation. They failed against the predecessor. All 25 protected screenshots
match original Git blobs. A mobile history screenshot capture timed out; actual
mobile DOM/history/reorder passed. QA screenshots/raw rows stay outside Git.

Clean npm ci installed 490 packages from the unchanged npm lockfile. Runtime
npm audit --omit=dev reports zero vulnerabilities; all-dependency audit reports
nine development findings (one low, three moderate, five high), previously recorded.
The first clean-install full CI attempt had two 15-second local PGlite test timeouts
and 295 passing application tests. Both isolated rechecks passed under unchanged
limits (6.4/6.6 seconds); the full unchanged suite then passed all 297 tests and
remaining CI stages. No timeout, assertion or guardrail was weakened. Relative
documentation checks passed 68 links; screenshot hashes and recovery-copy hashes
passed. Final PR/main/deployment results are recorded in the PR after observation.

Prior actual hosted CSV/XLS/XLSX writes, original/WebP upload/hash/dimensions,
admin draft editing/settings reads/theme/banner controls, real keyboard Tab focus,
PWA/deep links/offline privacy and clear-storage/reinstall checks remain in October 2
reports. They are separate dated evidence, not rerun today. Checkout was not repeated
merely to create another production test order after the unrelated guard fix.

Not tested: physical mobile SW clear-storage/reinstall (no hardware), independent
provider-console revocation/activity (owner-confirmed), real contact settings writes
(preserve contacts), live price change during checkout (preserve business pricing),
actual WhatsApp sending/fulfilment/payment (outside scope). Guest cart quantities-only/
zero-order behavior has earlier browser fixtures and current regression tests;
today's unseeded hosted guest test used PDP enquiry.

Owner work: actual catalogue photos/descriptions/SEO and the 11 Hinged Box pricing
conflicts. No business facts invented, draft published, sentinel removed, paid
service introduced or new migration applied. Earlier reviewed migration filenames
and actual installation history remain in the SQL log. Exact evidence-only PR/main
CI and final deployment are recorded in that PR after observation.
