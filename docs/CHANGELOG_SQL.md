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

## 2026-07-29 — PR #135 UI verification run (PR #137)

All six browser-level checks run as `dev-admin@xltraders.local` against the live admin UI.
Writes below were made **through the UI** except where marked; the SQL here is what the UI
produced plus two setup/cleanup statements.

**1. Point the scratch row at an inactive brand** (setup for the "(inactive)" render check).

```sql
UPDATE public.products p SET brand_id = b.id, brand = b.name
FROM public.brands b WHERE b.name = 'Paras' AND p.sku = 'ZZ-TEST-PRODUCT'
RETURNING p.sku, p.brand_id::text, p.brand;
```

**2. Cleanup — reset the scratch row and drop the throwaway brand.**
Reason: `ZZ Test Brand` existed only to exercise create/rename/deactivate.

```sql
UPDATE public.products SET brand_id = NULL, brand = '', status='draft', is_active=FALSE
WHERE sku = 'ZZ-TEST-PRODUCT';
DELETE FROM public.brands WHERE slug = 'zz-test-brand';
```
→ brands back to 3; scratch row back to `brand_id NULL` / `brand ''` / draft / inactive.

**Writes made through the UI** (listed for the trail; no hand-written SQL):
create `ZZ Test Brand` → rename to `ZZ Test Brand Renamed` → deactivate → delete;
panel picker assign `Fortune Petpack` then `No brand` on `ZZ-TEST-PRODUCT`;
bulk Set brand → `Packworld`, then **Undo** (restored both columns to `Fortune Petpack`).

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

---

## 2026-08-05 — Storefront redesign (Direction B "Rate Card")

Run by the agent under the standing SQL grant (CLAUDE.md Critical Rule #3).
Non-destructive: one content field, no schema and no product rows touched.

```sql
-- Why: the locked design specifies exactly one delivery line, stating three
-- tiers, under the search field. A stored site_content row was overriding the
-- in-code fallback with the older two-tier copy, so the live site would have
-- contradicted the design regardless of the code change.
UPDATE site_content
SET value = jsonb_set(
      value,
      '{deliveryLine}',
      '"Same-day Surat · Next-day South Gujarat · 2–4 days Pan-India"'::jsonb
    )
WHERE key = 'announcement';
-- → 1 row. Verified: value->>'deliveryLine' now reads the three-tier line.
```

### Read-only findings from the same session (no statements run)

- **`products.mrp` exists** (numeric, nullable) — an earlier brief assumed it did
  not. `mrp_source` does **not** exist.
- **`anon` has no SELECT grant on `mrp`** (only INSERT/UPDATE/REFERENCES), so the
  design's "signed out → MRP" rule cannot render until the grant is added.
  Prepared, owner-run, NOT applied: `docs/sql/pr2-mrp-public-read.sql`.
- **Only 6 of 143 products carry a usable MRP** (`mrp IS NOT NULL AND mrp > 0`),
  so even after the grant the remaining 137 stay on "On enquiry" for signed-out
  visitors until the data is entered.
- **142 of 143 products have a non-empty `image_url`** (127 Google Drive, 15
  Supabase Storage) — the design's "141 of 143 land on the watermark" describes
  the owner's intent to purge scraped imagery, not the current data. The code
  makes no assumption either way: it uses a photo when one loads and falls
  through on error.
- **`orders` has no `user_id` column**, so a customer-facing order list can only
  be scoped by phone. Prepared, owner-run, NOT applied:
  `docs/sql/pr2-account-orders.sql`.
- The test admin's auth id is `19e93cb6-668e-49ed-b4df-747aee0ecdb0`, which does
  **not** match the `8174be01-…` recorded in CLAUDE.md / docs/TEST_ADMIN.md.
