# Test Admin Account

Internal test-admin setup for local development against the live Supabase project.

> **Read this first.** Dev and production are the **same database**. The 142-product
> catalogue is real, hand-entered work. Destructive tests touch **`ZZ-TEST-PRODUCT` only**
> (§4). Free disposable local PostgreSQL staging is available for schema/role tests;
> it does not replicate hosted Auth, PostgREST or Storage.

---

## 1. How `is_admin()` actually works

Admin status is a **single boolean column on `public.user_profiles`**. It is not
`app_metadata`, not a `role` column, and not a separate roles table.

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()),
    FALSE
  );
$function$
```

- `auth.uid()` → the caller's JWT `sub`.
- Looks up that id in `user_profiles` and returns its `is_admin`.
- **`COALESCE(..., FALSE)`** — if the user has **no `user_profiles` row at all**, the
  function returns `FALSE`. This is the trap: creating the auth user in the Supabase
  dashboard is *not enough*. A profile row must exist with `is_admin = true`.
- `SECURITY DEFINER`, so it can read `user_profiles` regardless of that table's own RLS.

This function is what the RLS policies call — e.g. `brands`' "Admins can manage brands"
(`FOR ALL … USING (is_admin())`).

### Client profile loading (verified 2 October 2026)

`client/src/lib/authStore.ts` reads the caller's RLS-scoped profile. Only
`profile.is_admin === true` enables admin screens. Email allowlists and
user-editable Auth metadata never grant privileges. A missing profile is created
with `is_admin=false`, `is_active=true`; a failed read does not trigger an insert.
The live `protect_user_profile_privileges` trigger rejects customer privilege
changes. RLS and `public.is_admin()` remain the authorization boundary.

Signup without an Auth session waits for email confirmation; it does not claim
that an unconfirmed user is signed in. Company name is ordinary Auth metadata
copied into a new customer profile after authentication. Async profile requests
run outside the awaited Auth callback; stale responses cannot restore admin
state after logout.

### Controlled admin provisioning procedure

1. Use the Supabase dashboard to create/confirm the intended Auth account with
   the existing authentication method. Never put its password in the repo.
2. Using a trusted SQL/admin session, inspect the exact `auth.users` UUID and
   email, and the existing profile. Save its current flag values (or record that
   the profile is absent) before changing it. Do not derive privileges from
   client-provided metadata or an email allowlist.
3. For an existing, verified profile, update only `is_admin=true` by the exact
   UUID. If absent, insert its verified UUID/email as an admin using the trusted
   process; the historical example below illustrates the shape, not a request
   to rerun it. Do not change activation unless separately intended.
4. Verify `public.is_admin()` under that UUID's simulated JWT in a rolled-back
   transaction and sign in to check the UI. Log any applied SQL in
   [CHANGELOG_SQL.md](CHANGELOG_SQL.md).
5. Rollback restores the saved flags by exact UUID. Do not delete the Auth user
   or profile to revoke access. Refresh the profile/sign out and back in after
   changing access. This implementation did not provision a new production admin.

---

## 2. The account, and the SQL that was run

| | |
|---|---|
| Email | `dev-admin@xltraders.local` |
| Auth user id | `8174be01-8b5e-4b41-89d5-923a630918f6` |
| Password | **Not stored in this repo.** Set in the Supabase dashboard; see §3 |

The auth user itself was created manually via the Supabase dashboard. It had **no
`user_profiles` row**, so `is_admin()` returned `FALSE`. This is the statement that granted
admin — idempotent, and it touches only this one profile row:

```sql
INSERT INTO public.user_profiles (id, email, contact_person, company_name, is_admin, is_active)
VALUES ('8174be01-8b5e-4b41-89d5-923a630918f6', 'dev-admin@xltraders.local',
        'Dev Admin (test account)', 'XL Traders — internal testing', TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET is_admin = TRUE, is_active = TRUE
RETURNING id, email, is_admin, is_active;
```

### Verifying the grant

`is_admin()` depends on `auth.uid()`, so verify it by simulating that user's JWT. Runs in a
transaction and rolls back — it changes nothing:

```sql
BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"8174be01-8b5e-4b41-89d5-923a630918f6","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT auth.uid() AS acting_as_uid, public.is_admin() AS is_admin_result;
ROLLBACK;
```

Expected: `is_admin_result = true`.

To revoke later: `UPDATE public.user_profiles SET is_admin = FALSE WHERE id = '8174be01-…';`

---

## 3. Signing in locally

1. `npm run dev` → http://localhost:5000
2. Go to `/auth` and sign in with `dev-admin@xltraders.local` and the password you set in
   the Supabase dashboard.
3. `/admin` should now render. The Brands tab lives under **Catalogue → Brands**.

**Credentials are not in the repo.** `.env.local` (gitignored, `.gitignore:12`) holds:

| Variable | Purpose |
|---|---|
| `VITE_ADMIN_EMAILS` | Obsolete and ignored; remove from deployment configuration when convenient. |
| `TEST_ADMIN_EMAIL` | Convenience reference. |
| `TEST_ADMIN_PASSWORD` | **Intentionally empty.** Nothing in the app reads it today — sign-in is a form. Fill it yourself only if you later add an automated login script. |

Never commit a password. `.env.local` is gitignored; keep it that way.

---

## 4. `ZZ-TEST-PRODUCT` — the only safe destructive target

| | |
|---|---|
| SKU | `ZZ-TEST-PRODUCT` |
| Product id | `27a7d798-7d73-419a-a4b9-4195ab67bdce` |
| Category | `uncategorized` sentinel |
| `status` | `draft` |
| `is_active` | `false` |

Because the storefront gate is `status='published' AND is_active=true`, this row is
**invisible to customers** — verified: 0 publicly visible.

```sql
INSERT INTO public.products (name, sku, category_id, status, is_active, brand, brand_id, description)
SELECT 'ZZ TEST PRODUCT — safe to modify', 'ZZ-TEST-PRODUCT', c.id, 'draft', FALSE, '', NULL,
       'Throwaway row for automated/manual admin testing. Never published.'
FROM public.categories c WHERE c.slug = 'uncategorized'
ON CONFLICT (sku) DO UPDATE SET status = 'draft', is_active = FALSE
RETURNING id, name, sku, status, is_active, brand, brand_id, category_id;
```

### Current production safety rule

The owner's October instructions supersede the old permission to treat catalogue
rows as expendable. Never delete real customers, products, catalogue, orders or
order items, destroy storage buckets, publish drafts automatically or delete the
`uncategorized` sentinel. Never manipulate the 11 Hinged Box price conflicts.
Use disposable synthetic staging first. Production fixture cleanup may touch
only exact objects/data created by the current task after verifying the target
and preserving rollback information. Historical IDs and counts below are dated
observations, not current permission or proof that a row remains a safe target.

---

## 5. Verification results (PR #135 checklist)

Run 2026-07-29. Split into what was provable at the database/RLS layer and what still needs
a signed-in browser session.

### Verified at the DB / RLS layer

| Check | Result |
|---|---|
| `is_admin()` for dev-admin | ✅ `true` |
| Create + rename + deactivate a brand, as dev-admin under RLS | ✅ all three succeeded (rolled back) |
| Duplicate brand name | ✅ `23505` on `brands_name_key` |
| Non-admin authenticated user attempts a brand write | ✅ blocked, `42501` — RLS holds |
| Assign brand → **both** `brand_id` and `brand` text written in one update | ✅ on `ZZ-TEST-PRODUCT` |
| "No brand" → `brand_id = NULL` **and** `brand = ''` (empty string, not NULL) | ✅ |
| `ZZ-TEST-PRODUCT` publicly visible | ✅ 0 — correctly hidden |

### Verified by reading the code

| Check | Where |
|---|---|
| `23505` mapped to an inline field error, not a raw toast | `brandsService.ts:27` `PG_UNIQUE_VIOLATION`; `AdminBrands.tsx:151` `setDupError(true)`, `:318` `aria-invalid` |
| Panel save dual-writes | `productForm.ts:106-107` — `brand_id` + `brand` in one payload |
| Bulk assign dual-writes in a single statement | `productService.ts:776-790` `bulkSetBrand` → `.update({ brand_id, brand })` |
| Inactive brand renders `Name (inactive)`, "No brand" option present | `BrandCombobox.tsx:55`, `:84-97` |

### Verified through the live admin UI ✅

Run 2026-07-29 signed in as `dev-admin@xltraders.local` (owner typed the password; Claude
never handled it). All six passed.

| Check | Result |
|---|---|
| Brand create → rename → deactivate via the Brands screen | ✅ slug auto-derived `zz-test-brand`, certifications parsed to 2, rename kept the slug, Active switch flipped to `aria-checked=false` |
| Duplicate name → inline error, no crash | ✅ dialog stayed open, `aria-invalid="true"`, "A brand with this name or slug already exists." under the Name field, **no raw toast**, brand count unchanged |
| Panel picker assignment | ✅ wrote **both** `brand_id` and `brand` text |
| "No brand" via the picker | ✅ `brand_id NULL` + `brand ''` (empty string) |
| Bulk Set brand → **Undo** | ✅ set to `Packworld`, Undo restored **both** columns to `Fortune Petpack` — the paired snapshot works |
| `Paras (inactive)` in the picker | ✅ renders `Paras (inactive)`, not blank. Inactive brands are correctly **not offered** as options (only `No brand` + the two active brands) |
| Brands tab from the mobile shell ("More") | ✅ reachable at 390px, responsive (Slug/Certifications columns drop), no horizontal overflow |

Minor observation, not a defect: navigating to Brands from the mobile "More" menu renders
the Brands screen correctly but leaves the previous tab's params in the URL
(`?tab=catalog-editor&catCols=…`). Cosmetic only — deep-linking `?tab=brands` works.

---

## 6. Live counts (2026-07-29, after adding the test row)

| Brand | Total | Publicly visible |
|---|---|---|
| Fortune Petpack | 11 | 10 |
| Packworld | 18 | 18 |
| Paras | 1 | 1 |
| _no brand_ (`brand_id IS NULL`) | 113 | 110 |
| **Total** | **143** | **139** |

Reconciliation notes:

- **143 = the 142 real products + `ZZ-TEST-PRODUCT`.**
- The no-brand figure of 113 **includes** the test row, so the real catalogue is **112**
  unbranded — not 113. The baseline shifted because **`XL0001` was assigned to Paras** at
  `2026-07-29 08:47`, during PR #135 testing. Both its columns say `Paras`, so the
  dual-write worked; the count change is expected, not a bug.
- Fortune Petpack 11 total vs 10 public: **`HINGED-BOX-2250-ML` is `is_active = false`**
  (published but deactivated). Correct behaviour of the publish gate.

---

## 7. Known issue found during this setup

**Deactivating a brand has no effect on the storefront.**

`productService.getBrands()` derives the storefront's brand facet from the legacy
`products.brand` **text** column over published+active products. It never consults
`brands.is_active`. So `Paras` — deactivated in the brands table — **still appears as a
brand facet on `/catalog`**, because its one product (`XL0001`) is published and active.

Confirmed by replicating the query:

```sql
SELECT DISTINCT p.brand, b.is_active
FROM public.products p LEFT JOIN public.brands b ON b.name = p.brand
WHERE p.status='published' AND p.is_active AND p.brand IS NOT NULL AND p.brand <> '';
-- Fortune Petpack (t) | Packworld (t) | Paras (f)  ← inactive brand, still listed
```

This is the expected seam between the legacy text column and the new `brands` table, and it
closes when the storefront is moved to read `brand_id` / `brandsService.getAll()` — already
logged as the next PR in `productService.getBrands()`'s own comment. **Not fixed here.**

Until then: deactivating a brand is an **admin-only** state. To hide a brand from customers
you must unpublish or deactivate its products.
