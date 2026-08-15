-- ============================================================================
-- 02-public-read-policies.sql
--
-- ⛔ SUPERSEDED — DO NOT RUN. Kept only as a record of what was executed in
--    2025. Verified against the live database on 15 Aug 2026.
--
-- WHY IT MUST NOT BE RUN AGAIN
--   The policy below is `USING (is_active = true)` with NO status check. The
--   live database no longer has it: product reads now go through
--   `anon_read_published_products` USING (is_active AND status='published').
--
--   RLS policies are **OR-ed**. Re-running this file would ADD a second, wider
--   policy alongside that one — and because a row only needs ONE policy to
--   permit it, every DRAFT product would immediately become readable by
--   anonymous users. That silently defeats the publish gate (Critical Rule #12)
--   sitewide, with no error and no visible failure.
--
--   The header below used to invite exactly that ("run this if the catalog
--   shows 0 products"). If the catalogue is empty, check `status='published'`
--   on the rows and the grants in sql/04-price-column-security.sql instead.
--
-- ALSO WRONG IN THE ORIGINAL HEADER
--   It claimed idempotency via `CREATE POLICY IF NOT EXISTS`, which is not
--   valid Postgres (CLAUDE.md Critical Rule #4). The body actually uses
--   DROP + CREATE — which is what makes re-running it destructive rather than
--   merely redundant.
--
-- See docs/STOREFRONT_V3_PLAN.md §13.1-G.
-- ============================================================================
-- ORIGINAL HEADER, for the record:
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
