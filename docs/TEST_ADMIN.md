# Admin provisioning and safe test access

Local development uses the same hosted project as production unless explicitly
configured otherwise. Real catalogue/customer/order data is protected. The free
disposable PostgreSQL restore contains synthetic fixtures only and does not
provide hosted Auth, PostgREST or Storage.

## Authorization truth

public.is_admin() is a SECURITY DEFINER function reading user_profiles.is_admin
for auth.uid(), returning false if no profile. RLS enforces access. authStore
reads the caller's profile; only its database is_admin flag enables admin UI.
Missing profiles use is_admin=false/is_active=true; a failed read does not insert.
Email allowlists or editable Auth metadata never grant privileges. The live
profile trigger rejects customer is_admin/is_active changes. Self-service UI
updates allow contact/business fields only. Unconfirmed signup waits for a
session and shows an email-confirmation instruction.

## Controlled provisioning

1. Create/confirm an intended approved Auth account using the existing dashboard
   authentication process. Keep credentials outside Git and browser VITE config.
2. Through trusted SQL/admin access, inspect the exact auth.users UUID/email and
   its current profile. Save current flags, or record profile absence, for rollback.
3. Update only is_admin=true on that exact verified profile. If absent, insert
   the verified UUID/email using the trusted process. Do not change activation
   without that intention; never trust client metadata or allowlists.
4. Verify public.is_admin() under its JWT/role in a BEGIN/ROLLBACK transaction,
   then sign in and refresh the profile. Log actually executed mutating SQL in
   CHANGELOG_SQL. This run did not provision a new production admin.
5. Revoke/rollback by restoring saved flags on the exact UUID. Do not delete the
   customer/Auth profile to remove admin access, or weaken RLS/the trigger.

## Test limits and data preservation

The available Auth admin credential returned Invalid API key on 2 October;
no test account was created. Hosted authenticated pricing/checkout/admin smoke
checks remain unverified. Unit/role tests and real Chrome with fully intercepted
synthetic Auth/REST responses are separate evidence, not a hosted login claim.

Historical account IDs, scratch SKU and July measurements are archived; they are
not current credentials or proof a row is safe to delete. Never drop/truncate
core tables, delete real customer/catalogue/order rows, destroy buckets, publish
drafts automatically, delete uncategorized or touch the 11 Hinged Box conflicts.
Production fixture cleanup may touch only exact objects/data created by this
task after target verification and rollback preservation. Prefer synthetic staging.
