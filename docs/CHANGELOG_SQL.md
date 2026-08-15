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

## 2026-08-15 — Storefront V3 Phase 2: data foundation

Full file: [`docs/sql/v3-phase2-schema.sql`](sql/v3-phase2-schema.sql) ·
Verification output: [`docs/sql/v3-phase2-verification.md`](sql/v3-phase2-verification.md)

**Additive only.** No DROP, TRUNCATE, DELETE, UPDATE or ALTER…DROP; no existing
policy replaced. All 143 product rows reached `order_unit='pack'` via the column
DEFAULT — nothing was backfilled, so the 11 Hinged box rows (CLAUDE.md carve-out)
are untouched.

**[A]+[B] ordering columns + grants.** Reason: PCS-based ordering needs a
customer-facing counting unit and step; `moq` granted to `anon` per Gate 1 Q1-a
so the card can show an MOQ chip to signed-out visitors (a quantity, not a price).

```sql
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS order_unit TEXT NOT NULL DEFAULT 'pack';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS order_step INTEGER;
ALTER TABLE public.products ADD CONSTRAINT products_order_unit_check    CHECK (order_unit IN ('pack','pcs'));
ALTER TABLE public.products ADD CONSTRAINT products_order_step_positive CHECK (order_step IS NULL OR order_step > 0);
GRANT SELECT (order_unit, order_step) ON public.products TO anon;
GRANT SELECT (moq)                    ON public.products TO anon;
GRANT SELECT                          ON public.products TO authenticated;
```

**[C] price_per_piece generated column + partial index.** Reason: PostgREST can
only `ORDER BY` a column, not an expression, so per-piece sorting needs a stored
column. **Deliberately NOT granted to `anon`** — it is derived from `price`, and
`anon` can read `quantity_in_unit`, so a grant would reconstruct the wholesale
price exactly.

```sql
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_per_piece NUMERIC
  GENERATED ALWAYS AS (CASE WHEN price IS NULL OR price <= 0 THEN NULL
                            WHEN quantity_in_unit IS NULL OR quantity_in_unit <= 0 THEN price::numeric
                            ELSE price::numeric / quantity_in_unit END) STORED;
CREATE INDEX IF NOT EXISTS products_price_per_piece_idx ON public.products (price_per_piece)
  WHERE is_active AND status = 'published';
```

**[D] v_category_live_counts.** Reason: one place defines a storefront category
count (published AND active), replacing a client-side aggregation that fetched
every `category_id` and ignored the publish gate.

```sql
CREATE OR REPLACE VIEW public.v_category_live_counts AS
  SELECT category_id, COUNT(*)::int AS live_products FROM public.products
  WHERE status='published' AND is_active GROUP BY category_id;
GRANT SELECT ON public.v_category_live_counts TO anon, authenticated;
```

**[E] promo_banners** (+ position/window CHECKs, partial index, RLS:
`public_read_live_banners` for anon/authenticated, `admins_manage_banners` for
`is_admin()`). Reason: owner-controlled banners; `is_active` defaults FALSE so a
new banner is never live by accident.

**[F] storage buckets `category-images` + `banner-images`** (public read; INSERT/
UPDATE/DELETE scoped to `is_admin()`). Reason: `AdminCategories.tsx:53` has been
uploading to a `category-images` bucket that never existed — every category image
upload was throwing.

**[G] `site_content` seed** `('site_theme','{"theme":"default"}')`, ON CONFLICT DO
NOTHING. Reason: one festival-theme setting; never overwrite an owner choice.

**[H] `orders.user_id`** uuid → `auth.users(id)` ON DELETE SET NULL, partial
index, plus `users_read_own_orders`. Reason: Gate 1 Q2-a — reorder had no data
model. ⚠️ **The new policy restricts nothing yet**: RLS policies are OR-ed and
`Authenticated users can read orders` USING `auth.role()='authenticated'` still
grants every signed-in user read access to every order. That closes only when the
broad policy is replaced, in the dedicated authorization PR.

**Read-only, recorded because later work depends on it:** `product_masters` and
`product_master_images` already carry `is_admin()` manage policies — the
`ALL … USING(true)` hole described in the task brief does not exist on this
database. **No statement was run against them.**

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
