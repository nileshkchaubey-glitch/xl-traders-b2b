# Launch work status — current reconciliation

Status checked on 2 October 2026. Update evidence when the remaining focused
work merges; historical HANDOFF/plan pending lists do not override current code.

| Item | State / evidence |
| --- | --- |
| Existing #191/#193 | Merged; reviewed minimum/reconfirmation migrations applied and verified. SQL changelog records exact names/operations/rollback and test limits. |
| Screenshot preservation | #195 restores all 25 exact protected blobs; remains preserved. |
| Guest cart | #196: both actions, rates hidden, zero DB order request; immutable Pages mobile/desktop passed. |
| Auth profile/admin conflict | #198: DB flag only, customer profile creation, confirmation handling, privilege-edit rejection; unit and synthetic browser tests passed. |
| Block B UI/dependencies/exports | #199/#200/#201 merged; 32 primitives and 24 package declarations removed after verification; live daily widget/TEMPLATE_COLUMNS retained. |
| Block B branches | #202 records 126 proven deletions, recovery bundle, protected refs and 30 preserved branches. Unverified unmerged work is kept. |
| Block C | Inventory committed; exact source/history archived; focused current docs and AGENTS replace stale instructions in this PR. |
| 5.1 Ordering editor | Pending: add shared controls; initial/pack stepper has a verified multi-pack-step mismatch with the server that must be aligned. |
| 5.2 Image upload | Partial: canvas resize/WebP paths exist, but original plus web rendition/category workflow needs completion and bucket verification. |
| 5.3 Import | Partial: real XLS/XLSX tests pass; template ordering fields and unit samples need correction/end-to-end tests. |
| 5.4 Banner/theme admin | Partial: schema and storefront consumers exist; editing controls pending. |
| 5.5 Search index | Name pg_trgm GIN already exists in production; meaningful plan/latency measurement pending, no duplicate DDL. |
| 5.6 Splitting | Dashboard/editor lazy; other routes eager. Before/after chunks and cold-load verification pending. |
| 5.7 History/reorder | Pending: Account placeholders; use scoped policies, current products/rates and shared MOQ/step model. |
| Browser AI secret path | Verified pending blocker: aiService still accepts a private VITE credential. Disable unsafe paths before launch if no approved backend credential exists. |
| Business settings | maybeSingle already present; editor payload mismatches live key/value schema. Pending focused fix. |
| Service worker | Build/config checks pass; practical production controlled/clear-storage checks pending. Physical-device test NOT TESTED. |

Full CI passes on merged work; inspect exact current main SHA/checks rather than
treating a dated pass as future approval. Positive/concurrent/rollback order tests
passed free restored-schema staging (47 checks, 41 role assertions before/after).
Six live denial/validation assertions passed in a rolled-back transaction with
no persisted rows. Hosted Auth/PostgREST/Storage is not part of local staging.

Hosted authenticated pricing, checkout and admin write smoke checks need valid
test access; the available Auth admin credential failed. Continue independent
code work without claiming those paths were tested. No private credential is
stored in reports. Physical mobile hardware is unavailable for SW testing.

Owner work: actual catalogue information/photos/descriptions/SEO, the 11 Hinged
Box price conflicts and any new business claim. Never invent these or publish
drafts automatically. No paid service or infrastructure is introduced.
