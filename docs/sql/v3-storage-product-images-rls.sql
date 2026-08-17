-- ============================================================================
-- v3-storage-product-images-rls.sql
--
--   Closes the last authorization hole recorded in
--   docs/STOREFRONT_V3_PLAN.md §13.1-F: the `product-images` storage bucket.
--
-- STATUS: EXECUTED against danoeaftaazhbldeeuxj on 17 Aug 2026 by the agent.
--   Before/after behavioural proof: docs/sql/v3-storage-rls-verification.md
--   Logged in docs/CHANGELOG_SQL.md.
--
-- ⚠️ THIS FILE REPLACES EXISTING POLICIES. Owner-authorised for this change
--   only. Every DROP is paired with the CREATE that replaces it in the same
--   transaction, so the bucket is never left unprotected.
--
-- THE HOLE
--   auth_read/upload/update/delete_product_images checked ONLY `bucket_id`, with
--   no is_admin(). Any signed-in customer could therefore write to, overwrite or
--   rename catalogue imagery. Proved as a real non-admin authenticated role
--   before this ran (verification doc §0):
--
--     UPLOAD to product-images    -> SUCCEEDED
--     RENAME an existing image    -> SUCCEEDED (1 row)
--
--   This was the odd one out: `category-images` and `banner-images`, added in
--   V3 Phase 2, were already is_admin()-scoped. product-images predates them.
--
-- SCOPE: authorization only. No bucket setting, no object, no other table.
-- IDEMPOTENT: DROP POLICY IF EXISTS + guarded CREATE. Safe to re-run.
-- ============================================================================

BEGIN;

-- ── Drop the four bucket-only policies ──────────────────────────────────────
DROP POLICY IF EXISTS auth_read_product_images   ON storage.objects;
DROP POLICY IF EXISTS auth_upload_product_images ON storage.objects;
DROP POLICY IF EXISTS auth_update_product_images ON storage.objects;
DROP POLICY IF EXISTS auth_delete_product_images ON storage.objects;

DO $$
BEGIN
  -- READ stays open. The bucket is public, so CDN reads bypass RLS entirely;
  -- this policy governs the authenticated object API, which admin's image
  -- library and the SKU workbench use via .list(). Narrowing it to admin would
  -- break those without protecting anything a public URL does not already
  -- expose.
  IF NOT EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid='storage.objects'::regclass
                   AND polname='public_read_product_images') THEN
    CREATE POLICY public_read_product_images ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'product-images');
  END IF;

  -- WRITES are admin-only, matching category-images and banner-images.
  IF NOT EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid='storage.objects'::regclass
                   AND polname='admin_insert_product_images') THEN
    CREATE POLICY admin_insert_product_images ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'product-images' AND is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid='storage.objects'::regclass
                   AND polname='admin_update_product_images') THEN
    CREATE POLICY admin_update_product_images ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'product-images' AND is_admin())
      WITH CHECK (bucket_id = 'product-images' AND is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid='storage.objects'::regclass
                   AND polname='admin_delete_product_images') THEN
    CREATE POLICY admin_delete_product_images ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'product-images' AND is_admin());
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- NOTE ON VERIFYING DELETE
--
-- Supabase installs a trigger that refuses direct DELETE on storage.objects
-- ("Direct deletion from storage tables is not allowed. Use the Storage API
-- instead."). That trigger fires BEFORE the RLS policy is reached, so the
-- DELETE verb cannot be exercised from SQL at all — for the hole or for the
-- fix. INSERT and UPDATE are provable from SQL and are proved; the DELETE
-- policy is verified by catalog inspection and by the fact that it is written
-- identically to the UPDATE policy that IS proved.
-- ============================================================================

-- ============================================================================
-- ROLLBACK — restores the previous (INSECURE) policies exactly.
-- ============================================================================
-- BEGIN;
--   DROP POLICY IF EXISTS public_read_product_images   ON storage.objects;
--   DROP POLICY IF EXISTS admin_insert_product_images  ON storage.objects;
--   DROP POLICY IF EXISTS admin_update_product_images  ON storage.objects;
--   DROP POLICY IF EXISTS admin_delete_product_images  ON storage.objects;
--   CREATE POLICY auth_read_product_images   ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-images');
--   CREATE POLICY auth_upload_product_images ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
--   CREATE POLICY auth_update_product_images ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images');
--   CREATE POLICY auth_delete_product_images ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images');
-- COMMIT;
-- ============================================================================
