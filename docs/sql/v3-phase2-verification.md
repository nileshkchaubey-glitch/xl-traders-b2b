# Storefront V3 — Phase 2 schema verification

**Migration:** [`docs/sql/v3-phase2-schema.sql`](v3-phase2-schema.sql)
**Project:** `danoeaftaazhbldeeuxj` · **Executed:** 15 Aug 2026 · **By:** agent, Critical Rule #3

Every result below is **real output**, pasted unedited from the run. Nothing here is
predicted or reconstructed.

---

## V0 — 🔴 The gate check (run this after ANY grant change)

`anon`'s `SELECT` grants on `products`, restricted to the price-sensitive and
ordering columns:

```
column_name        | privilege_type
-------------------+---------------
moq                | SELECT
order_step         | SELECT
order_unit         | SELECT
quantity_in_unit   | SELECT
```

**`price`, `mrp`, `discount_percent`, `price_per_piece`, `bulk_price` and
`bulk_threshold` do not appear.** That is the pass condition. If
`price_per_piece` ever appears in this list, the price gate is open — run
rollback `R3` immediately.

### V0b — proved by behaviour, not just by catalog

Executed as the real `anon` role:

```
test                                     | outcome
-----------------------------------------+-------------------------------------------
anon SELECT price_per_piece              | blocked: permission denied for table products
anon SELECT price                        | blocked: permission denied for table products
anon SELECT moq,order_unit,order_step,qiu| SUCCEEDED (intended)
anon SELECT v_category_live_counts       | SUCCEEDED (intended)
anon SELECT promo_banners                | SUCCEEDED (intended; RLS filters to live)
```

The generated per-piece column is unreadable by guests **by behaviour**, which is
the claim that matters — a grant listing alone would not prove it.

---

## V1 — Columns exist with the right shape

```
column           | type    | nullable | default
-----------------+---------+----------+--------------
order_step       | integer | YES      | -
order_unit       | text    | NO       | 'pack'::text
price_per_piece  | numeric | YES      | -
orders.user_id   | uuid    | YES      | -
```

---

## V2 — CHECK constraints

```
products_order_step_positive | CHECK (((order_step IS NULL) OR (order_step > 0)))
products_order_unit_check    | CHECK ((order_unit = ANY (ARRAY['pack'::text, 'pcs'::text])))
```

Two constraints, as intended. The cross-column `products_pcs_needs_pack_qty`
constraint is **correctly absent** (ORDERING_MODEL §1.6 — it would fire on an
ordinary mid-edit state from a field the operator was not editing).

---

## V3 — Nothing was backfilled

```
order_unit | rows      | with step
-----------+-----------+-----------
pack       | 143 rows  | 0 with step
```

All 143 rows reached `order_unit='pack'` through the column DEFAULT. **No UPDATE
ran.** This is what makes ORDERING_MODEL §5's byte-identity guarantee hold, and
it is why the 11 Hinged box rows (CLAUDE.md carve-out) are untouched.

---

## V4 — How many rows could take pcs mode

```
139 can_use_pcs   |   4 no_pack_qty   |   0 pack_qty_le_1
```

`packDivisor()` treats NULL and `<= 1` as unusable, so those 4 rows would be
downgraded to pack mode at render even if flagged (ORDERING_MODEL §6.1).

---

## V5 — Storage buckets

```
banner-images    | public: true    ← new
category-images  | public: true    ← new
product-images   | public: true      pre-existing
```

`category-images` is the bucket `AdminCategories.tsx:53` has been uploading to
since it was written. **Category image upload was throwing before this migration
and now works.**

---

## V6 — New storage policies (writes are admin-only)

```
public_read_banner_images     SELECT  (bucket_id = 'banner-images')
public_read_category_images   SELECT  (bucket_id = 'category-images')
admin_insert_banner_images    INSERT  CHECK (bucket_id = 'banner-images'   AND is_admin())
admin_insert_category_images  INSERT  CHECK (bucket_id = 'category-images' AND is_admin())
admin_update_banner_images    UPDATE  USING/CHECK (bucket_id = 'banner-images'   AND is_admin())
admin_update_category_images  UPDATE  USING/CHECK (bucket_id = 'category-images' AND is_admin())
admin_delete_banner_images    DELETE  (bucket_id = 'banner-images'   AND is_admin())
admin_delete_category_images  DELETE  (bucket_id = 'category-images' AND is_admin())
```

Scoped to `is_admin()`, **not** to `authenticated`. Note for the authorization PR:
the pre-existing `product-images` policies grant all four verbs to any
authenticated user (`auth_upload_product_images` etc.), which is the same class of
hole as STOREFRONT_V3_PLAN §13.1-F. Recorded, not changed here.

---

## V7 — promo_banners RLS

```
public_read_live_banners  SELECT  (is_active
                                   AND (starts_at IS NULL OR now() >= starts_at)
                                   AND (ends_at   IS NULL OR now() <  ends_at))
admins_manage_banners     ALL     USING is_admin() WITH CHECK is_admin()
```

---

## V8 — product_masters RLS: **verified, not changed**

Per Gate 1, Phase 2 verifies and records this rather than modifying it. **No
statement was executed against either table.**

```
product_masters        | Admins can manage masters      | USING is_admin() | CHECK is_admin()
product_masters        | Public can read active masters | USING (is_active = true)
product_master_images  | Admins can manage master images| USING is_admin() | CHECK is_admin()
product_master_images  | Public can read master images  | USING true
```

The `ALL … USING(true)` hole described in the original brief **does not exist on
this database.** It was fixed before this work began.

---

## V9 — orders policies, including the honest caveat

```
Anyone can place orders               INSERT  CHECK true
Authenticated users can delete orders DELETE  USING (auth.role() = 'authenticated')
Authenticated users can read orders   SELECT  USING (auth.role() = 'authenticated')   ← the hole
Authenticated users can update orders UPDATE  USING (auth.role() = 'authenticated')
users_read_own_orders                 SELECT  USING (user_id = auth.uid() OR is_admin())  ← new
```

> **`users_read_own_orders` restricts nothing yet, and this record says so
> deliberately.** RLS policies are OR-ed, so a narrower policy cannot remove a
> privilege that a broader one grants. Every signed-in user can still read every
> order via `Authenticated users can read orders`. The new policy exists so the
> schema half of reorder is complete; the hole closes only when that broad policy
> is **replaced**, in the dedicated authorization PR (Gate 1, Q3-a). Do not read
> its presence as the fix.

---

## V10 — v_category_live_counts

```
active_categories | with_live_products | total_counted | published_active | theme_rows
------------------+--------------------+---------------+------------------+-----------
38                | 21                 | 139           | 139              | 1
```

`total_counted` equals `published_active` exactly — the view neither drops nor
double-counts a row. And it confirms the §6 finding: **21 of 38 active categories
have live products, so 17 tiles must not render.**

---

## V11 — ⚠️ Per-piece sort surfaces the Hinged box pricing problem

The five cheapest rows by the new `price_per_piece`, published + active:

```
sku                | price | quantity_in_unit | price_per_piece
-------------------+-------+------------------+----------------
HINGED-BOX-100-ML  | 2.10  | 3000             | 0.0007
HINGED-BOX-250-ML  | 3.10  | 1500             | 0.0021
HINGED-BOX-375-ML  | 3.40  | 1500             | 0.0023
HINGED-BOX-500-ML  | 3.80  | 1500             | 0.0025
HINGED-BOX-600-ML  | 5.25  | 900              | 0.0058
```

**All five are Hinged box rows, and all five rates are sub-paisa.** This is not a
bug in the generated column — the column is arithmetically correct. It is the
CLAUDE.md carve-out made visible: these rows were **entered per-piece**, so `2.10`
is a per-piece price being interpreted as a pack price, and dividing it again by
3000 produces a nonsense rate.

Consequences to carry forward, none of them fixed here:

- **Per-piece sorting will rank these 11 rows first** on any "rate: low to high"
  view until the owner reprices them by hand. Worth knowing before PR 8 turns that
  sort on.
- ORDERING_MODEL §6.5 already says pcs mode makes this error *louder*, not worse:
  **reprice first, enable pcs mode second.**
- Nothing was written to these rows. No heuristic infers "this price looks
  per-piece". Per the carve-out, that reconciliation is the owner's by hand.

---

## Rollback

Rollback statements `R1`–`R5` are in the migration file. `R3` is the emergency
one: it revokes `price_per_piece` from `anon` without dropping the column, for the
case where V0 ever shows it granted.
