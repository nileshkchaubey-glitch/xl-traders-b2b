# Final launch implementation and validation — 2 October 2026

All authorized code work is merged through runtime main
`8050f1845a5c8e14afe13b56b300329861040cac` (#213). Main CI
[36993399268](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/actions/runs/36993399268)
passed. Its exact [Pages deployment](https://b3a7ead1.xl-traders-b2b.pages.dev)
passed mobile/desktop public checks. This final documentation PR records results
and corrects surviving stale claims; it changes no runtime, SQL or dependencies.
The eventual documentation merge SHA/checks must also be verified before sign-off.

Follow-up: #214 merged at `ac8f16149629191d6b6e240bbda5604a24315cba`, main CI
36994836552 and exact Pages 12be5c57 passed; public, guest, SW and all-chunk scans
also passed on that deployment. An existing authorized Chrome admin session then
enabled actual hosted checks; see [the follow-up](2026-10-02-hosted-admin-validation.md).
The table below preserves the earlier checkpoint; its hosted NOT TESTED entries
are superseded only by explicitly observed follow-up results.

No verified code launch blocker remains from the approved list. Full launch
sign-off remains PARTIAL: customer checkout/history and hosted import/upload
remain untested, real mobile hardware is unavailable and actual catalogue
content/pricing decisions belong to the owner. These are not passing tests.

## Reconciliation and completed work

The complete per-item initial Block B/C/D disposition is preserved in the
[Phase 0 snapshot](2026-10-02-launch-reconciliation.md). Current completion:

| Item                                        | Final disposition / merged evidence                                                                                                                                                                                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing server minimum/reconfirmation work | DONE: [#191](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/191), [#193](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/193); current schema staging, production apply and rollback evidence in SQL changelog                       |
| Preserve existing work/screenshots          | DONE: [#195](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/195); all 25 Git blobs match original; attachment/local work kept                                                                                                                     |
| Phase 1 guest WhatsApp                      | DONE: [#196](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/196); both actions, quantity-only message, zero order writes                                                                                                                          |
| Phase 1 SQL log                             | DONE: [#197](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/197); actual applied state, not historical prepared status                                                                                                                            |
| Phase 1 admin profile conflict              | DONE: [#198](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/198); database admin truth, safe customer creation, controlled provisioning instructions                                                                                              |
| B PR-1 archive rescue                       | DONE before this run: #181; retained                                                                                                                                                                                                                            |
| B PR-2 UI/CSS/breadcrumbs/drawers           | DONE: [#199](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/199); 32 individually unused primitives removed, dialogs retained, actual Tab/Shift+Tab/Escape/focus checks; two dead CSS rules already removed by #182                               |
| B PR-3 dependencies                         | DONE: [#200](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/200); re-analysis after UI, 21 runtime/three dev declarations removed; original eight already removed by #182; current owner authority superseded old dev hold                        |
| B PR-4 dead exports/features                | DONE: [#201](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/201); verified dead exports removed; entire daily-widget removal and TEMPLATE_COLUMNS removal SUPERSEDED by live consumers                                                            |
| B PR-5 branches                             | DONE safely: [#202](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/202); 126 proven merged/stale remote refs removed with recovery bundle; 30 unverified branches kept; rate-card branch and backup tag retained                                  |
| C inventory/archive/current docs            | DONE: [#203](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/203); inventory first; ten full guides archived; CLAUDE 5,868 bytes, AGENTS 2,555 bytes; final docs update corrects later changes                                                     |
| D 5.1 admin Ordering                        | DONE implementation: [#204](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/204); shared model/controls/validation, no duplicated arithmetic; hosted write NOT TESTED                                                                              |
| D 5.2 images                                | DONE implementation: [#205](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/205); original plus actual-size WebP siblings, five upload paths, safe new-object failure cleanup; hosted upload NOT TESTED                                            |
| D 5.3 CSV/Excel/Sheets ordering             | DONE implementation: [#206](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/206); real XLS/XLSX compatibility/templates, shared ordering validation, preserved SKU fields/new drafts; hosted write NOT TESTED                                      |
| D 5.4 banners/theme                         | DONE implementation: [#207](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/207); existing schema/service/slots, inactive defaults, validated scheduling and five existing themes; hosted write NOT TESTED                                         |
| D 5.5 search index                          | DONE existing implementation verified: [#208](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/208); ready/valid pg_trgm GIN, measured plans/current search, no duplicate migration                                                                 |
| D 5.6 route splitting                       | DONE: [#209](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/209); cold Home foreground JS 827,330→636,544 bytes in the same measurement environment; precache policy retained, no claim of admin assets excluded from background cache            |
| D 5.7 history/reorder                       | DONE implementation: [#210](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/210); own-user pagination, fresh current-rule atomic cart merge, explicit price reconfirmation; two legacy unowned orders preserved; hosted positive access NOT TESTED |
| Private browser AI exposure                 | DONE code containment: [#211](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/211); local-only Smart Paste/manual editing, provider key/generation removed and checker strengthened; owner confirmed revocation/settings removal                   |
| Settings single/maybeSingle                 | Historical request SUPERSEDED; actual schema mismatch fixed in [#212](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/212); verified changed-key writes, no false local success; hosted save NOT TESTED                                            |
| Final public PDP active gate regression     | DONE: [#213](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/pull/213); reproduced before fix; admin storefront also respects activation while editor keeps draft access                                                                                |
| Service worker                              | Practical automated checks DONE; physical-device clear-storage test NOT TESTED                                                                                                                                                                                  |

All runtime PRs were self-reviewed, required CI passed before authorized merge,
review threads were inspected, and main/Pages checked afterward. CodeRabbit
skipped automatic review for this public repository; no independent approval was
claimed or submitted. Remaining unverified branches are intentional preservation,
not unfinished deletions. No paid services or infrastructure were introduced.

## Actual final checks

Node **20.20.2**, npm lockfile only:

```sh
git fetch --all --prune
git pull --ff-only
git status --short
git rev-parse HEAD
gh pr list --state all --limit 40
gh run view 36993399268 --json status,conclusion,headSha
npm ci
npm run ci
npm audit --json
npm audit --omit=dev --json
python tmp/launch-20261002/verify-screenshots.py
python tmp/launch-20261002/check-final-doc-links.py
python scripts/validate-order-staging.py --snapshot-dir tmp/launch-validation-20260924
```

Clean install: first attempt failed Windows EPERM on the task-owned Vite CSS
module; stopping those servers released the lock. Retry installed **490 packages**
and full CI passed: TypeScript, all 18 storefront rules, **287 application tests**,
**41 authorization assertions**, **12 minimum-order checks**, **13 price
reconfirmation checks**, production build and PWA generation (59 precache entries).
The earlier planted freight violation and later private-VITE-key violation both
failed the checker as intended; probes were removed and legitimate code passed.
Large-chunk/deprecation warnings remain visible, not suppressed.

Runtime dependency audit: **zero vulnerabilities**. Full development-tool audit:
**nine** (one low, three moderate, five high), retained in ignored JSON evidence.
Findings affect Vitest/mocker, esbuild, PostCSS/nanoid, Browserslist/baseline mapping,
brace-expansion and fast-uri in the build/test tree. They require development
servers or untrusted build inputs; no public production execution path was
verified in the static deployment. Toolchain security maintenance remains
separate work; no automatic major upgrade or weakened audit claim is made.

Actual Chrome at **390×844** and **1440×900**:

```sh
node tmp/launch-20261002/sheet-focus.mjs --strict
node tmp/launch-20261002/import-browser.mjs
node tmp/launch-20261002/image-browser.mjs
node tmp/launch-20261002/history-browser.mjs
node tmp/launch-20261002/pdp-visibility-browser.mjs
node tmp/launch-20261002/browser-smoke.mjs https://b3a7ead1.xl-traders-b2b.pages.dev
node tmp/launch-20261002/guest-browser.mjs https://b3a7ead1.xl-traders-b2b.pages.dev
node tmp/launch-20261002/pwa-browser.mjs https://b3a7ead1.xl-traders-b2b.pages.dev tmp/launch-20261002/pwa-final-runtime.json
node tmp/launch-20261002/bundle-security-scan.mjs https://b3a7ead1.xl-traders-b2b.pages.dev tmp/launch-20261002/secrets-final-runtime.json
```

Public hosted catalogue/PDP passed with 48 rendered links, explicit non-price
columns, no page errors or horizontal overflow. The primary
`https://xl-traders-b2b.pages.dev` also passed public mobile/desktop and all-chunk
credential checks. Guest cart with a synthetic
persisted stale rate hid it, retained sign-in/cart state, opened one intercepted
quantity-only WhatsApp message and made **zero order writes**. No actual message
was sent. Earlier route/search/banner/public-account checks also passed.

Drawer/import/image/history/PDP-admin checks use actual components/services with
synthetic responses. Real file input and XLS/XLSX/CSV/Sheets ordering validation,
canvas original hashes/widths/srcSet/failure cleanup, ten actual Tab and Shift+Tab
presses, Escape/focus restoration, scoped history/logout races and second-click
confirmed RPC all passed. They are **not hosted authenticated/admin write tests**.

Production SW controlled navigation for catalogue/PDP/cart/account; manifest/icons
returned 200; 51 cached entries contained no Supabase/API data. Offline cart kept
rates private; offline PDP showed no invented product. Registration, CacheStorage,
local/session storage and browser cache were cleared, then online control
reinstalled successfully. Zero DB writes/page errors. Physical hardware unavailable.
All **34 exact deployed JS chunks** passed known private-key/service-role-JWT,
direct Anthropic endpoint and private-VITE-reference scans. Unknown secret formats
are outside this pattern scan. Old immutable assets may retain the **revoked** key.

## Production database and operations

Only these reviewed migrations were applied unchanged in this run:

1. `supabase/migrations/20260920042455_enforce_minimum_order_value.sql`
   — installed `20261002045031_enforce_minimum_order_value`.
2. `supabase/migrations/20260923165549_require_cart_price_reconfirmation.sql`
   — installed `20261002045327_require_cart_price_reconfirmation`.

Current migration history has four entries; the earlier authorization and atomic
order migrations were already installed. **No repository migration is unapplied**
after comparison by name/definition rather than different installation timestamps.
Predecessor functions/owners/grants were preserved before changes, current schema
restored into free disposable PostgreSQL, **47 validation checks** including real
concurrency/rollback/reapply passed, and 41 role assertions passed before/after.
Six live denial/validation assertions passed in BEGIN/ROLLBACK with no persisted
rows; full SQL and rollback limits are in [CHANGELOG_SQL](../CHANGELOG_SQL.md).

Final read-only metadata recheck confirms profile privilege trigger, database-only
is_admin(), enabled RLS on all six affected tables, admin-only settings/import-log
writes, own-user order policies, postgres owners/fixed search paths, anonymous
price/health/legacy/confirmed denial and customer legacy denial/confirmed access.
Search GIN remains ready/valid. Catalogue total/public **143/139**, orders/items
**2/2**, both orders unowned, uncategorized sentinel **1**: all preserved.
One initial final introspection referenced a nonexistent SEO column and failed
without changes; corrected actual `meta_title`/`meta_description` query passed.

Other production operations: enabled required main PR/CI protection; deleted only
126 prelisted proven stale/merged remote branch refs with recovery information.
No real customer/catalogue/order data or buckets were deleted, no new Auth account
was created and no duplicate search DDL was applied. Later hosted validation
created/saved only a disposable draft and inactive banner and saved an unchanged
Default theme. Exact test rows were removed and original theme timestamp restored
with rollback snapshots and guards; full operations are logged in CHANGELOG_SQL.
Real settings/contact values were unchanged. Provider revocation/settings removal was the
owner's operation, not an independently verified agent console operation.

## Remaining limits and owner work, in recommended order

1. **Hosted release sign-off:** approved customer login is still needed for
   confirmed checkout and positive history/reorder. Existing admin Chrome session
   verified pricing, catalogue save, settings reads, inactive banner edits and
   same-value theme save. Hosted import/upload blocked by file-URL permission;
   settings writes not attempted against real contacts. Auth admin API still 401;
   no account/email or alternate authentication method was introduced.
2. **Catalogue/business readiness:** raw products columns show 136 of 139 public
   rows with blank descriptions and 135 with some blank SEO metadata; these are
   not effective PDP/health counts, which may incorporate master data.
   Existing image URLs do not prove correct real
   photos. Owner must supply/approve actual information/photos and resolve the
   11 Hinged Box pricing conflicts. Nothing was invented or autopublished.
3. **Physical mobile acceptance:** real-device clear-storage/offline check is NOT
   TESTED because hardware is unavailable; browser checks above passed.
4. **Provider activity audit:** NOT TESTED without provider-console access. Owner
   confirmed revocation and hosting-variable removal; new code/build scan passed.
5. **Toolchain maintenance:** nine development audit findings remain; no deployed
   runtime exploit path was verified. Keep local dev/test endpoints private and
   address tooling in separate tested maintenance work, not a forced major bump.

The prioritized code list is complete. None of these limits can be converted into
a passing result by a source change or invented data. Code-side release changes
are ready; full business/hosted acceptance is not yet established.
