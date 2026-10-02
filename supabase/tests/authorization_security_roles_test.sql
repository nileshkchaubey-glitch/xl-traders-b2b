begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- Stable identities used only inside this rolled-back test transaction.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'customer-authz-test@example.invalid',
    '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'admin-authz-test@example.invalid',
    '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'new-customer-authz-test@example.invalid',
    '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  );

insert into public.user_profiles (id, email, is_admin, is_active)
values
  ('10000000-0000-0000-0000-000000000001', 'customer-authz-test@example.invalid', false, true),
  ('10000000-0000-0000-0000-000000000002', 'admin-authz-test@example.invalid', true, true);

insert into public.business_settings (id, key, value)
values ('20000000-0000-0000-0000-000000000001', 'authz_test_setting', 'original');

insert into public.import_logs (id, source, rows_total)
values ('30000000-0000-0000-0000-000000000001', 'authz-test', 1);

-- The live application schema requires every product to reference a category.
-- Keep this fixture valid on both disposable full-schema and minimal CI databases.
insert into public.categories (id, name, slug) values
  ('40000000-0000-0000-0000-000000000004', 'Authorization test category', 'authorization-test-category');
insert into public.products (id, category_id, name, status, is_active, price) values
  ('40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'authz-test-live', 'published', true, 10),
  ('40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004', 'authz-test-draft', 'draft', true, null),
  ('40000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000004', 'authz-test-inactive', 'published', false, 20);

-- Anonymous role.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$ insert into public.business_settings (key, value) values ('anon_write', 'blocked') $$,
  '42501', null, 'anonymous users cannot insert business settings'
);
select throws_ok(
  $$ insert into public.import_logs (source, rows_total) values ('anon-write', 1) $$,
  '42501', null, 'anonymous users cannot insert import logs'
);
select throws_ok(
  $$ select count(*) from public.v_product_health $$,
  '42501', null, 'anonymous users cannot read v_product_health'
);
select ok(
  not has_table_privilege('anon', 'public.v_product_health', 'select'),
  'anon has no SELECT grant on v_product_health'
);

select is((select count(*) from public.user_profiles), 0::bigint,
  'anonymous users cannot read profiles');
select throws_ok(
  $$ insert into public.user_profiles (id, email) values ('10000000-0000-0000-0000-000000000003', 'anon@example.invalid') $$,
  '42501', null, 'anonymous users cannot create a profile');
select results_eq(
  $$ update public.business_settings set value = 'anon-write' where key = 'authz_test_setting' returning key $$,
  $$ select null::text where false $$, 'anonymous settings updates affect no rows');
select results_eq(
  $$ delete from public.business_settings where key = 'authz_test_setting' returning key $$,
  $$ select null::text where false $$, 'anonymous settings deletes affect no rows');
select is((select count(*) from public.import_logs), 0::bigint,
  'anonymous users cannot read import logs');

reset role;

-- Customer role: ordinary profile data remains self-service, while privileged
-- flags and administrative tables are protected.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
select throws_ok(
  $$ insert into public.user_profiles (id, email, is_admin, is_active) values ('10000000-0000-0000-0000-000000000003', 'new-customer-authz-test@example.invalid', true, true) $$,
  '42501', null, 'new customers cannot create an admin profile'
);
select lives_ok(
  $$ insert into public.user_profiles (id, email, is_admin, is_active) values ('10000000-0000-0000-0000-000000000003', 'new-customer-authz-test@example.invalid', false, true) $$,
  'ordinary signup profile creation remains allowed');

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$ update public.user_profiles set company_name = 'Customer Ltd' where id = '10000000-0000-0000-0000-000000000001' $$,
  'customers can update ordinary fields on their own profile'
);
select is(
  (select company_name from public.user_profiles where id = '10000000-0000-0000-0000-000000000001'),
  'Customer Ltd', 'the ordinary customer profile update is persisted'
);
select throws_ok(
  $$ update public.user_profiles set is_admin = true where id = '10000000-0000-0000-0000-000000000001' $$,
  '42501', 'is_admin and is_active are managed by administrators',
  'customers cannot promote themselves to admin'
);
select throws_ok(
  $$ update public.user_profiles set is_active = false where id = '10000000-0000-0000-0000-000000000001' $$,
  '42501', 'is_admin and is_active are managed by administrators',
  'customers cannot change their activation status'
);
select is(
  (select is_admin from public.user_profiles where id = '10000000-0000-0000-0000-000000000001'),
  false, 'the customer remains non-admin after the blocked update'
);
select throws_ok(
  $$ insert into public.user_profiles (id, email, is_admin) values ('10000000-0000-0000-0000-000000000001', 'customer-authz-test@example.invalid', true) on conflict (id) do update set is_admin = excluded.is_admin $$,
  '42501', null, 'upsert cannot bypass profile privilege protection');
select results_eq(
  $$ update public.user_profiles set company_name = 'spoofed' where id = '10000000-0000-0000-0000-000000000002' returning id $$,
  $$ select null::uuid where false $$, 'customer cannot edit another profile');
select throws_ok(
  $$ update public.user_profiles set id = '10000000-0000-0000-0000-000000000099' where id = '10000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'customer cannot reassign profile ownership');
select results_eq(
  $$ update public.business_settings set value = 'customer-write' where key = 'authz_test_setting' returning key $$,
  $$ select null::text where false $$,
  'customer updates to business_settings affect no rows'
);
select throws_ok(
  $$ insert into public.business_settings (key, value) values ('customer_insert', 'blocked') $$,
  '42501', null, 'customers cannot insert business settings'
);
select results_eq(
  $$ delete from public.business_settings where key = 'authz_test_setting' returning key $$,
  $$ select null::text where false $$, 'customer cannot delete settings');
select is((select count(*) from public.business_settings where key = 'authz_test_setting'),
  1::bigint, 'public business settings remain readable');
select results_eq(
  $$ delete from public.import_logs where id = '30000000-0000-0000-0000-000000000001' returning id $$,
  $$ select null::uuid where false $$,
  'customer deletes from import_logs affect no rows'
);
select throws_ok(
  $$ insert into public.import_logs (source, rows_total) values ('customer-write', 1) $$,
  '42501', null, 'customers cannot insert import logs'
);
select results_eq(
  $$ update public.import_logs set rows_total = 99 where id = '30000000-0000-0000-0000-000000000001' returning id $$,
  $$ select null::uuid where false $$, 'customer cannot update import logs');
select is((select count(*) from public.import_logs), 0::bigint,
  'customer cannot read administrative import logs');
select lives_ok(
  $$ select count(*) from public.v_product_health $$,
  'authenticated users query v_product_health through underlying RLS'
);
select results_eq(
  $$ select name from public.v_product_health where name like 'authz-test-%' order by name $$,
  $$ values ('authz-test-live'::text) $$,
  'customer health view excludes both drafts and inactive products');

reset role;

-- Admin role: the same authenticated database role is authorized by is_admin().
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select lives_ok(
  $$ update public.user_profiles set is_active = false where id = '10000000-0000-0000-0000-000000000001' $$,
  'admins can manage privileged user profile fields'
);
select is((select is_active from public.user_profiles where id = '10000000-0000-0000-0000-000000000001'),
  false, 'admin activation changes actually persist');
select results_eq(
  $$ update public.user_profiles set is_admin = true where id = '10000000-0000-0000-0000-000000000003' returning is_admin $$,
  $$ values (true) $$, 'existing admins can grant administrator access');
select results_eq(
  $$ update public.business_settings set value = 'admin-write' where key = 'authz_test_setting' returning key $$,
  $$ values ('authz_test_setting'::text) $$,
  'admins can update business settings'
);
select results_eq(
  $$ update public.import_logs set rows_total = 2 where id = '30000000-0000-0000-0000-000000000001' returning rows_total $$,
  $$ values (2) $$,
  'admins can update import logs'
);
select lives_ok(
  $$ select count(*) from public.v_product_health $$,
  'admins can read v_product_health'
);
select is((select count(*) from public.v_product_health where name like 'authz-test-%'),
  3::bigint, 'admin health view includes published, draft and inactive products');
select lives_ok(
  $$ insert into public.business_settings (key, value) values ('authz_admin_created', 'value') $$,
  'admin can insert settings');
select lives_ok(
  $$ insert into public.import_logs (source, rows_total) values ('authz_admin_created', 1) $$,
  'admin can insert logs');
select results_eq(
  $$ delete from public.import_logs where source = 'authz_admin_created' returning source $$,
  $$ values ('authz_admin_created'::text) $$, 'admin can delete logs');
select ok(
  has_table_privilege('authenticated', 'public.v_product_health', 'select'),
  'authenticated keeps the health-view SELECT grant needed by admins'
);
select is((select public.is_admin()), true, 'admin identity is recognized');

reset role;
select * from finish();
rollback;
