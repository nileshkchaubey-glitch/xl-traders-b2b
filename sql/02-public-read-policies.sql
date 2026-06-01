-- ============================================================================
-- 02-public-read-policies.sql
--
-- Grants anonymous (unauthenticated) users SELECT access to active products
-- and active categories. Run this in the Supabase SQL editor if the catalog
-- shows 0 products or the anon role is blocked by RLS.
--
-- Safe to run multiple times (CREATE POLICY IF NOT EXISTS).
-- ============================================================================

-- Enable RLS on both tables if not already enabled
ALTER TABLE public.products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- DROP existing conflicting policies (idempotent re-run)
DROP POLICY IF EXISTS "Public can read active products"  ON public.products;
DROP POLICY IF EXISTS "Public can read active categories" ON public.categories;

-- Allow anyone (including anon) to read active products
CREATE POLICY "Public can read active products"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Allow anyone (including anon) to read active categories
CREATE POLICY "Public can read active categories"
  ON public.categories
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Authenticated (logged-in admin) users need full access — ensure they can
-- still INSERT / UPDATE / DELETE their own rows. These complement the above.
DROP POLICY IF EXISTS "Authenticated users can manage products"  ON public.products;
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON public.categories;

CREATE POLICY "Authenticated users can manage products"
  ON public.products
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage categories"
  ON public.categories
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
