-- ============================================================================
-- v3-rls-authorization.sql
--
--   Closes the three authorization holes recorded in
--   docs/STOREFRONT_V3_PLAN.md §13.1-F.
--
-- STATUS: EXECUTED against danoeaftaazhbldeeuxj on 15 Aug 2026 by the agent.
--   Before/after behavioural proof: docs/sql/v3-rls-authorization-verification.md
--   Logged in docs/CHANGELOG_SQL.md.
--
-- ⚠️ THIS FILE REPLACES EXISTING POLICIES. That is normally forbidden and is
--   owner-authorised FOR THIS PR ONLY (Gate 1, Q3-a). Every DROP is paired with
--   the CREATE that replaces it, in the same transaction, so there is no window
--   in which a table is unprotected.
--
-- THE THREE HOLES (all demonstrated live before the fix — see §0 of the
-- verification doc; the demonstration ran inside BEGIN…ROLLBACK so nothing
-- persisted):
--   1. site_content       — a non-admin signed-in user rewrote the site theme.
--   2. orders/order_items — a non-admin signed-in user read every order.
--   3. inquiries          — a non-admin signed-in user DELETED all 12 rows.
--
-- SCOPE: authorization only. No column is added or dropped, no data is written,
--   and nothing outside these four tables is touched. The one schema statement
--   here — a DEFAULT on orders.user_id — exists because without it this fix
--   would BREAK CHECKOUT; see [B0].
--
-- IDEMPOTENT: DROP POLICY IF EXISTS + guarded CREATE. Safe to re-run.
-- ============================================================================


-- ============================================================================
-- [A] site_content — MOST URGENT.
--
-- Was: "auth write" FOR ALL USING (auth.role() = 'authenticated')
--      i.e. ANY signed-in customer could rewrite every piece of storefront copy
--      — hero, promise, FAQ, footer — and, since V3 Phase 2, the site theme.
--
-- Public SELECT is preserved by the untouched "public read" policy, which the
-- storefront relies on anonymously. Dropping "auth write" does not affect reads
-- even though it was FOR ALL, because "public read" already covers SELECT.
-- ============================================================================
BEGIN;

DROP POLICY IF EXISTS "auth write" ON public.site_content;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid='public.site_content'::regclass
                   AND polname='admins_manage_site_content') THEN
    CREATE POLICY admins_manage_site_content ON public.site_content
      FOR ALL USING (is_admin()) WITH CHECK (is_admin());
  END IF;
END $$;

COMMIT;


-- ============================================================================
-- [B] orders / order_items
--
-- Was: SELECT/UPDATE/DELETE all USING (auth.role() = 'authenticated'), so any
--      signed-in customer could read every other customer's order — name,
--      phone, totals — and update or delete them.
-- ============================================================================
BEGIN;

-- ── [B0] Why a column DEFAULT belongs in an authorization PR ────────────────
-- orderService.placeOrder() inserts with `.insert({...}).select("id").single()`,
-- i.e. INSERT … RETURNING, which Postgres permits only if a SELECT policy also
-- admits the new row. Once SELECT is scoped to `user_id = auth.uid()`, an insert
-- that leaves user_id NULL — which the client does today, because it has never
-- set the column — would no longer be readable back, and **checkout would fail
-- for every signed-in customer**.
--
-- Defaulting the column to auth.uid() closes that gap without touching
-- application code (this PR is SQL-only):
--   * signed-in  → user_id = their uid  → RETURNING works, and reorder gets its
--                                          data with no client change
--   * anonymous  → auth.uid() is NULL   → user_id NULL, exactly as today
--
-- It is a DEFAULT, not a trigger: an explicit user_id in an INSERT still wins,
-- and the [B2] WITH CHECK is what stops that being someone else's id.
ALTER TABLE public.orders ALTER COLUMN user_id SET DEFAULT auth.uid();

COMMENT ON COLUMN public.orders.user_id IS
  'Who placed the order. DEFAULTS to auth.uid(), so a signed-in customer''s '
  'order is attributed automatically and INSERT … RETURNING still works under '
  'the user-scoped SELECT policy. NULL = placed without an account (guest '
  'checkout). Backs order history / reorder.';

-- ── [B1] Drop the three over-broad policies ─────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read orders"   ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can update orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can read order items" ON public.order_items;

-- ── [B2] Re-scope INSERT so an order cannot be attributed to someone else ───
-- Replaces "Anyone can place orders" (WITH CHECK true). Guest checkout is a
-- real path and stays open; what is now refused is a signed-in user writing
-- another user's id into user_id.
DROP POLICY IF EXISTS "Anyone can place orders" ON public.orders;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid='public.orders'::regclass AND polname='place_orders') THEN
    CREATE POLICY place_orders ON public.orders
      FOR INSERT TO anon, authenticated
      WITH CHECK (user_id IS NULL OR user_id = auth.uid());
  END IF;

  -- Admin gets everything. SELECT for the owner is already covered by
  -- users_read_own_orders, created in the Phase 2 migration:
  --   USING (user_id = auth.uid() OR is_admin())
  -- which until now was inert, because the broad policy dropped in [B1] OR-ed
  -- past it. It becomes load-bearing at this line.
  IF NOT EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid='public.orders'::regclass AND polname='admins_manage_orders') THEN
    CREATE POLICY admins_manage_orders ON public.orders
      FOR ALL USING (is_admin()) WITH CHECK (is_admin());
  END IF;

  -- order_items: readable only via an order you own, or as admin.
  -- The EXISTS subquery is itself subject to orders' RLS, which is what makes
  -- it correct rather than merely plausible: a user can only satisfy it for a
  -- row users_read_own_orders already admits.
  IF NOT EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid='public.order_items'::regclass AND polname='users_read_own_order_items') THEN
    CREATE POLICY users_read_own_order_items ON public.order_items
      FOR SELECT TO authenticated
      USING (
        is_admin()
        OR EXISTS (SELECT 1 FROM public.orders o
                   WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid='public.order_items'::regclass AND polname='admins_manage_order_items') THEN
    CREATE POLICY admins_manage_order_items ON public.order_items
      FOR ALL USING (is_admin()) WITH CHECK (is_admin());
  END IF;
END $$;

-- ── [B3] order_items INSERT stays WITH CHECK (true) — deliberate ────────────
-- "Anyone can add order items" is NOT scoped to the parent order, and that is a
-- decision rather than an oversight. The obvious tightening —
--   EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND …)
-- — evaluates that subquery under the CALLER's RLS. An anonymous guest has no
-- SELECT policy on orders at all (verified: anon SELECT orders returns zero
-- rows), so the EXISTS could never be satisfied and **guest checkout would
-- break outright**.
--
-- Residual risk, stated plainly: someone with the anon key can insert junk
-- order_items rows against arbitrary order ids. They cannot read anything back
-- ([B1] removed the only read path), and order_items is only ever read by the
-- admin Orders screen. The exposure is junk data in an admin view, not a
-- disclosure. Closing it properly needs server-side order creation — item 2 of
-- the deferred follow-ups in CLAUDE.md — not a policy.

COMMIT;


-- ============================================================================
-- [C] inquiries
--
-- Was: admin_read/update/delete_inquiries, all USING (true) TO authenticated —
--      despite the "admin_" name prefix, which is what made this easy to miss.
--      Any signed-in customer could read, alter and DELETE the entire
--      WhatsApp-click log.
--
-- public_insert_inquiry (INSERT, CHECK true) is KEPT: the log is written by
-- guests and signed-in users alike from ProductCard, and inquiriesService.create
-- does not use .select(), so no SELECT policy is needed for the write to work.
--
-- Nothing in the application reads this table — inquiriesService exposes only
-- create() — so scoping reads to admin removes no working functionality.
-- ============================================================================
BEGIN;

DROP POLICY IF EXISTS admin_read_inquiries   ON public.inquiries;
DROP POLICY IF EXISTS admin_update_inquiries ON public.inquiries;
DROP POLICY IF EXISTS admin_delete_inquiries ON public.inquiries;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy
                 WHERE polrelid='public.inquiries'::regclass
                   AND polname='admins_manage_inquiries') THEN
    CREATE POLICY admins_manage_inquiries ON public.inquiries
      FOR ALL USING (is_admin()) WITH CHECK (is_admin());
  END IF;
END $$;

COMMIT;


-- ============================================================================
-- NOT FIXED HERE — recorded so the omission is deliberate
-- ============================================================================
-- * storage.objects / product-images: auth_read/upload/update/delete_product_images
--   grant all four verbs to ANY authenticated user (bucket_id check only, no
--   is_admin()). Same class of hole, found during this work but NOT among the
--   three the owner authorised. The category-images and banner-images buckets
--   added in Phase 2 are already is_admin()-scoped, so this is the odd one out.
--   One-line-per-verb fix, awaiting a go-ahead.
--
-- * enquiries (the leads table — NOT inquiries; CLAUDE.md warns these are
--   distinct by design) was checked and is already correct:
--   "Users can read own enquiries" USING (auth.uid() = user_id OR is_admin()),
--   "Admins can update enquiries" USING is_admin(), "Anyone can create enquiry".
--   No statement was run against it.
--
-- * ⚠️ PRE-EXISTING BUG, found while baselining and NOT fixed here because the
--   fix is application code: guest checkout is already broken on production.
--   orderService.placeOrder() does INSERT … RETURNING, which requires a SELECT
--   policy admitting the new row; anon has none, so it fails with "new row
--   violates row-level security policy". Verified before any change in this
--   file (plain INSERT succeeds; only the RETURNING form fails). This PR does
--   not make it worse and does not paper over it by widening anon's reads.
--   Fix belongs with the ordering/cart work: drop the .select() for anonymous
--   checkout, or move order creation server-side.


-- ============================================================================
-- ROLLBACK — restores the previous (INSECURE) policies exactly.
-- Only for the case where this change breaks something in production.
-- ============================================================================
-- BEGIN;
--   DROP POLICY IF EXISTS admins_manage_site_content ON public.site_content;
--   CREATE POLICY "auth write" ON public.site_content FOR ALL
--     USING (auth.role() = 'authenticated');
--
--   ALTER TABLE public.orders ALTER COLUMN user_id DROP DEFAULT;
--   DROP POLICY IF EXISTS place_orders          ON public.orders;
--   DROP POLICY IF EXISTS admins_manage_orders  ON public.orders;
--   CREATE POLICY "Anyone can place orders" ON public.orders FOR INSERT WITH CHECK (true);
--   CREATE POLICY "Authenticated users can read orders"   ON public.orders FOR SELECT USING (auth.role() = 'authenticated');
--   CREATE POLICY "Authenticated users can update orders" ON public.orders FOR UPDATE USING (auth.role() = 'authenticated');
--   CREATE POLICY "Authenticated users can delete orders" ON public.orders FOR DELETE USING (auth.role() = 'authenticated');
--
--   DROP POLICY IF EXISTS users_read_own_order_items  ON public.order_items;
--   DROP POLICY IF EXISTS admins_manage_order_items   ON public.order_items;
--   CREATE POLICY "Authenticated users can read order items" ON public.order_items FOR SELECT USING (auth.role() = 'authenticated');
--
--   DROP POLICY IF EXISTS admins_manage_inquiries ON public.inquiries;
--   CREATE POLICY admin_read_inquiries   ON public.inquiries FOR SELECT TO authenticated USING (true);
--   CREATE POLICY admin_update_inquiries ON public.inquiries FOR UPDATE TO authenticated USING (true);
--   CREATE POLICY admin_delete_inquiries ON public.inquiries FOR DELETE TO authenticated USING (true);
-- COMMIT;
-- ============================================================================
