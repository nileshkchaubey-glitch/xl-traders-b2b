# Hosted admin validation follow-up — 2 October 2026

Validated current production UI following main `ac8f16149629191d6b6e240bbda5604a24315cba`
(#214). Its GitHub CI [36994836552](https://github.com/nileshkchaubey-glitch/xl-traders-b2b/actions/runs/36994836552)
and exact [Pages deployment](https://12be5c57.xl-traders-b2b.pages.dev) passed.
The earlier API-key failure remains real, but an existing authorized Chrome admin
session made some previously blocked hosted checks possible. No credentials were
extracted, account created, Auth metadata changed or managed Auth row manipulated.

| Check                                       | Actual result                                                                                                                                                                                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authenticated pricing                       | Working for existing admin session: real PDP rates and authenticated add action visible, mobile/desktop no overflow. Customer-role positive pricing remains untested.                                                                                |
| Catalogue editor                            | Working: quick-add created a synthetic draft; real panel saved pack price 100, pack size 100, MOQ 2, pcs step 300 and synthetic description. Reopening and SQL confirmed persistence and shared minimum 300 pcs. No real product edited.             |
| Public draft privacy                        | Working: synthetic draft PDP returned Product not found even with admin session. Never published.                                                                                                                                                    |
| Settings                                    | Working read: all seven stored fields loaded. Mobile actual Tab moved Company name to Address, no overflow; unchanged Save disabled. Write untested to preserve real contact values.                                                                 |
| Banner admin                                | Working: synthetic inactive home_top banner created and edited, SQL confirmed persistence/inactive status; mobile Tab reached banner-text, no overflow. Activation/scheduling not tested against public content.                                     |
| Theme                                       | Working: existing Default saved with identical value; SQL confirmed. No appearance change. Original timestamp restored during cleanup.                                                                                                               |
| Account history                             | Working empty own-user result for existing admin; both historical production orders remain unowned. Positive customer history/reorder/checkout untested.                                                                                             |
| Hosted CSV/XLS/XLSX import and image upload | NOT TESTED: Chrome extension file-URL access disabled; chooser upload failed before any file/import write. Prepared synthetic files were never uploaded. Real component/canvas/file tests with synthetic responses remain separate passing evidence. |

Actual Chrome desktop viewport was 1489×623; requested mobile 390×844 measured
391×844 due to browser rounding. Earlier immutable release checks used exactly
390×844 and 1440×900. Temporary viewport reset and owner price-entry preference
restored to Per piece. Existing user tabs, login and cart preserved.

Only task-created draft/banner rows were removed, with complete row snapshots,
exact target/timestamp guards and dependency checks. Theme timestamp restored
only while its unchanged value/current timestamp matched. Full actual SQL,
post-check counts and recovery information are in [CHANGELOG_SQL](../CHANGELOG_SQL.md).
Final counts: products/public 143/139, orders/items 2/2, sentinel 1, banners 0,
original import log retained; no storage file, import log or customer order created.
No real catalogue/customer/order data, buckets, grants or policies changed.

The live draft panel exposed one surviving misleading label, **AI Paste**, while
the dialog already used the local-only parser from #211. This focused follow-up
changes it to **Smart Paste**; no backend AI, provider call or new feature added.
The full CI suite must pass on this label/documentation PR before merge; its
description records the exact head/checks and subsequent deployment verification.

Ignored local evidence: hosted-baseline.json, hosted-draft-before-cleanup.json,
hosted-banner-before-cleanup.json, hosted-cleanup.sql, hosted-draft-editor.jpg,
hosted-banner-mobile.jpg under tmp/launch-20261002. Admin screenshots and protected
rates are not committed to the public repository. Owner confirmed the previously
exposed Anthropic key was revoked and hosting variables removed; independent
provider-console activity review remains untested.

Remaining acceptance needs: approved customer login for hosted checkout/history,
file-picker access for hosted imports/uploads, physical mobile hardware, and
owner-approved catalogue content/11 Hinged Box price decisions. These are not
verified code defects and were not converted into passing results by assumptions.
