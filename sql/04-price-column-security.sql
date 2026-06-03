-- ============================================================================
-- 04-price-column-security.sql
--
-- Hides price and mrp columns from unauthenticated (anon) users at the
-- PostgreSQL privilege level. Authenticated users retain full SELECT access.
--
-- WHY: Supabase's default setup grants table-level SELECT on all tables to
-- the anon role. Column-level REVOKE only works when revoking from a
-- column-level GRANT. We must therefore:
--   1. REVOKE the table-level SELECT from anon
--   2. Re-GRANT SELECT on every column EXCEPT price and mrp
--
-- Run once in the Supabase SQL Editor. Safe to re-run (idempotent).
-- ============================================================================

-- Step 1: Remove the blanket table-level SELECT from anon
REVOKE SELECT ON public.products FROM anon;

-- Step 2: Grant SELECT on all safe columns (price + mrp deliberately excluded)
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
  created_at,
  updated_at
) ON public.products TO anon;

-- Step 3: Grant extra columns added via migrations (if they exist in your DB).
-- Check your DB columns: SELECT column_name FROM information_schema.columns WHERE table_name = 'products';
-- Then run the relevant lines below:
-- GRANT SELECT (brand)          ON public.products TO anon;
-- GRANT SELECT (stock_status)   ON public.products TO anon;
-- GRANT SELECT (tags)           ON public.products TO anon;
-- GRANT SELECT (min_order_qty)  ON public.products TO anon;
-- NOTE: do NOT grant price, mrp, or discount_percent here.

-- Step 4: Ensure authenticated users keep full SELECT access
GRANT SELECT ON public.products TO authenticated;

-- ============================================================================
-- Verify
-- ============================================================================
-- Run this as anon (use the anon JWT in Supabase API):
--   SELECT id, name, price FROM products LIMIT 1;
-- Expected: error "column products.price does not exist" (or column omitted)
--
-- Run this as authenticated:
--   SELECT id, name, price FROM products LIMIT 1;
-- Expected: row returned with price visible
-- ============================================================================
