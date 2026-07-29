# SQL Changelog

Every SQL statement an agent executes against the Supabase project
(`danoeaftaazhbldeeuxj`), newest first, with a one-line reason.

**Purpose:** reconstruct what happened weeks later. This is a record, not a gate —
statements are appended *after* they run, not submitted for approval.

**Conventions**
- **Mutating** statements (INSERT / UPDATE / DELETE / DDL / RLS) are logged in full.
- **Read-only** `SELECT` / introspection is not logged individually — only noted when it
  established something that later work depends on.
- Statements run inside `BEGIN … ROLLBACK` are logged and marked **rolled back**, because
  knowing a check ran matters even when it left no trace.
- Dev and production are the **same database**. See `docs/TEST_ADMIN.md` for the
  `ZZ-TEST-PRODUCT` rule.

---

## 2026-07-29 — Test-admin setup (PR #137)

### Mutating

**1. Grant admin to the test account.**
Reason: the auth user existed but had **no `user_profiles` row**, so `is_admin()` returned
`FALSE` via its `COALESCE` default. Idempotent; touches one profile row.

```sql
INSERT INTO public.user_profiles (id, email, contact_person, company_name, is_admin, is_active)
VALUES ('8174be01-8b5e-4b41-89d5-923a630918f6', 'dev-admin@xltraders.local',
        'Dev Admin (test account)', 'XL Traders — internal testing', TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET is_admin = TRUE, is_active = TRUE
RETURNING id, email, is_admin, is_active;
```

**2. Create the safe destructive-test target.**
Reason: gives destructive tests a row that is never customer-visible
(`draft` + `is_active=false` fails the publish gate). Idempotent on SKU.

```sql
INSERT INTO public.products (name, sku, category_id, status, is_active, brand, brand_id, description)
SELECT 'ZZ TEST PRODUCT — safe to modify', 'ZZ-TEST-PRODUCT', c.id, 'draft', FALSE, '', NULL,
       'Throwaway row for automated/manual admin testing. Never published.'
FROM public.categories c WHERE c.slug = 'uncategorized'
ON CONFLICT (sku) DO UPDATE SET status = 'draft', is_active = FALSE
RETURNING id, name, sku, status, is_active, brand, brand_id, category_id;
```
→ created `27a7d798-7d73-419a-a4b9-4195ab67bdce`.

**3. Dual-write test on `ZZ-TEST-PRODUCT`** (committed; ends in clean state).
Reason: prove the PIM P1 contract — assign writes **both** `brand_id` and legacy `brand`
text in one update; "No brand" writes `brand_id NULL` + `brand = ''` (empty string, not
NULL). Run under the dev-admin JWT so RLS was exercised too.

```sql
-- assign
UPDATE public.products p SET brand_id = b.id, brand = b.name
FROM public.brands b WHERE b.name='Fortune Petpack' AND p.sku='ZZ-TEST-PRODUCT';
-- clear ("No brand")
UPDATE public.products SET brand_id = NULL, brand = '' WHERE sku='ZZ-TEST-PRODUCT';
```
→ both steps verified; row left at `brand_id NULL`, `brand ''`.

### Rolled back (verification only — no persistent effect)

**4. Verify `is_admin()` for the test account** by simulating its JWT.

```sql
BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"8174be01-8b5e-4b41-89d5-923a630918f6","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT auth.uid(), public.is_admin();
ROLLBACK;
```
→ `is_admin() = true`.

**5. Brand create / rename / deactivate under RLS as the admin.**

```sql
BEGIN;
SELECT set_config('request.jwt.claims','{"sub":"8174be01-…","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO public.brands (name, slug) VALUES ('ZZ Test Brand','zz-test-brand');
UPDATE public.brands SET name='ZZ Test Brand Renamed' WHERE slug='zz-test-brand';
UPDATE public.brands SET is_active=FALSE WHERE slug='zz-test-brand';
ROLLBACK;
```
→ all three succeeded.

**6. Duplicate-name constraint + non-admin RLS denial.**

```sql
BEGIN;
-- duplicate name
INSERT INTO public.brands (name, slug) VALUES ('Packworld','packworld-dup');
-- as a NON-admin authenticated user (xltraders990@gmail.com)
INSERT INTO public.brands (name, slug) VALUES ('ZZ Should Fail','zz-should-fail');
ROLLBACK;
```
→ duplicate raised **`23505`** on `brands_name_key`; non-admin write **blocked, `42501`**.

### Read-only findings worth keeping

- `public.is_admin()` = `SELECT COALESCE((SELECT is_admin FROM user_profiles WHERE id = auth.uid()), FALSE)`,
  `STABLE SECURITY DEFINER`. One boolean — not `app_metadata`, not a role column.
- **Deactivating a brand has no storefront effect.** `getBrands()` derives the `/catalog`
  facet from the legacy `products.brand` text column and never consults `brands.is_active`,
  so deactivated `Paras` still appears via its live product `XL0001`. Logged in
  `CLAUDE.md` Known Issues and `docs/TEST_ADMIN.md` §7.
- Brand counts drifted from the `11 / 18 / 113` baseline: `XL0001` was assigned to Paras at
  `2026-07-29 08:47` during PR #135 testing (dual-write correct). Real unbranded count is
  **112**; the 113 figure includes `ZZ-TEST-PRODUCT`.
- `HINGED-BOX-2250-ML` is `published` but `is_active=false` — why Fortune Petpack shows
  11 total / 10 public.
