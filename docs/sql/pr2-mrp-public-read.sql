-- ============================================================================
-- Storefront redesign (Direction B "Rate Card") — make MRP publicly readable
--
--   OWNER-RUN. Not applied by the agent. Review before running.
--
-- WHY
-- The locked design's pricing rule is:  signed out → MRP,  signed in → wholesale.
-- `products.mrp` already exists (numeric, nullable), but the `anon` role holds
-- only INSERT / UPDATE / REFERENCES on it — no SELECT. A signed-out visitor
-- therefore cannot read MRP at all, and every product resolves to the amber
-- "On enquiry" state.
--
-- PostgREST fails the WHOLE query when a requested column is not readable, so
-- the app does NOT ask for `mrp` as anon until this file has been applied. That
-- is gated by one constant:
--
--     client/src/lib/productService.ts  →  export const MRP_PUBLIC_READ = false;
--
-- AFTER running this file, flip that constant to `true` and redeploy. Doing it
-- in the other order would blank the storefront for every signed-out visitor.
--
-- SECURITY NOTE
-- This deliberately does NOT touch `price`. Wholesale pricing stays invisible to
-- anon, enforced where it has always been enforced — column-level grants, not
-- TypeScript (CLAUDE.md Architecture Rule #3). MRP is public information by
-- definition; wholesale is not.
-- ============================================================================

BEGIN;

-- [1] Provenance for the MRP figure. Nullable and unconstrained by default so
--     existing rows stay valid; the storefront reads it but does not render it
--     yet. 'printed'  = printed on the pack / price list
--         'supplier' = supplied by the manufacturer
--         'derived'  = computed from a known margin
--         'estimated'= owner's estimate, treat as soft
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS mrp_source TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_mrp_source_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_mrp_source_check
      CHECK (mrp_source IS NULL OR mrp_source IN
             ('printed','supplier','derived','estimated'));
  END IF;
END $$;

-- [2] The grant this file exists for.
GRANT SELECT (mrp, mrp_source) ON public.products TO anon;

-- `authenticated` already has SELECT on mrp; add mrp_source for parity so the
-- admin surfaces can read it back.
GRANT SELECT (mrp_source) ON public.products TO authenticated;
GRANT INSERT (mrp_source), UPDATE (mrp_source) ON public.products TO authenticated;

COMMIT;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Expect one row per privilege; anon must show SELECT on BOTH mrp and mrp_source.
--
--   SELECT grantee, privilege_type, column_name
--   FROM information_schema.column_privileges
--   WHERE table_schema='public' AND table_name='products'
--     AND column_name IN ('mrp','mrp_source') AND grantee='anon'
--   ORDER BY column_name, privilege_type;
--
-- Confirm `price` is still NOT readable by anon (this must return no SELECT row):
--
--   SELECT grantee, privilege_type FROM information_schema.column_privileges
--   WHERE table_schema='public' AND table_name='products'
--     AND column_name='price' AND grantee='anon';

-- ── Rollback ────────────────────────────────────────────────────────────────
--   REVOKE SELECT (mrp, mrp_source) ON public.products FROM anon;
--   ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_mrp_source_check;
--   ALTER TABLE public.products DROP COLUMN IF EXISTS mrp_source;
-- (and set MRP_PUBLIC_READ back to false)

-- ============================================================================
-- THE DATA GAP — read this before expecting prices to appear
-- ============================================================================
-- Measured 2026-08-05 against the live database:
--
--   total products ........................... 143
--   published + active ....................... 139
--   mrp IS NOT NULL .......................... 14
--   mrp IS NOT NULL AND mrp > 0 (usable) ..... 6
--
-- So even with the grant in place, 137 of 143 products will still show
-- "On enquiry" to signed-out visitors, because there is no MRP to show. That
-- is the honest render — `isPriceOnEnquiry()` remains the single gate and a
-- missing MRP is never substituted with the wholesale price or with ₹0.
--
-- Filling that in is a data task, not a code one. To see which rows need it:
--
--   SELECT sku, name, price, mrp
--   FROM products
--   WHERE status='published' AND is_active
--     AND (mrp IS NULL OR mrp <= 0)
--   ORDER BY name;
--
-- Do NOT bulk-derive MRP from `price` with a fixed margin: that would publish a
-- fabricated "maximum retail price", which is exactly the kind of invented
-- figure this design refuses to render.
