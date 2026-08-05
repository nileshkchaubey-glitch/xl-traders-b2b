-- ============================================================================
-- Storefront redesign — scope orders to the customer who placed them
--
--   OWNER-RUN. Not applied by the agent. Review before running.
--
-- WHY
-- The Account screen shows "Recent orders" with one-tap reorder. `public.orders`
-- has no `user_id` column — the table was built for a WhatsApp-first flow where
-- the phone number was the identity — so the app can currently only scope by
-- phone (`orderService.getForPhone`).
--
-- That WHERE clause is a filter, NOT a security boundary. RLS on `orders` does
-- not restrict SELECT per user today, so any signed-in visitor could query
-- another phone number directly through PostgREST and read that customer's
-- order history. Nothing in this redesign introduced that — but the Account
-- screen is the first customer-facing surface to read `orders`, which makes it
-- worth closing now.
--
-- This file does three things: adds the column, backfills it from phone where
-- that is unambiguous, and puts an owner-scoped RLS policy in front of it.
-- ============================================================================

BEGIN;

-- [1] The link that should have existed. ON DELETE SET NULL so deleting an
--     auth user never destroys the order record itself.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders (user_id);

-- [2] Backfill from phone, but ONLY where exactly one profile carries that
--     phone number. An ambiguous match is left NULL rather than guessed —
--     attributing an order to the wrong business is worse than leaving it
--     unattributed.
UPDATE public.orders o
SET user_id = p.id
FROM public.user_profiles p
WHERE o.user_id IS NULL
  AND o.phone IS NOT NULL
  AND btrim(o.phone) <> ''
  AND regexp_replace(p.phone, '\D', '', 'g') = regexp_replace(o.phone, '\D', '', 'g')
  AND (
    SELECT count(*) FROM public.user_profiles p2
    WHERE regexp_replace(p2.phone, '\D', '', 'g')
        = regexp_replace(o.phone, '\D', '', 'g')
  ) = 1;

COMMIT;

-- ── [3] RLS ─────────────────────────────────────────────────────────────────
-- Run this block only after confirming the backfill above looks right, and
-- after the app writes user_id on new orders (orderService.placeOrder must set
-- it — see the follow-up noted in the PR). Enabling owner-scoped SELECT before
-- that will hide new orders from the customer who just placed them.
--
-- NOTE: `CREATE POLICY IF NOT EXISTS` is invalid Postgres (CLAUDE.md Critical
-- Rule #4) — drop then create.

-- ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "Customers read own orders" ON public.orders;
-- CREATE POLICY "Customers read own orders" ON public.orders
--   FOR SELECT TO authenticated
--   USING (user_id = auth.uid() OR public.is_admin());
--
-- DROP POLICY IF EXISTS "Admins manage orders" ON public.orders;
-- CREATE POLICY "Admins manage orders" ON public.orders
--   FOR ALL TO authenticated
--   USING (public.is_admin()) WITH CHECK (public.is_admin());
--
-- order_items must be scoped through its parent, or the same data leaks one
-- level down:
--
-- ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Customers read own order items" ON public.order_items;
-- CREATE POLICY "Customers read own order items" ON public.order_items
--   FOR SELECT TO authenticated
--   USING (EXISTS (
--     SELECT 1 FROM public.orders o
--     WHERE o.id = order_items.order_id
--       AND (o.user_id = auth.uid() OR public.is_admin())
--   ));

-- ── Verify ──────────────────────────────────────────────────────────────────
--   SELECT count(*) FILTER (WHERE user_id IS NOT NULL) AS linked,
--          count(*) FILTER (WHERE user_id IS NULL)     AS unlinked
--   FROM public.orders;

-- ── Rollback ────────────────────────────────────────────────────────────────
--   DROP POLICY IF EXISTS "Customers read own orders" ON public.orders;
--   DROP POLICY IF EXISTS "Admins manage orders" ON public.orders;
--   DROP POLICY IF EXISTS "Customers read own order items" ON public.order_items;
--   ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;
--   DROP INDEX IF EXISTS orders_user_id_idx;
--   ALTER TABLE public.orders DROP COLUMN IF EXISTS user_id;
