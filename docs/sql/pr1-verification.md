# PR-1 — verification checklist

Run **after** applying `pr1-rls-publish-gate.sql`. Rollback for any step is
`pr1-rollback.sql`; the statement number to undo is named in each section.

Set these once (values are in your local `.env`, they are not in the repo):

```bash
export SB_URL="https://danoeaftaazhbldeeuxj.supabase.co"
export SB_ANON="<VITE_SUPABASE_ANON_KEY>"
```

The anon key is designed to ship in the browser bundle — using it here is exactly
what an untrusted visitor can do, which is the point of these checks.

---

## 1 · As anonymous — drafts must be invisible

**The core assertion of this PR.** Before the change the first command returns
rows; after it, it must return `[]`.

```bash
# Drafts — MUST be []
curl -s "$SB_URL/rest/v1/products?status=eq.draft&select=id,name,status" \
  -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON"

# Published — MUST still return ~140 rows
curl -s "$SB_URL/rest/v1/products?status=eq.published&select=id&limit=200" \
  -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON" | head -c 200

# No status filter at all — MUST return only published rows.
# This is the case the TypeScript gate never protected.
curl -s "$SB_URL/rest/v1/products?select=status" \
  -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON" \
  | tr ',' '\n' | sort -u | head
```

- [ ] `status=eq.draft` returns `[]`
- [ ] published still returns rows
- [ ] the unfiltered query contains **no** `"status":"draft"`

*Fails → rollback R1/R2.*

## 2 · As anonymous — prices must stay hidden

This behaviour is **unchanged** by PR-1; confirm the column grants still hold.

```bash
curl -s "$SB_URL/rest/v1/products?select=price,mrp&limit=1" \
  -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON"
```

- [ ] Returns a `42501` / permission-denied error, **not** price data

## 3 · As anonymous — writes must be refused

```bash
curl -s -X PATCH "$SB_URL/rest/v1/products?id=eq.<any-id>" \
  -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON" \
  -H "Content-Type: application/json" -d '{"name":"hacked"}'

# products_public should now 404 (view dropped, statement 7)
curl -s -o /dev/null -w "%{http_code}\n" "$SB_URL/rest/v1/products_public?select=id&limit=1" \
  -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON"
```

- [ ] PATCH is refused
- [ ] `products_public` returns 404

## 4 · Storefront, logged **out**

- [ ] Home loads; product cards render
- [ ] `/catalog` lists ~140 products (same count as before)
- [ ] **Product images load** ← the statement-10 check
- [ ] Category tiles and hero tiles show images
- [ ] Prices are hidden, "Sign in for wholesale price" shown
- [ ] A product detail page opens and its image loads

*Images broken → run **R9** immediately. That is the documented-behaviour risk
called out in section 5 of the SQL file.*

## 5 · Storefront, logged **in as a normal (non-admin) customer**

If you have a non-admin test account, this is the most valuable check — it is
the hole statement 3 closes.

```bash
# with a non-admin user's access token
curl -s "$SB_URL/rest/v1/products?status=eq.draft&select=id" \
  -H "apikey: $SB_ANON" -H "Authorization: Bearer <NON_ADMIN_JWT>"
```

- [ ] Drafts return `[]` for a non-admin signed-in user
- [ ] Prices **are** visible (this is the paying-customer path — must still work)
- [ ] Add to cart still works

*No test account? Note it as unverified rather than assuming.*

## 6 · Admin — the lockout check

Do this immediately; it is what `is_admin()` is protecting.

- [ ] `/admin` loads
- [ ] Catalog Editor lists products **including the 2 drafts**
- [ ] Status filter → Draft shows those 2
- [ ] Inline-edit a name and save (tests UPDATE via `is_admin()`)
- [ ] Publish/unpublish a product (tests UPDATE)
- [ ] Quick-add a product (tests INSERT — statement 6)
- [ ] Delete that test product (tests DELETE)
- [ ] **Image Library lists files** (tests storage SELECT as authenticated,
      statement 10)
- [ ] Upload an image in the Image Library (tests storage INSERT)

*Any of these fail → the relevant statement's rollback: reads R3, update R4,
delete R5, insert R6, image list R9.*

## 7 · Post-state confirmation

```sql
-- expect: anon_read_published_products, auth_read_published_products,
--         Admins can manage products  — and nothing else with a loose qual
select policyname, roles::text, cmd, qual
from pg_policies where schemaname='public' and tablename='products'
order by cmd, policyname;

-- expect exactly ONE SELECT policy, TO authenticated
select policyname, roles::text, cmd
from pg_policies where schemaname='storage' and tablename='objects' and cmd='SELECT';

-- expect zero rows
select 1 from information_schema.views
where table_schema='public' and table_name='products_public';
```

- [ ] products has 3 policies, no `USING (true)` on SELECT/UPDATE/DELETE
- [ ] storage.objects has one SELECT policy, `{authenticated}`
- [ ] `products_public` is gone

---

## Known-unverifiable

- **Public-bucket downloads vs RLS** (statement 10). Asserted from Supabase's
  documented behaviour, not observed on this project. Section 4 above is the
  real test.
- **`products_public` write-through.** No write was attempted, so its
  exploitability was never confirmed — the view is dropped regardless.
- Nothing here was executed by Claude. All SQL is owner-run.
