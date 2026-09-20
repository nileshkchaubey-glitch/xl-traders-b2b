-- TEST ONLY: minimal schema used by the checked-in order RPC, not a full
-- production schema snapshot. All data stays in ephemeral local PostgreSQL.
create role anon;
create role authenticated;
create schema auth;
grant usage on schema public, auth to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.products (
  id uuid primary key, name text not null, sku text, price numeric,
  status text not null default 'draft', is_active boolean default true,
  moq integer, order_step integer, quantity_in_unit integer, unit_of_measure text
);
create table public.site_content (key text primary key, value jsonb);
create table public.orders (
  id uuid primary key default gen_random_uuid(), customer_name text, phone text,
  status text, total_amount numeric, item_count integer, source text, user_id uuid
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id), product_id uuid references public.products(id),
  sku text, product_name text, quantity integer, unit_price numeric,
  unit_of_measure text, subtotal numeric
);
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
grant all on public.orders, public.order_items to anon, authenticated;
create policy place_orders on public.orders for insert to authenticated with check (true);
create policy "Anyone can add order items" on public.order_items for insert to authenticated with check (true);
insert into public.products (id, name, price, status, moq, quantity_in_unit, unit_of_measure) values
  ('50000000-0000-0000-0000-000000000001', 'Priced test pack', 125, 'published', 1, 10, 'pack'),
  ('50000000-0000-0000-0000-000000000002', 'Enquiry test pack', null, 'published', 1, 10, 'pack');
insert into public.site_content values ('min_order_enabled', 'true'), ('min_order_value', '1000');
