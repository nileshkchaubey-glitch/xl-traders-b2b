-- ============================================================================
-- PR-1 — Publish gate in RLS + write hardening
-- ============================================================================
-- Project : danoeaftaazhbldeeuxj (XL Traders B2B)
-- Author  : prepared by Claude Code; RUN BY THE OWNER in the Supabase SQL Editor
-- Date    : 25 Jul 2026
-- Rollback: docs/sql/pr1-rollback.sql  (read it BEFORE you start)
--
-- HOW TO RUN
--   Statements are numbered and independent. Run them ONE AT A TIME, in order,
--   and read the note above each one. Statements 1-9 are low risk. Statement 10
--   is the only one that could affect what anonymous visitors can see, and it
--   has its own pre-flight test — do not run it blind.
--
-- WHAT THIS FIXES
--   Today anonymous SELECT on `products` checks `is_active` only. The
--   `status = 'published'` gate exists solely in ~6 TypeScript call sites in
--   client/src/lib/productService.ts, so anything that talks to PostgREST
--   directly can read drafts. This moves the gate into the database.
--
-- PRECONDITION (verified by the owner before this file was written)
--   is_admin() reads public.user_profiles.is_admin, and the owner's row
--   (ae077e2b-c451-439d-8074-fe5b35bc94d0) is true. Without that, statements
--   4 and 6-8 would lock the owner out of their own admin.
--
-- NOTE ON `CREATE POLICY IF NOT EXISTS`
--   That syntax is not valid PostgreSQL (CLAUDE.md critical rule #4). Every
--   statement below is a plain DROP POLICY / CREATE POLICY pair.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- SECTION 1 — Publish gate on products SELECT            (scope item 1)
-- ----------------------------------------------------------------------------
-- Three PERMISSIVE SELECT policies currently exist on `products`. PERMISSIVE
-- policies are OR-ed together, so the most permissive one wins:
--
--   "Anyone can read active products"  {public}         USING (is_active = true)
--   "anon_read_products"               {anon}           USING (is_active = true)
--   "auth_read_products"               {authenticated}  USING (true)
--
-- All three must be dealt with together. Fixing only one changes nothing,
-- because the others still grant the access.
--
-- `Admins can manage products` ({public}, FOR ALL, USING is_admin()) is left
-- untouched throughout this file. A FOR ALL policy also applies to SELECT, so
-- it is what keeps admin access to drafts working after these changes.


-- [1] Drop the catch-all. Its role is `public`, which covers BOTH anon and
--     authenticated, so it silently defeats any tighter policy on either role.
--     Anonymous read is re-established by statement 2, authenticated read by
--     statement 3 — do not stop between here and statement 3.
DROP POLICY "Anyone can read active products" ON public.products;


-- [2] Anonymous visitors: published + active only. This is the actual fix —
--     drafts stop being readable through the API.
DROP POLICY "anon_read_products" ON public.products;

CREATE POLICY "anon_read_published_products"
  ON public.products
  FOR SELECT
  TO anon
  USING (is_active = true AND status = 'published');


-- [3] Signed-in users: same published-only rule, EXCEPT admins.
--     This closes a hole that is arguably worse than the anonymous one: today
--     `auth_read_products` is USING (true), so any B2B customer who registers
--     can read every draft. Admins keep full read access via is_admin().
DROP POLICY "auth_read_products" ON public.products;

CREATE POLICY "auth_read_published_products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING ((is_active = true AND status = 'published') OR is_admin());


-- ----------------------------------------------------------------------------
-- SECTION 2 — Write hardening on products                (scope item 2)
-- ----------------------------------------------------------------------------
-- `auth_update_products` and `auth_delete_products` are USING (true) for the
-- `authenticated` role: any registered customer can edit or delete any product.
--
-- These are DROPped rather than replaced. Admin writes continue to work through
-- the existing `Admins can manage products` policy ({public}, FOR ALL,
-- USING is_admin()) — a FOR ALL policy covers INSERT/UPDATE/DELETE/SELECT, and
-- when WITH CHECK is omitted PostgreSQL reuses the USING expression for it.
-- Replacing them with is_admin() copies would be redundant with that policy.


-- [4] Remove customer UPDATE access.
DROP POLICY "auth_update_products" ON public.products;


-- [5] Remove customer DELETE access.
DROP POLICY "auth_delete_products" ON public.products;


-- [6] ── BEYOND THE LITERAL SCOPE — read this one before running ─────────────
--     `auth_insert_products` is WITH CHECK (true), so any registered customer
--     can also INSERT products. The approved scope named only update/delete,
--     but closing those two while leaving INSERT open is a half-fix: a customer
--     could still write junk rows into the catalogue.
--     Skip this statement if you'd rather handle INSERT separately.
DROP POLICY "auth_insert_products" ON public.products;


-- ----------------------------------------------------------------------------
-- SECTION 3 — Drop the dead products_public view         (scope item 3)
-- ----------------------------------------------------------------------------
-- Re-verified for this PR: ZERO references to `products_public` anywhere under
-- client/. Nothing in the application reads it.
--
-- RECOMMENDATION: DROP, do not fix. Reasons, in order:
--
--   1. Its only job was hiding price columns. That is already enforced far more
--      robustly by column-level SELECT grants on `products` — anon simply has
--      no grant on price/mrp/moq/barcode/bulk_price/bulk_threshold.
--   2. It filters `is_active` only, with no status check, so it is a second
--      and WRONG definition of "what the public may see". Keeping a corrected
--      copy means maintaining two gates that can drift apart. One gate is safer.
--   3. It is owned by postgres with no `security_invoker`, so it reads the base
--      table with the owner's privileges and bypasses RLS on `products` —
--      including the policies this file just tightened.
--   4. anon AND authenticated both hold INSERT/UPDATE/DELETE grants on it, and
--      it is a simple auto-updatable view. NOT VERIFIED: I did not attempt a
--      write, so I cannot confirm this is exploitable in practice — but there
--      is no reason for those grants to exist either way.
--
-- If a delivery read model is wanted later, recreate it deliberately WITH
-- (security_invoker = true) so it respects RLS rather than bypassing it.

-- [7] Drop the view (this also drops its grants).
DROP VIEW IF EXISTS public.products_public;


-- ----------------------------------------------------------------------------
-- SECTION 4 — Storage: duplicate policies                (scope item 4, part 1)
-- ----------------------------------------------------------------------------
-- WHAT THE DASHBOARD WARNING IS ABOUT
--   storage.objects has EIGHT policies that form four exact duplicate pairs —
--   each one exists twice, once plain and once with an `xl_` prefix, with
--   identical role, command and expression:
--
--     public_read_product_images / xl_public_read_product_images
--        {public}         SELECT  USING (bucket_id = 'product-images')
--     auth_upload_product_images / xl_auth_upload_product_images
--        {authenticated}  INSERT  WITH CHECK (bucket_id = 'product-images')
--     auth_update_product_images / xl_auth_update_product_images
--        {authenticated}  UPDATE  USING (bucket_id = 'product-images')
--     auth_delete_product_images / xl_auth_delete_product_images
--        {authenticated}  DELETE  USING (bucket_id = 'product-images')
--
--   The "2 broad SELECT policies" in the warning are the first pair.
--
-- Statements 8 and 9 remove only the `xl_`-prefixed duplicates. Because
-- PERMISSIVE policies are OR-ed and each pair is identical, this changes NO
-- effective permission — it just stops the same rule being evaluated twice, and
-- takes the SELECT-policy count from 2 to 1. Zero risk.

-- [8] Remove the duplicate SELECT policy. This is the statement that actually
--     answers the dashboard warning.
DROP POLICY "xl_public_read_product_images" ON storage.objects;

-- [9] Remove the three remaining write duplicates (housekeeping, no
--     permission change — the unprefixed twins remain in force).
DROP POLICY "xl_auth_upload_product_images" ON storage.objects;
DROP POLICY "xl_auth_update_product_images" ON storage.objects;
DROP POLICY "xl_auth_delete_product_images" ON storage.objects;


-- ----------------------------------------------------------------------------
-- SECTION 5 — Storage: stop anonymous file enumeration   (scope item 4, part 2)
-- ----------------------------------------------------------------------------
-- ⚠️  THIS IS THE ONLY STATEMENT IN THIS FILE THAT CAN AFFECT WHAT ANONYMOUS
--     VISITORS SEE ON THE STOREFRONT. Run it last, and run the pre-flight and
--     post-check below.
--
-- WHAT IT DOES
--   The surviving SELECT policy is {public}, so an anonymous client can call
--   storage.from('product-images').list() and enumerate every file in the
--   bucket — currently 256 objects, including 240 unlinked Decoration & Party
--   images that are not attached to any product. This narrows the policy to
--   `authenticated`.
--
-- WHY DISPLAYING IMAGES SHOULD STILL WORK
--   The `product-images` bucket is PUBLIC (storage.buckets.public = true).
--   Public buckets serve object CONTENT over /storage/v1/object/public/<path>
--   without authentication and without consulting RLS on storage.objects.
--   RLS governs the metadata operations — list(), upload, update, delete.
--   The storefront only ever renders <img src="…/object/public/…">; those URLs
--   are built client-side by getPublicUrl(), which is pure string construction
--   and makes no API call.
--
--   The ONLY caller of .list() in the codebase is mediaService.listAllImages()
--   (client/src/lib/productService.ts:1007), used exclusively by the admin
--   Image Library. It runs as an authenticated session, so it keeps working.
--
-- ⚠️  WHAT I COULD NOT VERIFY, AND EXACTLY WHAT BREAKS IF I AM WRONG
--   I could not test this against your project — I have no way to issue an
--   anonymous storage request from here. The claim "public-bucket downloads
--   bypass RLS" is from Supabase's documented behaviour, not from an
--   observation of YOUR project.
--
--   If that is wrong, the blast radius is: EVERY PRODUCT IMAGE ON THE
--   STOREFRONT STOPS LOADING FOR LOGGED-OUT VISITORS. Product cards, product
--   detail pages, category tiles, hero tiles — all broken images. The admin
--   would be unaffected (it is authenticated). Nothing is deleted and no data
--   is lost; it is fully reversible by statement R9 in the rollback file.
--
-- PRE-FLIGHT (do this BEFORE running statement 10)
--   1. Open any product image URL in a PRIVATE/INCOGNITO window, e.g. one from
--        select image_url from products
--        where image_url like '%supabase%' limit 1;
--   2. Confirm the image loads. That is your baseline.
--
-- POST-CHECK (immediately AFTER running statement 10)
--   3. Hard-refresh that same incognito tab. If the image still loads, you are
--      done. If it 400s/403s, run R9 from pr1-rollback.sql and tell me — the
--      documented behaviour did not hold and the narrower policy needs a
--      different shape.

-- [10] Narrow bucket listing to authenticated sessions.
DROP POLICY "public_read_product_images" ON storage.objects;

CREATE POLICY "auth_read_product_images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-images');


-- ============================================================================
-- OUT OF SCOPE — noted here so it is not forgotten, NOT changed by this file
-- ============================================================================
-- * product_masters and product_master_images both grant ALL to `authenticated`
--   with USING (true). Same class of hole as statements 4-6, on the masters and
--   variants tables. Deliberately left alone: not in the approved scope.
-- * AdminCategories.tsx:52 uploads to a `category-images` bucket. That bucket
--   DOES NOT EXIST — storage.buckets contains only `product-images`. Category
--   image upload is therefore already broken, independently of this PR.
-- ============================================================================
