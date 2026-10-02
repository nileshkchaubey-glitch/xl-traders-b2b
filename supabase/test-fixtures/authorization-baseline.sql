-- TEST ONLY. Minimal reproduction of the pre-hardening authorization boundary
-- inspected in the launch audit. Not a production schema backup or migration.
-- Keep the insecure grants/policies here: the runner proves the tests fail
-- before applying the repository migration, then pass after applying it twice.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;
grant usage on schema public, auth, extensions to anon, authenticated;
set search_path = public, extensions;

create function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role'
$$;
create table auth.users (
  id uuid primary key, instance_id uuid, aud text, role text, email text,
  encrypted_password text, email_confirmed_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz,
  updated_at timestamptz, confirmation_token text, email_change text,
  email_change_token_new text, recovery_token text
);
create table public.user_profiles (
  id uuid primary key references auth.users(id), email text unique not null,
  company_name text, contact_person text, phone text, address text, city text,
  state text, pincode text, gst_number text,
  is_admin boolean default false, is_active boolean default true,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create function public.is_admin() returns boolean language sql stable
security definer set search_path = public as $$
  select coalesce((select is_admin from public.user_profiles where id = auth.uid()), false)
$$;
create table public.business_settings (
  id uuid primary key default gen_random_uuid(), key text, value text,
  updated_at timestamptz default now()
);
create table public.import_logs (
  id uuid primary key default gen_random_uuid(), source text, rows_total integer
);
create table public.categories (
  id uuid primary key, name text not null, slug text not null unique
);
create table public.products (
  id uuid primary key default gen_random_uuid(), name text not null,
  category_id uuid not null references public.categories(id),
  status text default 'draft', is_active boolean default true, price numeric
);

grant all on public.user_profiles, public.business_settings, public.import_logs,
  public.products to anon, authenticated, service_role;
-- Match the price gate: anon has safe columns, not numeric price access.
revoke select on public.products from anon;
grant select (id, name, status, is_active) on public.products to anon;
alter table public.user_profiles enable row level security;
alter table public.business_settings enable row level security;
alter table public.import_logs enable row level security;
alter table public.products enable row level security;

create policy "Users can insert own profile" on public.user_profiles
  for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.user_profiles
  for update using (auth.uid() = id);
create policy "Users can read own profile" on public.user_profiles
  for select using (auth.uid() = id or public.is_admin());
create policy public_read_settings on public.business_settings
  for select using (true);
create policy admin_write_settings on public.business_settings
  for all to authenticated using (true) with check (true);
create policy "Admins manage settings" on public.business_settings
  for all to authenticated using (public.is_admin());
create policy "Authenticated users can manage import logs" on public.import_logs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy anon_read_published_products on public.products
  for select to anon using (is_active and status = 'published');
create policy auth_read_published_products on public.products
  for select to authenticated using ((is_active and status = 'published') or public.is_admin());
create policy "Admins can manage products" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- Relevant view semantics: definer-owned, references a protected price column,
-- no publication filter. Other health flags do not alter authorization.
create view public.v_product_health as
  select id, name, (price is null or price <= 0) as missing_price from public.products;
grant select on public.v_product_health to anon, authenticated;
