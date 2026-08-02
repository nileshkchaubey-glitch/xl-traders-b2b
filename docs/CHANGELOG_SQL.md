# SQL Changelog

Every SQL statement an agent executes against the Supabase project
(`danoeaftaazhbldeeuxj`), newest first, with a one-line reason.

**Purpose:** reconstruct what happened weeks later. This is a record, not a gate —
statements are appended _after_ they run, not submitted for approval.

**Conventions**

- **Mutating** statements (INSERT / UPDATE / DELETE / DDL / RLS) are logged in full.
- **Read-only** `SELECT` / introspection is not logged individually — only noted when it
  established something that later work depends on.
- Statements run inside `BEGIN … ROLLBACK` are logged and marked **rolled back**, because
  knowing a check ran matters even when it left no trace.
- Dev and production are the **same database**. See `docs/TEST_ADMIN.md` for the
  `ZZ-TEST-PRODUCT` rule.

---

## 2026-07-29 — P2 follow-up: split `missing_seo` (PR: `feat/pim-p2-inheritance-hint`)

**1. `v_product_health` — split the SEO check.** ⚠️ `DROP VIEW` + recreate, announced
first (the column set changes, and `CREATE OR REPLACE VIEW` can only append at the end).
No data touched; no dependent objects exist.

Reason: `missing_seo` was `slug blank OR meta_title blank`, which ANDs two unrelated
things together — and since 139 of 143 rows have a blank slug, the flag was true no
matter whether the editorial meta was written. The score understated permanently and
real SEO gaps could not be told from structural ones.

- `missing_slug` — per-product, **never inherits** (URLs must be unique), mechanically
  derivable from the name (`AdminSEO` bulk-generates it).
- `missing_seo` — editorial `meta_title`, **inheritable** from the series. Also gained
  `na_fields` support, which it never had.
- `missing_count` is now 0–9 and `health_score` divides by 9.

```sql
DROP VIEW public.v_product_health;
CREATE VIEW public.v_product_health AS …
  (p.slug IS NULL OR p.slug = '') AS missing_slug,
  ((p.meta_title IS NULL OR p.meta_title = '')
    AND NOT (p.master_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM product_masters m
      WHERE m.id = p.master_id AND m.meta_title IS NOT NULL AND m.meta_title <> ''))
    AND NOT ('seo' = ANY (COALESCE(p.na_fields,'{}'::text[])))) AS missing_seo
…
```

→ Catalogue-wide the two now read **139 missing slug** vs **128 missing meta** —
previously one indistinguishable "missing SEO". The 11 series variants read
`missing_slug 11 / missing_seo 0`: the series meta covers all of them, which the old
flag could never show.

**2. `missing_seo` now counts `meta_description` as well as `meta_title`** (owner
decision). `CREATE OR REPLACE VIEW` — same column set, no drop needed.

Reason: `meta_description` is the search snippet and it inherits from the series exactly
as the title does. Scoring only the title understates the work by half.

```sql
-- missing_seo = (title blank after inheritance) OR (description blank after inheritance)
--               AND NOT ('seo' = ANY(na_fields))
```

→ **This is not academic.** Between the split and this change, `meta_title` was
bulk-generated across **139 rows** in one write (`2026-07-29 15:57`, the `AdminSEO` bulk
action). Measured immediately afterwards:

| Definition                         | Reports         |
| ---------------------------------- | --------------- |
| `meta_title` only                  | **0 missing**   |
| `meta_title` OR `meta_description` | **128 missing** |

The title-only score would have gone green while 128 products had no search snippet at
all. Catalogue average `health_score` is **69** under the corrected definition.

---

## 2026-07-29 — PIM P2 series (PR: `feat/pim-p2-series`)

Schema approved by the owner before running. All statements below were executed.

**1. Series schema, in one transaction.**
Reason: evolve `product_masters` into the series entity — brand link (P1 contract),
explicit ordering, the missing FK index and `updated_at` trigger, admin-only RLS, and a
category FK that orphans rather than destroys.

```sql
BEGIN;
ALTER TABLE public.product_masters
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL;
UPDATE public.product_masters m SET brand_id = b.id
  FROM public.brands b WHERE b.name = m.brand AND m.brand_id IS NULL;
ALTER TABLE public.products        ADD COLUMN IF NOT EXISTS variant_sort integer;
ALTER TABLE public.product_masters ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_products_master_id
  ON public.products(master_id) WHERE master_id IS NOT NULL;
DROP TRIGGER IF EXISTS update_product_masters_updated_at ON public.product_masters;
CREATE TRIGGER update_product_masters_updated_at BEFORE UPDATE ON public.product_masters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP POLICY IF EXISTS "Authenticated users can manage masters" ON public.product_masters;
CREATE POLICY "Admins can manage masters" ON public.product_masters
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Authenticated users can manage master images" ON public.product_master_images;
CREATE POLICY "Admins can manage master images" ON public.product_master_images
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
ALTER TABLE public.product_masters DROP CONSTRAINT product_masters_category_id_fkey;
ALTER TABLE public.product_masters ADD CONSTRAINT product_masters_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;
COMMIT;
```

→ Checked first that **both** admin accounts have `user_profiles.is_admin = true`, so the
RLS tightening could not lock the owner out.

**2. Backfill `variant_sort`.** Reason: the storefront selector now orders by it.

```sql
UPDATE public.products SET variant_sort = (substring(variant_label from '^[0-9]+'))::int
WHERE master_id IS NOT NULL AND variant_label ~ '^[0-9]' AND variant_sort IS NULL;
```

→ all 11 Hinged box variants (100 … 2250).

**3. `v_product_health` — count inherited values as present.**
Reason: Rule #11 makes the view the only home for missing-logic, so read-through has to
land here too or a series-level description would not lift its variants' scores.
`missing_image` already inherited from master images before P2; `missing_description`,
`missing_brand` and the `meta_title` half of `missing_seo` now do the same. `slug` is
deliberately excluded — product URLs must be unique. (Full body in the migration; it is a
`CREATE OR REPLACE VIEW`, no data touched.)
→ verified in a rolled-back transaction first: setting the series description took
`missing_description` from 11 → 0.

**4. Grant three structural columns to `anon`.** ⚠️ privilege change, announced first.
Reason: PostgREST must read the FK column to resolve an embedded resource, and
`products.master_id` was never granted to `anon` — so the new `product_masters(...)` embed
failed the **entire** guest product query with `42501`. No price signal in any of the
three; the price gate was re-verified still denying `price` to `anon` afterwards.

```sql
GRANT SELECT (master_id, variant_label, variant_sort) ON public.products TO anon;
```

→ anon SELECT columns 18 → 21. Also fixes a pre-existing bug: without `master_id`, the
PDP variant selector had never rendered for logged-out visitors.

**5. Content + cleanup on the Hinged box series** (expendable rows, announced first).
Reason: gave the read-through something real to resolve, and cleared the variant-level
copies that were the residue of the `setMasterPrimaryImage` push-down deleted in this PR.

```sql
UPDATE public.product_masters SET description = '…', meta_title = '…', meta_description = '…'
WHERE slug = 'hinged-box';
UPDATE public.products SET image_url = NULL, brand = '', brand_id = NULL
WHERE master_id = (SELECT id FROM public.product_masters WHERE slug='hinged-box');
```

→ 11 variants: `missing_description` 11 → 0, `missing_brand` 0, `missing_image` 0,
average `health_score` **63 → 75**. `missing_seo` stays 11 because all 11 have a blank
`slug`, which never inherits. **No price or MOQ was touched** — that reconciliation
remains the owner's, per Critical Rule #13.

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

> **Correction (P2 session).** The uuid in this section was originally recorded as
> `8174be01-8b5e-4b41-89d5-923a630918f6`. That account was **deleted and recreated** when
> the password was rotated, so the live `dev-admin@xltraders.local` auth id is
> `19e93cb6-668e-49ed-b4df-747aee0ecdb0` (created 2026-07-29 13:07). The ids below have
> been updated to the live one so the statements are re-runnable; the original statements
> ran against the old uuid. Its `user_profiles` row was auto-created on first sign-in by
> `authStore.buildAuthState` via the `VITE_ADMIN_EMAILS` allowlist, which is why the
> account is admin despite the documented INSERT having targeted the deleted uuid.

### Mutating

**1. Grant admin to the test account.**
Reason: the auth user existed but had **no `user_profiles` row**, so `is_admin()` returned
`FALSE` via its `COALESCE` default. Idempotent; touches one profile row.

```sql
INSERT INTO public.user_profiles (id, email, contact_person, company_name, is_admin, is_active)
VALUES ('19e93cb6-668e-49ed-b4df-747aee0ecdb0', 'dev-admin@xltraders.local',
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
  '{"sub":"19e93cb6-668e-49ed-b4df-747aee0ecdb0","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT auth.uid(), public.is_admin();
ROLLBACK;
```

→ `is_admin() = true`.

**5. Brand create / rename / deactivate under RLS as the admin.**

```sql
BEGIN;
SELECT set_config('request.jwt.claims','{"sub":"19e93cb6-…","role":"authenticated"}', true);
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
