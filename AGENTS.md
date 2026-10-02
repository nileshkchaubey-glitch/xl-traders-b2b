# XL Traders B2B — agent instructions

Read the latest owner task first, then CLAUDE.md and the focused docs. Current
origin/main, PRs, code and verified live schema override historical handoff status.
Verify before implementing; do not redo completed work or add speculative features.

- Preserve local work. One focused branch/PR at a time; never push directly to main.
  Inspect the whole diff and review threads. Run focused tests and `npm run ci`;
  merge only with required checks green under current owner authorization. Fetch
  and verify main CI and the exact deployment afterward.
- Guests never receive protected price fields or stale cart rates. Guest WhatsApp
  is quantities only and creates no DB order. Authenticated orders require explicit
  price reconfirmation and the protected atomic RPC. Never widen anon grants.
- Admin truth is the database profile flag plus RLS/is_admin(), never email or
  editable Auth metadata. Keep profile privilege protections.
- price is per selling unit; quantity_in_unit is pack size; MOQ counts packs.
  Use orderingModel, branded Packs, cartTotals and shared messages/services. No
  pack_size duplicate, quantity/money arithmetic in UI or bypassed order steps.
- New products are drafts. Keep published+active public gates and the health/count
  views. Never delete uncategorized, real customer/catalogue/order data or buckets,
  touch the 11 Hinged Box conflicts, or rerun sql/02-public-read-policies.sql.
- Production SQL for approved launch work is authorized: inspect history/schema,
  save predecessor definitions/owners/grants, validate on free disposable staging,
  verify the exact target, apply minimally, verify afterward and log actual SQL.
  Stop only for an irreversible/high-risk change without rollback or a new business
  decision. No paid services/infrastructure or invented business/catalogue data.
- No private browser/VITE credentials, base64 product images, MRP/discount/slab
  claims, freight lines or delivery promises substituted for dispatch.
- Components use existing services; Wouter Link for internal routes. Reuse semantic
  tokens/controls; test mobile/desktop and drawer focus with actual Tab presses.
- npm/package-lock only; Node from .nvmrc; no pnpm lockfile or weakened guardrails.

Pointers: docs/STOREFRONT_RULES.md, docs/ORDERING_MODEL.md, docs/DESIGN_SYSTEM.md,
docs/TEST_ADMIN.md, docs/CHANGELOG_SQL.md, DEPLOYMENT.md and docs/LAUNCH_STATUS.md.
Archives/HANDOFF are history. State precisely what was tested and what was not.
