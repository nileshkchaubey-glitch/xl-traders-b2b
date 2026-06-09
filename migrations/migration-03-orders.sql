-- Migration 03: Orders and Order Items tables
-- Run manually against your Supabase project SQL editor

CREATE TABLE IF NOT EXISTS public.orders (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  customer_name TEXT,
  phone         TEXT,
  status        TEXT DEFAULT 'new'
                  CHECK (status IN ('new','confirmed','processing','delivered','cancelled')),
  total_amount  NUMERIC,
  item_count    INTEGER,
  notes         TEXT,
  source        TEXT DEFAULT 'cart'
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id        UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES public.products(id),
  sku             TEXT,
  product_name    TEXT,
  quantity        INTEGER NOT NULL,
  unit_price      NUMERIC,
  unit_of_measure TEXT,
  subtotal        NUMERIC
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items(order_id);

-- RLS: enable
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Drop policies first (safe re-run)
DROP POLICY IF EXISTS "Anyone can place orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can add order items" ON public.order_items;
DROP POLICY IF EXISTS "Authenticated users can read orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can update orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can read order items" ON public.order_items;

-- Anyone (including anonymous visitors) can INSERT orders
CREATE POLICY "Anyone can place orders"
  ON public.orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can add order items"
  ON public.order_items FOR INSERT
  WITH CHECK (true);

-- Only authenticated users (admins) can SELECT / UPDATE / DELETE
CREATE POLICY "Authenticated users can read orders"
  ON public.orders FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update orders"
  ON public.orders FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete orders"
  ON public.orders FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read order items"
  ON public.order_items FOR SELECT
  USING (auth.role() = 'authenticated');
