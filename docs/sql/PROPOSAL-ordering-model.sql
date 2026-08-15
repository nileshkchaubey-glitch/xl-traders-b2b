-- ============================================================================
-- PROPOSAL-ordering-model.sql
--
--   PCS-based ordering model — schema proposal.
--   Design spec: docs/ORDERING_MODEL.md
--
-- ✅ STATUS: SUPERSEDED — its contents WERE executed, from a different file.
--   Blocks [A], [B] and [C] of this proposal were run against
--   danoeaftaazhbldeeuxj on 15 Aug 2026 as part of Storefront V3 Phase 2, via
--   docs/sql/v3-phase2-schema.sql (which also grants moq to anon and adds the
--   category-count view, promo_banners, storage buckets, site_theme and
--   orders.user_id). Verification output: docs/sql/v3-phase2-verification.md.
--
--   Keep this file as the design record. DO NOT run it — re-running is harmless
--   (every statement is guarded by IF NOT EXISTS / catalog lookups), but
--   v3-phase2-schema.sql is the file of record for what actually happened.
--
-- WHAT IT DOES
--   [A] adds products.order_unit + products.order_step (+ their CHECKs)
--   [B] grants the two new columns to anon        ← MANDATORY, see note below
--   [C] OPTIONAL, INDEPENDENT: products.price_per_piece generated column
--       + a partial index, for per-piece sorting  ← NOT granted to anon
--
--   [A] and [B] are one transaction and must be run together.
--   [C] is a separate transaction and can be run later, or never — the
--   ordering model does not depend on it (ORDERING_MODEL.md §7.5).
--
-- WHAT IT DOES NOT DO
--   * No UPDATE, anywhere. Every existing row reaches order_unit='pack' through
--     the column DEFAULT, which is what makes the ~142-row byte-identity
--     guarantee (ORDERING_MODEL.md §5) hold. In particular NOTHING here touches
--     the 11 Hinged box rows — see the read-only listing in VERIFY §V7 and
--     CLAUDE.md's carve-out. Do not add an UPDATE to this file.
--   * No change to orders / order_items / product_masters / v_product_health.
--   * No change to RLS. The publish-gate work is separate
--     (docs/sql/pr1-rls-publish-gate.sql).
--
-- ORDER OF OPERATIONS — this matters
--   Run [A]+[B] BEFORE the application code that selects the new columns is
--   deployed. sql/04-price-column-security.sql revoked the blanket table SELECT
--   from anon and re-grants column by column, so a NEW column is ungranted by
--   default. A guest query naming an ungranted column fails with "permission
--   denied" — the same trap sql/04:44-48 documents for `status`. SQL first,
--   merge second.
--
-- IDEMPOTENT: safe to re-run. ADD COLUMN uses IF NOT EXISTS; ADD CONSTRAINT has
-- no IF NOT EXISTS in Postgres, so constraints are guarded by pg_constraint
-- lookups in DO blocks (cf. Critical Rule #4 — `CREATE POLICY IF NOT EXISTS` is
-- likewise invalid).
--
-- AFTER RUNNING: append the executed statements to docs/CHANGELOG_SQL.md with a
-- one-line reason (Critical Rule #3).
-- ============================================================================


-- ============================================================================
-- [A] + [B] — ordering columns and their grants.  RUN THESE TOGETHER.
-- ============================================================================
BEGIN;

-- ── [A1] order_unit ─────────────────────────────────────────────────────────
-- How the CUSTOMER counts. Not what is stored, not what is priced.
-- DEFAULT 'pack' is the entire backfill: every existing row becomes an ordinary
-- pack product with no statement touching it. NOT NULL + DEFAULT does not
-- rewrite the table on PG 11+.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS order_unit TEXT NOT NULL DEFAULT 'pack';

COMMENT ON COLUMN public.products.order_unit IS
  'How the customer counts: pack (default) or pcs. Display/input only — '
  'products.price is ALWAYS the price of one selling unit (CLAUDE.md canonical '
  'unit-of-sale rule) and money is always packs x price. See '
  'docs/ORDERING_MODEL.md.';

-- ── [A2] order_step ─────────────────────────────────────────────────────────
-- Pieces per stepper click, when order_unit='pcs'. NULL means "one pack,
-- whatever quantity_in_unit currently is" — deliberately nullable rather than
-- defaulted, so editing a pack size can never leave a stale step behind
-- (ORDERING_MODEL.md §1.3).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS order_step INTEGER;

COMMENT ON COLUMN public.products.order_step IS
  'Pieces per stepper click when order_unit=''pcs''. NULL = one pack '
  '(inherits quantity_in_unit). Must be a whole multiple of quantity_in_unit; '
  'that rule is enforced in admin validation, and a non-conforming stored '
  'value degrades to one pack at render time. See docs/ORDERING_MODEL.md §6.2.';

-- ── [A3] CHECK constraints ──────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname  = 'products_order_unit_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_order_unit_check
      CHECK (order_unit IN ('pack', 'pcs'));
    RAISE NOTICE 'Added constraint products_order_unit_check';
  ELSE
    RAISE NOTICE 'Constraint products_order_unit_check already present — skipping';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname  = 'products_order_step_positive'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_order_step_positive
      CHECK (order_step IS NULL OR order_step > 0);
    RAISE NOTICE 'Added constraint products_order_step_positive';
  ELSE
    RAISE NOTICE 'Constraint products_order_step_positive already present — skipping';
  END IF;
END;
$$;

-- ── [A4] DELIBERATELY NOT ADDED — do not uncomment without reading §1.6 ─────
-- A cross-column CHECK tying pcs mode to a usable pack quantity reads well and
-- is wrong for this codebase: product rows are edited ONE COLUMN AT A TIME
-- (inline cells, the Workbench's one-column image patch), so clearing
-- quantity_in_unit on a pcs row — an ordinary intermediate state during the
-- catalogue rebuild — would return a raw constraint violation to a UI with no
-- handler for it, from a field the operator was not editing.
-- Handled instead in two softer layers: admin validation refuses the switch,
-- and resolveOrdering() downgrades an impossible pcs row to pack mode.
--
--   ALTER TABLE public.products
--     ADD CONSTRAINT products_pcs_needs_pack_qty
--     CHECK (order_unit = 'pack' OR quantity_in_unit IS NOT NULL);

-- ── [B] Column grants ───────────────────────────────────────────────────────
-- MANDATORY. sql/04-price-column-security.sql revoked anon's table-level SELECT
-- and re-grants per column, so these two are invisible to guests until granted.
-- Guests DO need them: ProductCard's spec line and the PDP render for signed-out
-- visitors, and the storefront selects an explicit column list
-- (GUEST_PRODUCT_COLS, productService.ts:23-26) which must gain
-- order_unit,order_step in the SAME PR that relies on this grant.
--
-- Neither column is derived from price, so neither weakens the B2B price gate
-- (Architecture Rule #3). Contrast [C], which is.
GRANT SELECT (order_unit, order_step) ON public.products TO anon;

-- authenticated holds a table-level SELECT (sql/04 step 4), which automatically
-- covers new columns. Re-asserted here so re-running this file is sufficient on
-- a fresh instance.
GRANT SELECT ON public.products TO authenticated;

COMMIT;


-- ============================================================================
-- [C] OPTIONAL, INDEPENDENT — per-piece sort support.
--     Run separately. Skip entirely if per-piece sorting is not wanted yet.
--     ORDERING_MODEL.md §7.
-- ============================================================================
BEGIN;

-- 🔴 SECURITY — READ BEFORE RUNNING
--    price_per_piece is DERIVED FROM price. anon can already read
--    quantity_in_unit (sql/04:29), so a granted per-piece rate multiplied by
--    the pack size reconstructs the exact wholesale price — a total bypass of
--    the B2B price gate that Architecture Rule #3 makes column grants
--    responsible for.
--
--    THIS COLUMN MUST NEVER BE GRANTED TO anon.
--    There is no GRANT for it below, and because sql/04 revoked the blanket
--    table grant, a new column is ungranted by default — the failure mode is
--    closed, not open. Do not "fix" a guest permission error by granting it;
--    the fix is for guests not to sort by price (ORDERING_MODEL.md §7.3).
--    It must also stay OUT of GUEST_PRODUCT_COLS in productService.ts.

-- The CASE mirrors lib/priceUtils.ts isPriceOnEnquiry(): NULL and <= 0 both
-- mean "no price", so both sort as NULL and land last under
-- .order(..., { nullsFirst: false }) — matching how the pack-price sort already
-- behaves. A product with no usable pack quantity keeps its pack figure rather
-- than dropping out of the ordering.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_per_piece NUMERIC
  GENERATED ALWAYS AS (
    CASE
      WHEN price IS NULL OR price <= 0                        THEN NULL
      WHEN quantity_in_unit IS NULL OR quantity_in_unit <= 0  THEN price::numeric
      ELSE price::numeric / quantity_in_unit
    END
  ) STORED;

COMMENT ON COLUMN public.products.price_per_piece IS
  'DERIVED FROM price — NEVER GRANT TO anon (reconstructs the wholesale price '
  'when multiplied by the readable quantity_in_unit). Exists so PostgREST can '
  'ORDER BY a per-piece rate, which it cannot do for an expression. '
  'Authenticated sorting only. See docs/ORDERING_MODEL.md §7.3.';

-- Partial index matching the storefront's publish gate, so it stays small and
-- is actually chosen for the catalogue query.
CREATE INDEX IF NOT EXISTS products_price_per_piece_idx
  ON public.products (price_per_piece)
  WHERE is_active AND status = 'published';

COMMIT;


-- ============================================================================
-- VERIFY — read-only. Run after [A]+[B] (and [C] if applied).
-- ============================================================================

-- V1. Both columns exist, with the right nullability and default.
--     Expect: order_unit  text     NO   'pack'::text
--             order_step   integer  YES  (null)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'products'
  AND column_name IN ('order_unit', 'order_step', 'price_per_piece')
ORDER BY column_name;

-- V2. Constraints are present and say what they should.
--     Expect 2 rows (3 if the commented-out [A4] was ever added — it should not be).
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.products'::regclass
  AND conname LIKE 'products_order%'
ORDER BY conname;

-- V3. anon can read the two ordering columns — and CANNOT read price_per_piece.
--     Expect order_step + order_unit present; price/mrp/discount_percent absent;
--     price_per_piece ABSENT. If price_per_piece appears here, STOP: revoke it
--     (see ROLLBACK §R3) — the price gate is open.
SELECT column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name   = 'products'
  AND grantee      = 'anon'
  AND column_name IN ('order_unit', 'order_step', 'price_per_piece',
                      'price', 'mrp', 'discount_percent', 'quantity_in_unit')
ORDER BY column_name;

-- V4. Nothing was backfilled: every row is 'pack', every step is NULL.
--     Expect exactly one row: pack | <total products> | 0
SELECT order_unit,
       COUNT(*)                                   AS rows,
       COUNT(*) FILTER (WHERE order_step IS NOT NULL) AS rows_with_step
FROM public.products
GROUP BY order_unit
ORDER BY order_unit;

-- V5. Which rows COULD take pcs mode, and which could not (ORDERING_MODEL.md §6.1).
--     packDivisor() treats NULL / <= 1 as unusable, so "cannot" rows would be
--     downgraded to pack mode at render even if flagged.
SELECT
  COUNT(*) FILTER (WHERE quantity_in_unit IS NOT NULL AND quantity_in_unit > 1) AS can_use_pcs,
  COUNT(*) FILTER (WHERE quantity_in_unit IS NULL)                              AS no_pack_qty,
  COUNT(*) FILTER (WHERE quantity_in_unit IS NOT NULL AND quantity_in_unit <= 1) AS pack_qty_le_1
FROM public.products;

-- V6. order_items.quantity's data type.
--     Informational, and it gates a deferred decision: sub-pack ("half case")
--     steps would make the pack count fractional, and an integer column here
--     would silently truncate it. ORDERING_MODEL.md §6.2 defers that design;
--     this query is what would reopen it with facts.
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'order_items'
  AND column_name IN ('quantity', 'unit_price', 'subtotal')
ORDER BY column_name;

-- V7. The 11 Hinged box rows — READ ONLY, LISTED SO THEY CAN BE LEFT ALONE.
--     CLAUDE.md carve-out: these were entered per-piece and their prices
--     conflict with their standalone duplicates. Do NOT script or auto-merge
--     that reconciliation. They inherit order_unit='pack' like everything else,
--     so their behaviour is byte-identical to today. Reprice by hand BEFORE
--     enabling pcs mode on any of them (ORDERING_MODEL.md §6.5).
SELECT p.id, p.sku, p.name, p.price, p.quantity_in_unit, p.moq,
       p.order_unit, p.order_step, p.master_id, p.variant_label
FROM public.products p
LEFT JOIN public.product_masters m ON m.id = p.master_id
WHERE p.name ILIKE '%hinged%box%' OR m.name ILIKE '%hinged%box%'
ORDER BY p.master_id NULLS LAST, p.variant_label, p.name;

-- V8. Per-piece sort sanity — only meaningful if [C] was applied.
--     Confirms the generated column tracks price/quantity_in_unit and that the
--     ordering genuinely differs from the pack-price ordering (which is the
--     whole reason the column exists).
SELECT sku, name, price, quantity_in_unit, price_per_piece
FROM public.products
WHERE status = 'published' AND is_active AND price IS NOT NULL AND price > 0
ORDER BY price_per_piece ASC NULLS LAST
LIMIT 20;

-- V9. ⚠ Open question from ORDERING_MODEL.md §7.4 — UNVERIFIED against live.
--     applyPublicSort emits ORDER BY price for guests too, and anon has no
--     SELECT on price. If ORDER BY on an ungranted column raises the same
--     "permission denied" that sql/04:44-48 documents for a WHERE, then a
--     signed-out visitor choosing "Price: Low to High" on /catalog gets a failed
--     query TODAY, independent of this proposal.
--     Expect: ERROR: permission denied for column price  (which CONFIRMS the bug)
--   SET ROLE anon;
--   SELECT id FROM public.products
--    WHERE status = 'published' AND is_active
--    ORDER BY price ASC NULLS LAST LIMIT 1;
--   RESET ROLE;


-- ============================================================================
-- ROLLBACK
--
-- Safe while the application code has NOT yet been deployed. Once a build that
-- selects order_unit/order_step is live, dropping the columns breaks every
-- product query — roll the deploy back first, then run this.
--
-- Dropping a column drops its grants with it; no explicit REVOKE is needed.
-- ============================================================================

-- R1 — undo [C] only (keeps ordering, removes per-piece sorting).
-- BEGIN;
--   DROP INDEX IF EXISTS public.products_price_per_piece_idx;
--   ALTER TABLE public.products DROP COLUMN IF EXISTS price_per_piece;
-- COMMIT;

-- R2 — undo [A]+[B]. Destructive: any order_unit/order_step values an operator
-- has already set are lost. Announce before running (Critical Rule #3).
-- BEGIN;
--   ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_order_step_positive;
--   ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_order_unit_check;
--   ALTER TABLE public.products DROP COLUMN IF EXISTS order_step;
--   ALTER TABLE public.products DROP COLUMN IF EXISTS order_unit;
-- COMMIT;

-- R3 — EMERGENCY: price_per_piece was granted to anon by mistake (V3 showed it).
-- Run this immediately; it closes the price gate without dropping the column.
-- BEGIN;
--   REVOKE SELECT (price_per_piece) ON public.products FROM anon;
-- COMMIT;
-- Then re-run V3 and confirm price_per_piece no longer appears.
-- ============================================================================
