# Launch work status — current reconciliation

Status checked on 2 October 2026. Update evidence when the remaining focused
work merges; historical HANDOFF/plan pending lists do not override current code.

Validated runtime checkpoint: `8050f1845a5c8e14afe13b56b300329861040cac` (#213).
See [final evidence, commands and remaining limits](reports/2026-10-02-final-launch-validation.md).
Approved functional code work is merged; hosted/business acceptance remains partial.
See [actual hosted follow-up](reports/2026-10-02-hosted-admin-validation.md):
existing admin pricing/catalogue/banner/theme checks passed; customer checkout
and hosted file import/upload remain untested. The remaining local paste label
is corrected in the focused follow-up PR.

| Item                            | State / evidence                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Existing #191/#193              | Merged; reviewed minimum/reconfirmation migrations applied and verified. SQL changelog records exact names/operations/rollback and test limits.                                                                                                                                                                                                                                      |
| Screenshot preservation         | #195 restores all 25 exact protected blobs; remains preserved.                                                                                                                                                                                                                                                                                                                       |
| Guest cart                      | #196: both actions, rates hidden, zero DB order request; immutable Pages mobile/desktop passed.                                                                                                                                                                                                                                                                                      |
| Auth profile/admin conflict     | #198: DB flag only, customer profile creation, confirmation handling, privilege-edit rejection; unit and synthetic browser tests passed.                                                                                                                                                                                                                                             |
| Block B UI/dependencies/exports | #199/#200/#201 merged; 32 primitives and 24 package declarations removed after verification; live daily widget/TEMPLATE_COLUMNS retained.                                                                                                                                                                                                                                            |
| Block B branches                | #202 records 126 proven deletions, recovery bundle, protected refs and 30 preserved branches. Unverified unmerged work is kept.                                                                                                                                                                                                                                                      |
| Block C                         | #203 merged; inventory committed first, source/history archived, current docs and AGENTS replace stale instructions.                                                                                                                                                                                                                                                                 |
| 5.1 Ordering editor             | #204 merged; shared controls/save validation and quantities aligned with existing server MOQ/step rules. Main CI/Pages and immutable mobile/desktop guest checks passed. Hosted synthetic draft ordering save/reopen passed; exact disposable row removed.                                                                                                                           |
| 5.2 Image upload                | #205 merged: originals plus two generated WebP renditions, actual-width srcSet and shared product/category pipeline. Main CI/Pages and public mobile/desktop checks passed. Unit and real canvas/component fixture checks passed. Live bucket configuration/policies verified; hosted upload/list NOT TESTED because Chrome file-URL access is disabled.                             |
| 5.3 Import                      | #206 merged; main CI/Pages and public mobile/desktop checks passed. Shared CSV/XLS/XLSX/Sheets validator, ordering mappings/preview/export, template round-trip and SKU preservation/draft protections. Real Chrome file/mapping UI passed mobile/desktop with synthetic responses; hosted import writes NOT TESTED because Chrome file-URL access is disabled.                      |
| 5.4 Banner/theme admin          | #207 merged; main CI/Pages and public mobile/desktop checks passed, including actual HTTP 200 reads for all three banner slots. Service, disposable role-policy and actual form/theme fixture checks passed. Hosted inactive banner create/edit and same-value Default save passed; exact fixture cleanup/original timestamp restoration logged. No public appearance/schema change. |
| 5.5 Search index                | Verified DONE: existing products_name_trgm GIN is ready/valid and used by name-only search. Current three-column search sampled at 0.558–0.565 ms DB execution on 143 rows; real anonymous mobile/desktop searches passed. No duplicate DDL or unobserved before/after gain claimed; see the search-index report.                                                                    |
| 5.6 Splitting                   | #209 merged and main/Pages verified: all page routes lazy; same-environment Home foreground JavaScript 827,330 → 636,544 bytes. Route/fallback/mobile/desktop checks pass; precache policy retained.                                                                                                                                                                                 |
| 5.7 History/reorder             | #210 merged and main/Pages verified: own-user pagination, atomic current-rule reorder, explicit price reconfirmation. Mobile/desktop real component fixtures pass; Hosted admin own-history empty result passed; positive customer history/reorder NOT TESTED. Legacy unowned orders preserved.                                                                                      |
| Browser AI secret path          | Provider/key path and generation removed; local-only Smart Paste and guardrails validated. Actual predecessor Pages chunk exposed an Anthropic secret-format value: owner confirmed revocation and hosting-variable removal. Merged #211 exact production all-chunk scan passed; independent provider activity review NOT TESTED.                                                    |
| Business settings               | #212 merged and main/Pages verified: schema-correct changed-key saves, returned-value verification, visible errors and no local fallback. Mobile/desktop fixtures pass; hosted seven-field reads/mobile Tab passed, save NOT TESTED to preserve real contacts.                                                                                                                       |
| Service worker                  | Exact #213 production Chrome mobile/desktop control, deep links, offline privacy, manifest/icons and clear-storage/reinstall passed. Physical-device check NOT TESTED.                                                                                                                                                                                                               |
| Public PDP activation           | #213 merged and main/Pages verified: both public gates apply even with admin read permissions; explicit editor draft access and guest privacy retained. Before-fix regression failed; four tests/browser fixtures/full CI pass.                                                                                                                                                      |

Full CI passes on merged work; inspect exact current main SHA/checks rather than
treating a dated pass as future approval. Positive/concurrent/rollback order tests
passed free restored-schema staging (47 checks, 41 role assertions before/after).
Six live denial/validation assertions passed in a rolled-back transaction with
no persisted rows. Hosted Auth/PostgREST/Storage is not part of local staging.

Existing authorized Chrome admin session verified actual pricing, draft save,
settings reads, inactive banner editing and same-value theme save. Only exact
task-created rows were removed; original theme timestamp restored. Customer
checkout/positive history still need an approved customer login. Hosted import/
upload blocked by Chrome file-URL permission; settings writes not attempted
against real contacts. Auth admin API remains invalid. No private credentials
are stored in reports. Physical mobile hardware is unavailable for SW testing.

Owner work: actual catalogue information/photos/descriptions/SEO, the 11 Hinged
Box price conflicts and any new business claim. Never invent these or publish
drafts automatically. No paid service or infrastructure is introduced.
