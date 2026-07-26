-- ============================================================================
-- PR-1 ROLLBACK — restores the pre-PR-1 state exactly
-- ============================================================================
-- Project : danoeaftaazhbldeeuxj (XL Traders B2B)
-- Pairs with: docs/sql/pr1-rls-publish-gate.sql
-- Date    : 25 Jul 2026
--
-- PROVENANCE — this is not reconstructed from memory.
--   Every policy expression, role and command below was read out of the live
--   database on 25 Jul 2026 via:
--       select policyname, permissive, roles, cmd, qual, with_check
--         from pg_policies where tablename in ('products','objects');
--   The view body came from pg_get_viewdef('public.products_public', true) and
--   the grants from information_schema.role_table_grants.
--
-- HOW TO USE
--   You do NOT normally run this whole file. Each statement is labelled Rn and
--   maps to the statement number in pr1-rls-publish-gate.sql that it undoes.
--   Run only the ones you need, in reverse order of what you applied.
--
--   If you only need to undo the storage change (the one with real blast
--   radius), that is R9 — it is self-contained and safe to run alone.
--
-- ⚠️  This file restores the ORIGINAL state, which includes the security holes
--     PR-1 was written to close. Statements that re-open a hole are marked
--     [RE-OPENS HOLE]. That is intentional: a rollback should return you to a
--     known state, not to a half-applied one.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- R9 — Storage SELECT policy   (undoes statement 10)
-- ----------------------------------------------------------------------------
-- RUN THIS FIRST if storefront images stopped loading for logged-out visitors.
-- It is independent of everything else in this file.
DROP POLICY IF EXISTS "auth_read_product_images" ON storage.objects;

CREATE POLICY "public_read_product_images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'product-images');


-- ----------------------------------------------------------------------------
-- R8 — Storage duplicate policies   (undoes statements 8 and 9)
-- ----------------------------------------------------------------------------
-- Restores the four `xl_`-prefixed duplicates. These were exact copies of the
-- unprefixed policies, so restoring them changes no effective permission —
-- it only puts the "2 broad SELECT policies" dashboard warning back.
-- You almost certainly do not need this. Included for exactness.
CREATE POLICY "xl_public_read_product_images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

CREATE POLICY "xl_auth_upload_product_images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "xl_auth_update_product_images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "xl_auth_delete_product_images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');


-- ----------------------------------------------------------------------------
-- R7 — products_public view   (undoes statement 7)
-- ----------------------------------------------------------------------------
-- Exact body as returned by pg_get_viewdef() before the drop. Note it has no
-- security_invoker option, matching the original (i.e. it bypasses RLS).
CREATE VIEW public.products_public AS
 SELECT id,
    name,
    slug,
    meta_title,
    meta_description,
    category_id,
    description,
    image_url,
    is_active,
    brand,
    quantity_in_unit,
    unit_of_measure,
    NULL::numeric AS price,
    NULL::numeric AS mrp,
    NULL::numeric AS bulk_price,
    NULL::integer AS bulk_threshold
   FROM products
  WHERE is_active = true;

-- [RE-OPENS HOLE] Original grants: anon, authenticated, postgres and
-- service_role each held DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE
-- and UPDATE on this view. Restoring the write grants to anon/authenticated is
-- what made the auto-updatable view a concern in the first place.
-- Restore SELECT (harmless, and all the view was ever used for in principle):
GRANT SELECT ON public.products_public TO anon, authenticated, service_role;

-- Uncomment ONLY if you need byte-for-byte parity with the original state:
-- GRANT INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
--   ON public.products_public TO anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- R6 — products INSERT   (undoes statement 6)
-- ----------------------------------------------------------------------------
-- [RE-OPENS HOLE] Lets any authenticated user insert products.
CREATE POLICY "auth_insert_products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- ----------------------------------------------------------------------------
-- R5 — products DELETE   (undoes statement 5)
-- ----------------------------------------------------------------------------
-- [RE-OPENS HOLE] Lets any authenticated user delete any product.
CREATE POLICY "auth_delete_products"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (true);


-- ----------------------------------------------------------------------------
-- R4 — products UPDATE   (undoes statement 4)
-- ----------------------------------------------------------------------------
-- [RE-OPENS HOLE] Lets any authenticated user update any product.
CREATE POLICY "auth_update_products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (true);


-- ----------------------------------------------------------------------------
-- R3 — authenticated SELECT   (undoes statement 3)
-- ----------------------------------------------------------------------------
-- [RE-OPENS HOLE] Lets any authenticated user read every draft.
DROP POLICY IF EXISTS "auth_read_published_products" ON public.products;

CREATE POLICY "auth_read_products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (true);


-- ----------------------------------------------------------------------------
-- R2 — anonymous SELECT   (undoes statement 2)
-- ----------------------------------------------------------------------------
-- [RE-OPENS HOLE] Lets anonymous clients read drafts via the API.
DROP POLICY IF EXISTS "anon_read_published_products" ON public.products;

CREATE POLICY "anon_read_products"
  ON public.products
  FOR SELECT
  TO anon
  USING (is_active = true);


-- ----------------------------------------------------------------------------
-- R1 — the {public} catch-all SELECT   (undoes statement 1)
-- ----------------------------------------------------------------------------
-- [RE-OPENS HOLE] Role `public` covers anon AND authenticated, so this single
-- policy is what defeated every tighter rule before PR-1.
CREATE POLICY "Anyone can read active products"
  ON public.products
  FOR SELECT
  TO public
  USING (is_active = true);


-- ============================================================================
-- NOT TOUCHED by PR-1, so nothing to roll back:
--   "Admins can manage products"  ON public.products  ({public}, ALL, is_admin())
--   "auth_upload_product_images"  ON storage.objects
--   "auth_update_product_images"  ON storage.objects
--   "auth_delete_product_images"  ON storage.objects
-- ============================================================================
