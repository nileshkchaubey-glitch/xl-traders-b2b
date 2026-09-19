-- Authorization hardening for the launch-audit findings.
-- Limited to user profile privileges, settings/import authorization, and the
-- product-health view. Safe to re-run: all replacements are in one transaction.

begin;

-- RLS controls rows, but it cannot compare OLD and NEW column values. Keep
-- ordinary self-service profile updates working and protect the privileged
-- flags at the database boundary with a BEFORE trigger.
create or replace function public.protect_user_profile_privileges()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_is_trusted boolean :=
    current_user in ('postgres', 'service_role', 'supabase_admin')
    or coalesce(public.is_admin(), false);
begin
  if caller_is_trusted then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.is_admin is distinct from false
       or new.is_active is distinct from true then
      raise exception 'is_admin and is_active are managed by administrators'
        using errcode = '42501';
    end if;
  elsif new.is_admin is distinct from old.is_admin
        or new.is_active is distinct from old.is_active then
    raise exception 'is_admin and is_active are managed by administrators'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_user_profile_privileges() from public;
revoke all on function public.protect_user_profile_privileges() from anon;
revoke all on function public.protect_user_profile_privileges() from authenticated;

drop trigger if exists protect_user_profile_privileges on public.user_profiles;
create trigger protect_user_profile_privileges
  before insert or update on public.user_profiles
  for each row execute function public.protect_user_profile_privileges();

drop policy if exists "Users can insert own profile" on public.user_profiles;
drop policy if exists "Users can insert their own profile" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;
drop policy if exists "Users can update their own profile" on public.user_profiles;
drop policy if exists customer_insert_own_profile on public.user_profiles;
drop policy if exists customer_update_own_profile on public.user_profiles;
drop policy if exists admins_manage_user_profiles on public.user_profiles;

create policy customer_insert_own_profile
  on public.user_profiles for insert to authenticated
  with check (
    (select auth.uid()) = id
    and is_admin = false
    and is_active = true
  );

create policy customer_update_own_profile
  on public.user_profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy admins_manage_user_profiles
  on public.user_profiles for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Remove policies that treated every authenticated account as an admin. Table
-- grants stay in place because admins and customers share the authenticated
-- Postgres role; RLS performs the authorization distinction.
alter table public.business_settings enable row level security;
drop policy if exists admin_write_settings on public.business_settings;
drop policy if exists "Admins manage settings" on public.business_settings;
drop policy if exists admins_manage_business_settings on public.business_settings;

create policy admins_manage_business_settings
  on public.business_settings for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

alter table public.import_logs enable row level security;
drop policy if exists "Authenticated users can manage import logs" on public.import_logs;
drop policy if exists admins_manage_import_logs on public.import_logs;

create policy admins_manage_import_logs
  on public.import_logs for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- This is an admin health surface, so anon has no reason to query it. Security
-- invoker also makes authenticated reads obey the products table's RLS gate.
alter view public.v_product_health set (security_invoker = true);
revoke all on public.v_product_health from anon;
grant select on public.v_product_health to authenticated;

commit;

-- Emergency rollback (restores the previous insecure behavior):
-- begin;
-- drop trigger if exists protect_user_profile_privileges on public.user_profiles;
-- drop function if exists public.protect_user_profile_privileges();
-- drop policy if exists customer_insert_own_profile on public.user_profiles;
-- drop policy if exists customer_update_own_profile on public.user_profiles;
-- drop policy if exists admins_manage_user_profiles on public.user_profiles;
-- create policy "Users can insert own profile" on public.user_profiles
--   for insert with check (auth.uid() = id);
-- create policy "Users can update own profile" on public.user_profiles
--   for update using (auth.uid() = id);
-- drop policy if exists admins_manage_business_settings on public.business_settings;
-- create policy admin_write_settings on public.business_settings
--   for all to authenticated using (true) with check (true);
-- drop policy if exists admins_manage_import_logs on public.import_logs;
-- create policy "Authenticated users can manage import logs" on public.import_logs
--   for all using (auth.role() = 'authenticated')
--   with check (auth.role() = 'authenticated');
-- alter view public.v_product_health reset (security_invoker);
-- grant select on public.v_product_health to anon, authenticated;
-- commit;
