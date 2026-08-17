# `product-images` storage RLS — behavioural verification

**Migration:** [`docs/sql/v3-storage-product-images-rls.sql`](v3-storage-product-images-rls.sql)
**Project:** `danoeaftaazhbldeeuxj` · **Executed:** 17 Aug 2026

Same standard as the RLS authorization fix: **prove the hole exists, close it,
prove it closed, and prove admin still works** — as real roles, with real
output. Every probe ran inside `BEGIN … ROLLBACK`.

**Identities** (real rows in `auth.users`):

| Role | uid | `is_admin()` |
| --- | --- | --- |
| non-admin customer | `3b2903bf-…` (xltraders990@gmail.com) | `false` |
| admin | `19e93cb6-…` (dev-admin@xltraders.local) | `true` |

---

## §0 BEFORE — the hole, demonstrated

```
actor          | test                         | outcome
---------------+------------------------------+---------------------------
auth non-admin | is_admin()                   | false
auth non-admin | UPLOAD to product-images     | SUCCEEDED — hole
auth non-admin | RENAME an existing image     | SUCCEEDED — hole (1 row)
auth non-admin | DELETE ALL catalogue imagery | blocked: Direct deletion from
               |                              | storage tables is not allowed.
```

A signed-in customer could **write to and rename catalogue imagery**. The four
policies (`auth_read/upload/update/delete_product_images`) checked only
`bucket_id`, with no `is_admin()`.

This was the odd one out: `category-images` and `banner-images`, added in Phase
2, were already admin-scoped. `product-images` predates them.

### On the DELETE row

That "blocked" is **not** the policy working. Supabase installs a trigger
refusing direct `DELETE` on `storage.objects`, and it fires *before* RLS is
reached — so the DELETE verb cannot be exercised from SQL at all, for the hole
or for the fix. INSERT and UPDATE are provable and are proved; the DELETE policy
is verified by catalog inspection (§3) and is written identically to the UPDATE
policy that *is* proved. Stated rather than glossed.

---

## §1 AFTER — closed, and admin unbroken

```
actor          | test                                | outcome
---------------+-------------------------------------+-----------------------------
auth non-admin | is_admin()                          | false
auth non-admin | UPLOAD                              | BLOCKED: new row violates
               |                                     | row-level security policy
auth non-admin | RENAME existing image               | BLOCKED - 0 rows affected
auth non-admin | READ / list images (must still work)| 256 objects visible
---------------+-------------------------------------+-----------------------------
admin          | is_admin()                          | true
admin          | UPLOAD (must still work)            | SUCCEEDS
admin          | UPDATE (must still work)            | SUCCEEDS - 1 row
admin          | READ / list images                  | 257 objects visible
---------------+-------------------------------------+-----------------------------
anon           | READ (public bucket)                | 257 objects visible
anon           | UPLOAD                              | BLOCKED: new row violates
               |                                     | row-level security policy
```

The admin count is 257 rather than 256 because the admin UPLOAD probe in the
same transaction genuinely inserted a row — which is itself the proof that admin
writes still work.

### Why READ stays open

The bucket is **public**, so CDN reads bypass RLS entirely; a public URL already
exposes every object. This policy governs the authenticated object API, which
admin's image library and the SKU workbench use via `.list()`. Narrowing it to
admin would break those surfaces without protecting anything.

---

## §2 Nothing persisted

```
objects in product-images : 256   (back to the pre-probe count)
probe rows left           : 0
```

---

## §3 Final policy state

```
public_read_product_images   [SELECT]   anon, authenticated — bucket_id only
admin_insert_product_images  [INSERT]   bucket_id AND is_admin()
admin_update_product_images  [UPDATE]   bucket_id AND is_admin()
admin_delete_product_images  [DELETE]   bucket_id AND is_admin()
```

Now identical in shape to `category-images` and `banner-images`. **All three
buckets are consistent**, and §13.1-F of the plan is fully closed.

---

## §4 Application impact — checked, none expected

Every write path to this bucket is admin-only already:

| Caller | Verb | Surface |
| --- | --- | --- |
| `storageService.uploadProductImage` | INSERT | admin editor |
| `storageService.uploadBySku` | INSERT (upsert) | admin Workbench |
| `storageService.deleteProductImage` | DELETE | admin |
| `mediaService.uploadGlobalImage` | INSERT | admin Image Library |
| `mediaService.listAllImages` | SELECT | admin Image Library |
| `storageService.listBySku` | SELECT | admin Workbench |

The storefront never writes to storage — it only renders public URLs. So no
customer-facing behaviour changes.
