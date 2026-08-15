-- ============================================================================
-- v3-phase2-schema.sql
--
--   Storefront V3 — Phase 2 data foundation.
--   Plan: docs/STOREFRONT_V3_PLAN.md  ·  Ordering spec: docs/ORDERING_MODEL.md
--
-- STATUS: EXECUTED against danoeaftaazhbldeeuxj on 15 Aug 2026 by the agent
--   under the Critical Rule #3 standing grant. Verification output for every
--   block is pasted in docs/sql/v3-phase2-verification.md and logged in
--   docs/CHANGELOG_SQL.md.
--
-- SCOPE — ADDITIVE ONLY. There is no DROP, no TRUNCATE, no DELETE, no UPDATE
--   and no ALTER … DROP anywhere in this file. No existing policy is replaced.
--   The three authorization holes recorded in STOREFRONT_V3_PLAN §13.1-F are
--   deliberately NOT touched here — they require replacing existing policies and
--   are owner-authorised as a SEPARATE, dedicated PR (Gate 1, Q3-a).
--
-- BLOCKS
--   [A] products.order_unit + products.order_step (+ CHECKs)      ORDERING_MODEL §1.2
--   [B] grants for [A], plus products.moq to anon                 Gate 1 Q1-a
--   [C] products.price_per_piece generated column + index         ORDERING_MODEL §7.2
--       🔴 NEVER GRANTED TO anon — see the block header.
--   [D] v_category_live_counts view                               PLAN §6
--   [E] promo_banners table + RLS                                 PLAN §9.1
--   [F] storage buckets category-images + banner-images + policies PLAN §5, §9.1
--   [G] site_content 'site_theme' seed                            PLAN §9.2
--   [H] orders.user_id + index + user-scoped read policy         Gate 1 Q2-a
--
-- ORDER OF OPERATIONS — this matters.
--   Run this BEFORE deploying application code that selects the new columns.
--   sql/04-price-column-security.sql revoked anon's table-level SELECT and
--   re-grants per column, so a NEW column is ungranted by default and a guest
--   query naming it fails with "permission denied" — the trap sql/04:44-48
--   documents for `status`. SQL first, merge second.
--
-- IDEMPOTENT: safe to re-run. ADD COLUMN / CREATE TABLE / CREATE INDEX use
--   IF NOT EXISTS; ADD CONSTRAINT and CREATE POLICY have no IF NOT EXISTS in
--   Postgres (Critical Rule #4), so both are guarded by catalog lookups in DO
--   blocks; INSERTs use ON CONFLICT DO NOTHING.
-- ============================================================================


-- ============================================================================
-- [A] + [B] — ordering columns, their CHECKs, and column grants.
--             RUN TOGETHER.
-- ============================================================================
BEGIN;

-- ── [A1] order_unit ─────────────────────────────────────────────────────────
-- How the CUSTOMER counts. Not what is stored, not what is priced.
-- DEFAULT 'pack' IS the entire backfill: every existing row becomes an ordinary
-- pack product without a single statement touching it, which is what makes the
-- byte-identity guarantee (ORDERING_MODEL §5) hold. NOT NULL + DEFAULT does not
-- rewrite the table on PG 11+.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS order_unit TEXT NOT NULL DEFAULT 'pack';

COMMENT ON COLUMN public.products.order_unit IS
  'How the customer counts: pack (default) or pcs. Display/input only — '
  'products.price is ALWAYS the price of one selling unit (CLAUDE.md canonical '
  'unit-of-sale rule) and money is always packs x price. See '
  'docs/ORDERING_MODEL.md.';

-- ── [A2] order_step ─────────────────────────────────────────────────────────
-- Pieces per stepper click when order_unit='pcs'. Deliberately NULLABLE rather
-- than defaulted: NULL means "one pack, whatever quantity_in_unit currently is",
-- so editing a pack size can never leave a stale step behind (ORDERING_MODEL
-- §1.3 — the stale-copy bug).
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
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.products'::regclass
                   AND conname='products_order_unit_check') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_order_unit_check CHECK (order_unit IN ('pack','pcs'));
    RAISE NOTICE 'Added products_order_unit_check';
  ELSE
    RAISE NOTICE 'products_order_unit_check already present — skipping';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.products'::regclass
                   AND conname='products_order_step_positive') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_order_step_positive
      CHECK (order_step IS NULL OR order_step > 0);
    RAISE NOTICE 'Added products_order_step_positive';
  ELSE
    RAISE NOTICE 'products_order_step_positive already present — skipping';
  END IF;
END $$;

-- ── [A4] DELIBERATELY NOT ADDED — do not uncomment without reading §1.6 ─────
-- A cross-column CHECK tying pcs mode to a usable pack quantity reads well and
-- is wrong here: product rows are edited ONE COLUMN AT A TIME (inline cells,
-- the Workbench's one-column image patch), so clearing quantity_in_unit on a
-- pcs row — an ordinary intermediate state during the catalogue rebuild —
-- would return a raw constraint violation to a UI with no handler for it, from
-- a field the operator was not editing. Handled instead in two softer layers:
-- admin validation refuses the switch, and resolveOrderSpec() downgrades an
-- impossible pcs row to pack mode.
--
--   ALTER TABLE public.products ADD CONSTRAINT products_pcs_needs_pack_qty
--     CHECK (order_unit = 'pack' OR quantity_in_unit IS NOT NULL);

-- ── [B1] Grants for the two ordering columns ────────────────────────────────
-- MANDATORY. Neither column is derived from price, so neither weakens the B2B
-- price gate (Architecture Rule #3). Contrast [C], which is derived and is not
-- granted.
GRANT SELECT (order_unit, order_step) ON public.products TO anon;

-- ── [B2] moq to anon — Gate 1, Q1-a ─────────────────────────────────────────
-- The V3 product card shows an MOQ chip in EVERY auth state, and the frozen
-- prototype states "MOQ shown on every card". Until now anon had no SELECT on
-- moq, so ProductCard's spec line silently rendered without it for guests
-- (STOREFRONT_V3_PLAN §3.3).
--
-- Why this does not weaken the price gate: moq is a QUANTITY (a count of
-- selling units), not a price and not derived from one. Unlike price_per_piece
-- — which multiplied by the already-readable quantity_in_unit reconstructs the
-- wholesale price exactly — there is no arithmetic that turns a minimum order
-- quantity into a rate. price, mrp, discount_percent and price_per_piece all
-- remain ungranted.
GRANT SELECT (moq) ON public.products TO anon;

-- authenticated holds a table-level SELECT (sql/04 step 4), which automatically
-- covers new columns. Re-asserted so re-running this file suffices on a fresh
-- instance.
GRANT SELECT ON public.products TO authenticated;

COMMIT;


-- ============================================================================
-- [C] Per-piece sort support.
--
-- 🔴 SECURITY — READ BEFORE RUNNING
--    price_per_piece is DERIVED FROM price. anon can already read
--    quantity_in_unit (sql/04:29), so a granted per-piece rate multiplied by
--    the pack size reconstructs the exact wholesale price — a total bypass of
--    the B2B price gate that Architecture Rule #3 makes column grants
--    responsible for.
--
--    THIS COLUMN MUST NEVER BE GRANTED TO anon.
--    There is no GRANT for it below, and because sql/04 revoked the blanket
--    table grant, a new column is ungranted BY DEFAULT — the failure mode is
--    closed, not open. Do not "fix" a guest permission error by granting it;
--    the fix is for guests not to sort by price. It must also stay OUT of the
--    guest column list in the client.
-- ============================================================================
BEGIN;

-- The CASE mirrors lib/priceUtils.ts isPriceOnEnquiry(): NULL and <= 0 both
-- mean "no price", so both sort as NULL and land last under
-- .order(..., { nullsFirst: false }) — matching how the pack-price sort already
-- behaves. A product with no usable pack quantity keeps its pack figure rather
-- than dropping out of the ordering entirely.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_per_piece NUMERIC
  GENERATED ALWAYS AS (
    CASE
      WHEN price IS NULL OR price <= 0                       THEN NULL
      WHEN quantity_in_unit IS NULL OR quantity_in_unit <= 0 THEN price::numeric
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
-- [D] v_category_live_counts — the ONE category-count rule.  PLAN §6
--
-- A category's count is the number of products that are published AND active.
-- Defining it in SQL keeps it from being re-implemented per component, the same
-- discipline v_product_health establishes (Architecture Rule #2), and replaces
-- a client-side aggregation that selected EVERY category_id row and ignored the
-- publish gate entirely (productService.ts:97-109).
--
-- Note this view is intentionally NOT security_barrier / security_definer: it
-- reads public.products, so the caller's own RLS applies. anon therefore counts
-- exactly the rows anon can see, which is the same publish gate the WHERE
-- clause states.
-- ============================================================================
BEGIN;

CREATE OR REPLACE VIEW public.v_category_live_counts AS
  SELECT category_id,
         COUNT(*)::int AS live_products
  FROM public.products
  WHERE status = 'published' AND is_active
  GROUP BY category_id;

COMMENT ON VIEW public.v_category_live_counts IS
  'Single source of truth for storefront category counts: products that are '
  'published AND active, per category. A category with no row here has zero '
  'live products and must not be rendered (docs/STOREFRONT_V3_PLAN.md §6).';

GRANT SELECT ON public.v_category_live_counts TO anon, authenticated;

COMMIT;


-- ============================================================================
-- [E] promo_banners — owner-controlled storefront banners.  PLAN §9.1
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.promo_banners (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url    text,
  headline     text NOT NULL,
  rate_line    text,
  link_target  text,
  position     text NOT NULL DEFAULT 'home_top',
  is_active    boolean NOT NULL DEFAULT false,
  sort_order   integer NOT NULL DEFAULT 0,
  starts_at    timestamptz,
  ends_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.promo_banners.rate_line IS
  'FREE TEXT ONLY — never a computed or looked-up price. Banners render to '
  'signed-out visitors, so a derived rate here would bypass the B2B price gate. '
  'The admin types a marketing line or leaves it empty.';
COMMENT ON COLUMN public.promo_banners.is_active IS
  'Defaults to FALSE so a newly created banner is never live by accident.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.promo_banners'::regclass
                   AND conname='promo_banners_position_check') THEN
    ALTER TABLE public.promo_banners
      ADD CONSTRAINT promo_banners_position_check
      CHECK (position IN ('home_top','home_mid','category_top'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.promo_banners'::regclass
                   AND conname='promo_banners_window_check') THEN
    ALTER TABLE public.promo_banners
      ADD CONSTRAINT promo_banners_window_check
      CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS promo_banners_active_idx
  ON public.promo_banners (position, sort_order)
  WHERE is_active;

ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY;

-- Public read is scheduled: active AND inside its date window (NULL = open).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid='public.promo_banners'::regclass
                   AND polname='public_read_live_banners') THEN
    CREATE POLICY public_read_live_banners ON public.promo_banners
      FOR SELECT TO anon, authenticated
      USING (
        is_active
        AND (starts_at IS NULL OR now() >= starts_at)
        AND (ends_at   IS NULL OR now() <  ends_at)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid='public.promo_banners'::regclass
                   AND polname='admins_manage_banners') THEN
    CREATE POLICY admins_manage_banners ON public.promo_banners
      FOR ALL USING (is_admin()) WITH CHECK (is_admin());
  END IF;
END $$;

COMMIT;


-- ============================================================================
-- [F] Storage buckets: category-images, banner-images.  PLAN §5, §9.1
--
-- category-images is referenced by AdminCategories.tsx:53 and
-- MobileCategorySheet TODAY but has never existed, so every category image
-- upload currently throws. The path convention below is exactly what that code
-- already writes, so no client change is required.
--
-- Writes are scoped to is_admin() — NOT to `authenticated`. The existing
-- product-images policies grant all four verbs to any authenticated user, which
-- is the same class of hole recorded in STOREFRONT_V3_PLAN §13.1-F; it is
-- listed there for the dedicated authorization PR rather than repeated here.
-- ============================================================================
BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('category-images', 'category-images', true),
       ('banner-images',   'banner-images',   true)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  b TEXT;
BEGIN
  FOREACH b IN ARRAY ARRAY['category-images','banner-images'] LOOP
    -- Public read. The buckets are public, so object reads are served without
    -- consulting RLS; this policy makes the intent explicit and covers any
    -- client that goes through the authenticated object API.
    IF NOT EXISTS (SELECT 1 FROM pg_policy
                   WHERE polrelid='storage.objects'::regclass
                     AND polname='public_read_'||replace(b,'-','_')) THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR SELECT TO anon, authenticated '
        'USING (bucket_id = %L)', 'public_read_'||replace(b,'-','_'), b);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy
                   WHERE polrelid='storage.objects'::regclass
                     AND polname='admin_insert_'||replace(b,'-','_')) THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated '
        'WITH CHECK (bucket_id = %L AND is_admin())',
        'admin_insert_'||replace(b,'-','_'), b);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy
                   WHERE polrelid='storage.objects'::regclass
                     AND polname='admin_update_'||replace(b,'-','_')) THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated '
        'USING (bucket_id = %L AND is_admin()) '
        'WITH CHECK (bucket_id = %L AND is_admin())',
        'admin_update_'||replace(b,'-','_'), b, b);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy
                   WHERE polrelid='storage.objects'::regclass
                     AND polname='admin_delete_'||replace(b,'-','_')) THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated '
        'USING (bucket_id = %L AND is_admin())',
        'admin_delete_'||replace(b,'-','_'), b);
    END IF;
  END LOOP;
END $$;

COMMIT;


-- ============================================================================
-- [G] site_theme setting.  PLAN §9.2
--
-- ONE setting, five values, changing ONLY an accent colour and the hero
-- gradient — never layout, never prices. Enforced by construction on the client:
-- the value becomes a data-attribute on <html> that swaps CSS custom
-- properties, and no component ever reads it, so there is no scope in which a
-- theme value could influence a layout or price decision.
--
-- ON CONFLICT DO NOTHING: never overwrite a theme the owner has already chosen.
-- ============================================================================
BEGIN;

INSERT INTO public.site_content (key, value)
VALUES ('site_theme', '{"theme":"default"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMIT;


-- ============================================================================
-- [H] orders.user_id — the data model reorder needs.  Gate 1, Q2-a
--
-- STOREFRONT_V3_PLAN §13.1-E: "Reorder from past orders" was listed as settled,
-- but `orders` had no user column and no order-history UI exists anywhere, so
-- there was nothing to keep. This adds the column now — additive and cheap
-- today, expensive to backfill later once real orders exist.
--
-- ON DELETE SET NULL, and NULLABLE: guest checkout is a real path today
-- ("Anyone can place orders" WITH CHECK true), and the two existing rows have
-- no user to attribute. A NULL user_id means "placed without an account".
--
-- ⚠️ READ THIS BEFORE ASSUMING THE POLICY BELOW RESTRICTS ANYTHING.
--   RLS policies are OR-ed. The existing "Authenticated users can read orders"
--   policy is USING (auth.role() = 'authenticated') — i.e. every signed-in user
--   can already read every order. Adding a narrower policy CANNOT take
--   privileges away; it only widens. `users_read_own_orders` therefore has NO
--   restrictive effect until that broad policy is replaced, which happens in the
--   dedicated authorization PR (Gate 1, Q3-a). It is created here so the schema
--   half is complete and the intent is recorded — not because it secures
--   anything yet. Do not read its presence as the hole being closed.
-- ============================================================================
BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.orders.user_id IS
  'Who placed the order. NULL = placed without an account (guest checkout is '
  'still permitted). Backs order history / reorder. NOTE: the user-scoped read '
  'policy is OR-ed with a broad authenticated-read policy and does not restrict '
  'anything until that one is replaced — see docs/STOREFRONT_V3_PLAN.md §13.1-F.';

CREATE INDEX IF NOT EXISTS orders_user_id_created_idx
  ON public.orders (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid='public.orders'::regclass
                   AND polname='users_read_own_orders') THEN
    CREATE POLICY users_read_own_orders ON public.orders
      FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR is_admin());
  END IF;
END $$;

COMMIT;


-- ============================================================================
-- NOT IN THIS FILE — recorded so the absence is deliberate, not an oversight
-- ============================================================================
-- * product_masters / product_master_images RLS: VERIFIED, NOT CHANGED.
--   STOREFRONT_V3_PLAN §13.1-D found the hole described in the original brief
--   is ALREADY FIXED on the live database (both tables carry
--   "Admins can manage …" USING is_admin() WITH CHECK is_admin(), plus a
--   read policy for active rows). Verification output is in
--   docs/sql/v3-phase2-verification.md §V8. No statement was run against them.
--
-- * The three authorization holes (orders/order_items, inquiries, site_content)
--   and the product-images storage policies: NOT touched. Fixing them means
--   REPLACING existing policies; owner-authorised as a separate, dedicated PR
--   (Gate 1, Q3-a) that must not be batched with schema work.
--
-- * No MRP / price public-read migration. Guests see no price at all, so anon
--   needs no price-related grant whatsoever.
--
-- * No UPDATE anywhere — in particular nothing touches the 11 Hinged box rows
--   (CLAUDE.md carve-out). They inherit order_unit='pack' from the DEFAULT like
--   every other row, so their behaviour is byte-identical to before this file.


-- ============================================================================
-- ROLLBACK — destructive; announce before running (Critical Rule #3).
-- Safe only while application code that reads these objects is NOT deployed.
-- Dropping a column drops its grants with it; no explicit REVOKE is needed.
-- ============================================================================
-- R1 — per-piece sorting only:
--   BEGIN;
--     DROP INDEX IF EXISTS public.products_price_per_piece_idx;
--     ALTER TABLE public.products DROP COLUMN IF EXISTS price_per_piece;
--   COMMIT;
--
-- R2 — ordering columns. Loses any order_unit/order_step an operator has set:
--   BEGIN;
--     ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_order_step_positive;
--     ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_order_unit_check;
--     ALTER TABLE public.products DROP COLUMN IF EXISTS order_step;
--     ALTER TABLE public.products DROP COLUMN IF EXISTS order_unit;
--   COMMIT;
--
-- R3 — EMERGENCY: price_per_piece was granted to anon by mistake (V3 shows it).
--   Closes the price gate without dropping the column:
--   BEGIN; REVOKE SELECT (price_per_piece) ON public.products FROM anon; COMMIT;
--   Then re-run V3 and confirm price_per_piece no longer appears.
--
-- R4 — revoke the moq grant (Gate 1 Q1 reversal):
--   BEGIN; REVOKE SELECT (moq) ON public.products FROM anon; COMMIT;
--
-- R5 — banners / view / theme:
--   BEGIN;
--     DROP VIEW  IF EXISTS public.v_category_live_counts;
--     DROP TABLE IF EXISTS public.promo_banners;
--     DELETE FROM public.site_content WHERE key = 'site_theme';
--   COMMIT;
-- ============================================================================
