> Phase 0 snapshot before implementation, with the daily-widget consumer claim corrected after code recheck. Current completion is tracked in [launch status](../LAUNCH_STATUS.md).

# Launch work reconciliation — 2 October 2026

Baseline: fetched `origin/main` was `73f2ba516391d3ae12596da2e384f64f3004745b`
(PR #194). The attached handoff is preserved in `docs/HANDOFF.md` as historical
context. The owner's 2 October task supersedes its SQL and merge prohibitions.
Code, current PR state and live implementation were checked before scheduling work.

## Actual initial commands and results

- `git fetch --all --prune`: succeeded; main remained at #194 initially.
- `git status`: `codex/customer-price-reconfirmation`, two commits ahead, with
  authorization fixture/test edits and the new staging runner. These were saved
  in commit `54eeda0`; unrelated attachment files were not staged.
- `git branch --show-current`: `codex/customer-price-reconfirmation`.
- `git log origin/main --oneline -40` and
  `gh pr list --state all --limit 40`: inspected. #183–190, #192 and #194 are
  merged. #191/#193 were open drafts. #182 is merged, including a later commit
  that deleted the previously protected screenshots again.
- `ls docs docs/archive`: focused docs, reports, SQL and the two rescued archive
  documents exist. Repository `docs/HANDOFF.md` was missing and is now copied.
- Byte counts: `CLAUDE.md` **109,234**, `CODEX.md` 9,984, `README.md` 8,932,
  `STOREFRONT_RULES.md` 21,322, `ORDERING_MODEL.md` 72,040,
  `DESIGN_SYSTEM.md` 42,154, `CHANGELOG_SQL.md` 23,187. `AGENTS.md` was missing.
- `ls client/src/components/ui | wc -l` equivalent: **55 files**.
- `.nvmrc` and GitHub CI use **Node 20**, superseding the handoff's Node 24 claim.
- Repository visibility: **PUBLIC**. Main was unprotected. Protection is now
  enabled: PR required, strict `Type-check & build` check, administrators included,
  force-push/deletion disabled. Zero required external approvals permits the
  owner's authorized self-review/merge workflow; no approval was submitted.

## Block B/C/D disposition

| Item | Status | Current evidence / next action |
| --- | --- | --- |
| B PR-1 rescued documents | DONE | #181 `f5d591b`; both files in `docs/archive/` |
| B PR-2 32 UI primitives | NOT STARTED | Individually checked below; all remain, none reachable or imported outside the proposed set |
| B PR-2 preserve alert/confirm dialogs | DONE | `confirm-dialog.tsx` imports `alert-dialog.tsx`; live admin callers remain; keep both |
| B PR-2 hand-rolled breadcrumb documentation | NOT STARTED | Catalog/ProductDetail/Account implement their own links; document in DESIGN_SYSTEM |
| B PR-2 dead Home animation CSS | DONE | #182 `0383a85`; no `.xl-kenburns` or `.xl-hero-crossfade` rules remain |
| B PR-2 mobile sheet height/focus | NOT STARTED | Both sheets still use plain `max-h-[88vh]`, no Drawer autoFocus; real keyboard verification needed |
| B PR-3 eight runtime candidates | DONE | #182 removed framer-motion, resolvers, zod, react-virtual, axios, nanoid, streamdown and tailwindcss-animate |
| B PR-3 post-primitive dependency analysis | NOT STARTED | Re-run after deleting verified primitives; evaluate all remaining package/config consumers |
| B PR-3 three dev candidates | NEEDS VERIFICATION | postcss/autoprefixer/typography still declared; previous owner-confirmation hold is superseded by current approved analysis/removal task |
| B PR-4 daily-improvements feature | SUPERSEDED | Correction after full code recheck: AdminDashboard renders AdminOverview → AdminDailyImprovementsWidget → getTodaysAdminSuggestions. Preserve the live feature and its three internal rotation arrays; remove only unused exports/completed constant. |
| B PR-4 chatAssist / CSV generator / metaDescriptionFor | NOT STARTED | No current code consumers found; independently verify before removal |
| B PR-4 Sheets/Drive helper exports | PARTLY DONE | Functions are used inside their own modules; preserve implementations, consider removing unused export only |
| B PR-4 TEMPLATE_COLUMNS removal | SUPERSEDED | Used by real template generation and #194 `excelCompatibility.test.ts`; keep export |
| B PR-5 branches | NOT STARTED | 149 remote branches currently; inspect all PR merged states before listing/deleting candidates; keep rate-card branch and backup tag |
| C CLAUDE inventory/shrink/archive | NOT STARTED | 109 KB, contains dated/history and contradictory current claims; inventory first |
| C AGENTS and documentation verification | NOT STARTED | AGENTS missing; ordering doc says code unimplemented despite live shared model; README describes retired Home/virtualized grid |
| D 5.1 admin Ordering | NOT STARTED | No editor order_unit/order_step controls; shared customer model/schema already exist |
| D 5.2 original + WebP upload | PARTLY DONE | Canvas resize utility and SKU WebP uploads exist, but original is not preserved beside rendition; category upload stores raw file; no real rendition srcSet |
| D 5.3 CSV/Excel ordering import | PARTLY DONE | Bulk mappings exist; template lacks ordering columns and samples still say unit=pcs; XLS/XLSX parser tests pass after #194 |
| D 5.4 banner/theme admin | PARTLY DONE | Storefront/data schema/theme consumer exist; no admin editing controls found |
| D 5.5 pg_trgm name GIN | DONE | Live `products_name_trgm USING gin (name gin_trgm_ops)` already exists; do not duplicate migration. Latency/plan measurement still needs verification |
| D 5.6 route splitting | PARTLY DONE | Dashboard/product editor lazy, storefront and AdminMasters eager; initial JS around 240 KB gzip; measure cold loads and remaining chunks |
| D 5.7 order history/reorder | NOT STARTED | Account has placeholder dash stats; no history/reorder calls; existing own-order policies provide foundation |

The resolved TypeScript import graph covers **180 source/test files**, with
**137 reachable from main.tsx**. Every proposed primitive has zero consumers
outside the dead set. Internal edges: separator is used by button-group, field,
item and sidebar; toggle is used by toggle-group. The full individual list is:

accordion, alert, aspect-ratio, avatar, breadcrumb, button-group, calendar,
carousel, chart, collapsible, empty, field, form, hover-card, input-group,
input-otp, item, kbd, menubar, navigation-menu, pagination, progress, radio-group,
resizable, scroll-area, separator, sidebar, slider, spinner, tabs, toggle,
toggle-group. Each verdict is NOT STARTED for removal and verified unused at
this baseline; re-check when PR-2 starts.

## Regressions and Phase 1

**Verified regression:** #182's final squashed diff deletes 25 `docs/screenshots`
files despite the owner's earlier preservation request. Restore exact blobs
from `0383a85^`; the screenshot PR contains no runtime changes.

- Guest Cart redirects to `/auth`; it has no separate privacy-safe WhatsApp
  action. Phase 1 A is NOT STARTED. Keep authenticated confirmed-price checkout.
- #191 is now merged at `8a5d67c4fabd7d17e49eb0f6244f906f8ec31f52` after CI
  run `36965005267` passed. Main CI `36965145292` passed. Production migration
  remains unapplied. Both exact #191/#193 filenames and prepared status are now
  recorded in CHANGELOG_SQL; Phase 1 B is PARTLY DONE until deployment is logged.
- Client `authStore` grants admin UX from VITE_ADMIN_EMAILS and inserts
  is_admin=true for allowlisted new profiles. Live trigger rejects this insert
  for ordinary authenticated callers. Phase 1 C is NOT STARTED: trust only the
  persisted admin profile and document controlled provisioning.

## Checks actually run

- `npm run ci` on the preserved #193 branch: **160 application tests**, **41
  authorization assertions**, **12 minimum checks**, **13 reconfirmation checks**,
  TypeScript, all storefront guardrails, production build and PWA passed.
- `npm run ci` on #191 synced with current main: **147 application tests**, 41
  authorization assertions, 12 minimum checks and remaining checks/build passed.
- Checker negative control: planted temporary JSX `<span>Freight</span>`; exit
  **1**, `no-freight-line` reports the exact file/line. Removed probe; legitimate
  source passes, exit **0**. Probe never committed.
- `python scripts/validate-order-staging.py --snapshot-dir
  tmp/launch-validation-20260924`: fresh localhost restore rerun on 2 October,
  **47 passed checks**, including both actual concurrent sessions, exact rollback,
  migration reapply, and 41 authorization assertions before/after.
- Current live metadata compared with captured staging schema: all 18 relations,
  eight functions, schemas, enums and default ACLs match. Production PostgreSQL
  17.6; local 17.11. Only schema definitions and minimum settings were copied;
  seeded rows are synthetic. Hosted Auth/PostgREST services are outside this test.

## Risk-pattern reconciliation

Source scans include MRP, line-through, percent-off, slab, base64, direct Supabase
imports, delivery timing, freight, public select-star and guest price columns.
The storefront checker passes. MRP references found are admin inputs/import
schema or comments; no public MRP/discount rendering was found. Several legacy
admin components still query Supabase directly; DESIGN_SYSTEM already records
this debt, and any touched path must be extracted into a service. Type-only
imports are not client-query violations. Stored copy scan only matched the
explicit statement **“no slabs”**, not a slab-pricing promise.

Live anon grants deny price/mrp/bulk_price/bulk_threshold/price_per_piece; MOQ
remains readable. Production health view protection/profile trigger are present.
Browser AI credential references in aiService remain a verified unsafe path;
remove exposure or disable affected AI in Phase 3. business_settings already
uses maybeSingle, so that historical fix is SUPERSEDED; its editor's object
shape conflicts with live key/value table and needs a focused follow-up.

Live catalogue aggregate: 143 rows, 139 public, 3 nonblank descriptions and 4
nonblank SEO descriptions. Image URLs are present on 142 rows but that does not
prove real catalogue/photo readiness. Real data, pricing conflicts and business
claims remain owner work. No catalogue information will be invented.
