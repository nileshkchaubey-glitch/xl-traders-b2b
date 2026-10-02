# XL Traders B2B — working rules

Read first: the owner's latest task, [AGENTS.md](AGENTS.md),
[storefront rules](docs/STOREFRONT_RULES.md), [ordering model](docs/ORDERING_MODEL.md),
then the focused document for the change. Current code, origin/main, open PRs and
verified live schema decide implementation status. Historical handoffs, plans and
archives do not override newer instructions or prove a feature is pending.

XL Traders is a B2B packaging wholesale storefront with one catalogue/PIM at
`/admin`. Stack: React, TypeScript, Vite, Tailwind v4, Wouter, Zustand and Supabase.
GitHub: `nileshkchaubey-glitch/xl-traders-b2b`; production Pages site:
https://xl-traders-b2b.pages.dev. Do not recreate `/admin-v2` or invent catalogue,
pricing, business claims or speculative features.

## Hard rules

- Guests receive no prices/rates, MRP, discount or per-piece price fields.
  Product services select explicit guest columns and gate price sorting by the
  actual session. Column grants/RLS enforce the database boundary. Never widen
  anon permissions to fix UI. Stale signed-out carts must not display/send rates.
- `products.price` is the selling-unit price. `quantity_in_unit` is the pack size;
  never add a duplicate `pack_size`. MOQ counts packs. Customer display/input
  uses `order_unit` and `order_step` through `orderingModel.ts`. Money uses
  branded `Packs` and `lineTotal`; totals use `cartTotals`; messages use the
  shared order-message/service model. Do not fork arithmetic into UI.
- Guests may sign in or send a quantity-only WhatsApp cart enquiry without a DB
  order. Authenticated checkout uses the confirmed-price atomic RPC and explicit
  customer reconfirmation after price changes. Never automatically retry an order.
- Admin privileges come only from `user_profiles.is_admin`, with RLS and
  `public.is_admin()` enforcing access. Browser email allowlists and editable
  Auth metadata cannot grant privileges. Keep the profile-protection trigger.
- New products start as drafts; public product queries require published and
  active. Never auto-publish draft catalogue records. `v_category_live_counts`
  owns live category counts; `v_product_health` owns health dimensions.
- Preserve real customers, products/catalogue, orders/order_items and buckets.
  Never drop/truncate core production tables. Keep `uncategorized`, the 11 Hinged
  Box price conflicts, `feat/storefront-rate-card` and `pr142-backup`. Never rerun
  `sql/02-public-read-policies.sql`. Preserve local work and protected screenshots.
- No private credentials in browser code or `VITE_*`. No base64 product images,
  invented stock/ratings/customer-count boasts, MRP/strike-through/discount/slab
  presentation, freight claims, or dispatch copy upgraded to arrival promises.
- Components call existing services for data. Do not add direct Supabase queries
  to components or parallel services. Internal navigation uses Wouter `Link`.
- Use existing semantic CSS tokens, `xl-shell`, shared cards/price slots and
  ordering controls. Drawers need autofocus, a correct height variant, keyboard
  focus containment and return. Compare rendered screens, not markup alone.
- npm only, `package-lock.json` only; no `pnpm-lock.yaml`. Use the Node version
  in `.nvmrc`. Do not weaken guardrails or force audit upgrades to obtain green CI.

## Working protocol

1. Fetch main and inspect PRs/CI/local changes. Verify the defect before changing
   anything; safely finish existing work first. One focused branch/PR at a time.
2. Implement the smallest complete fix. Run focused tests, `npm run ci`, inspect
   the full diff, and directly verify affected mobile/desktop behavior.
3. Push and document real results, limitations, deployment and rollback. Inspect
   GitHub checks and review threads; fix legitimate findings. Merge only under
   current owner authorization, with required checks green and the head verified.
4. Fetch and verify the merged commit, main CI and exact deployment. Continue to
   the next verified task; record an access blocker and continue independent work.
5. Ask only for a genuinely new business decision or high-risk irreversible
   operation without safe rollback. Old prototype/SQL approval gates do not
   override the owner's current authorization. Never self-claim external approval.

Production SQL is authorized for the current launch task. Before a modification,
inspect current schema/history, compare intended SQL, save predecessor definitions,
owners and grants, validate on free disposable staging, verify the exact target,
apply the required change, then verify definitions/grants/behavior. Use migration
history accurately and log actual operations in [CHANGELOG_SQL](docs/CHANGELOG_SQL.md).
Do not delete real data, use paid services, or create paid infrastructure.

## Focused references

- [README](README.md): actual routes/services and supported commands.
- [CODEX](CODEX.md): product scope and operator workflow.
- [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md) and [STYLE_REFERENCE](docs/STYLE_REFERENCE.md): UI.
- [ORDERING_MODEL](docs/ORDERING_MODEL.md): locked semantics and implementation.
- [SQL_SCHEMA](SQL_SCHEMA.md), migrations and [SQL changelog](docs/CHANGELOG_SQL.md): database.
- [TEST_ADMIN](docs/TEST_ADMIN.md): controlled provisioning and safe test boundaries.
- [DEPLOYMENT](DEPLOYMENT.md): CI, Pages, PWA and verification limits.
- [Launch status](docs/LAUNCH_STATUS.md): remaining verified work and evidence.
- [HANDOFF](docs/HANDOFF.md): historical task sequence; reconcile before using.
- [Archive](docs/archive/README.md): preserved history, never current permission.

The [inventory](docs/reports/2026-10-02-claude-inventory.md) records every section
and size before reduction. The exact original is preserved in the archive.
