-- ============================================================================
-- 04-price-column-security.sql
--
-- Hides price, mrp, and discount_percent from unauthenticated (anon) users
-- at the PostgreSQL privilege level. Authenticated users retain full access.
--
-- HOW: Supabase grants table-level SELECT to anon by default.
-- Column-level REVOKE has no effect on top of a table-level GRANT.
-- We must REVOKE the table grant first, then re-GRANT column by column.
--
-- GUEST_PRODUCT_COLS in productService.ts must match exactly what is
-- granted here — this file is the source of truth for that list.
--
-- Run once in Supabase SQL Editor. Safe to re-run (idempotent).
-- ============================================================================

-- Step 1: Drop the blanket table-level SELECT from anon
REVOKE SELECT ON public.products FROM anon;

-- Step 2: Grant the exact same columns as GUEST_PRODUCT_COLS in productService.ts
--         (price, mrp, discount_percent deliberately excluded)
GRANT SELECT (
  id,
  name,
  category_id,
  description,
  sku,
  unit_of_measure,
  quantity_in_unit,
  image_url,
  image_alt_text,
  image_description,
  specifications,
  is_active,
  is_featured,
  display_order,
  brand,
  created_at,
  updated_at
) ON public.products TO anon;

-- Step 3: Conditionally grant columns added by untracked migrations.
--         These are safe to expose (not price-related) but may not exist
--         in all DB instances, so we check information_schema first.
--         NOTE: `status` (draft/published) MUST be granted here — the storefront
--         queries filter on status='published', and a WHERE on a column the anon
--         role can't SELECT raises "permission denied". Re-run this file after
--         adding the status column so guests can browse published products.
DO $$
DECLARE
  col TEXT;
BEGIN
  FOREACH col IN ARRAY ARRAY['stock_status', 'tags', 'min_order_qty', 'status'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'products'
        AND column_name  = col
    ) THEN
      EXECUTE format('GRANT SELECT (%I) ON public.products TO anon', col);
      RAISE NOTICE 'Granted SELECT (%) to anon', col;
    ELSE
      RAISE NOTICE 'Column % not found — skipping grant', col;
    END IF;
  END LOOP;
END;
$$;

-- Step 4: Ensure authenticated users keep full SELECT access
GRANT SELECT ON public.products TO authenticated;

-- ============================================================================
-- Verify (run in SQL Editor)
-- ============================================================================
-- 1. Check what anon can see:
SELECT grantee, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_name = 'products'
  AND table_schema = 'public'
  AND grantee = 'anon'
ORDER BY column_name;
-- Expected: every column except price, mrp, discount_percent

-- 2. Quick sanity check — price should NOT appear for anon:
--    SET ROLE anon;
--    SELECT price FROM products LIMIT 1;
--    RESET ROLE;
-- Expected: ERROR: permission denied for column price
-- ============================================================================
