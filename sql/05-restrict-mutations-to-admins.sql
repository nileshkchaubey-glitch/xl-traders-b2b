-- ============================================================================
-- 05-restrict-mutations-to-admins.sql
--
-- SECURITY FIX: Restrict product/category mutations to admin users only.
--
-- PROBLEM: The existing RLS policies in 02-public-read-policies.sql grant
-- ALL operations (INSERT/UPDATE/DELETE) to the `authenticated` role with no
-- restrictions. This means any logged-in user (not just admins) can modify
-- products and categories by crafting direct Supabase REST API calls,
-- bypassing the client-side admin check in authStore.ts.
--
-- FIX: Replace the overly permissive "FOR ALL" policy with one that checks
-- the user's is_admin flag in user_profiles before allowing mutations.
--
-- Run in Supabase SQL Editor. Safe to re-run (idempotent).
-- ============================================================================

-- Step 1: Drop the overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can manage products"  ON public.products;
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON public.categories;

-- Step 2: Create admin-only mutation policies for products
CREATE POLICY "Admins can manage products"
  ON public.products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND is_admin = true
    )
  );

-- Step 3: Create admin-only mutation policies for categories
CREATE POLICY "Admins can manage categories"
  ON public.categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND is_admin = true
    )
  );

-- NOTE: The read policies from 02-public-read-policies.sql remain unchanged.
-- Anon and authenticated users can still SELECT active products/categories.
-- Only INSERT/UPDATE/DELETE are now restricted to admins.
