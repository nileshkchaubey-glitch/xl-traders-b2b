# RLS authorization fix — behavioural verification

**Migration:** [`docs/sql/v3-rls-authorization.sql`](v3-rls-authorization.sql)
**Project:** `danoeaftaazhbldeeuxj` · **Executed:** 15 Aug 2026 · Gate 1, Q3-a

All output below is **real**, pasted unedited. Every probe is a **behavioural**
test run as an actual Postgres role with a real JWT claim — not a catalog
listing. A policy listing can look right and still leak; only behaviour settles it.

**Test identities** (real rows in `auth.users`):

| Role | uid | `is_admin()` |
| --- | --- | --- |
| non-admin customer | `3b2903bf-e834-49f8-8f15-cf2615f1ff63` (xltraders990@gmail.com) | `false` |
| another customer | `ae077e2b-c451-439d-8074-fe5b35bc94d0` | — (used only as "someone else") |
| admin | `19e93cb6-668e-49ed-b4df-747aee0ecdb0` (dev-admin@xltraders.local) | `true` |

> Note for `docs/TEST_ADMIN.md`: the live `dev-admin@xltraders.local` uid is
> `19e93cb6-…`, not the `8174be01-…` recorded in CLAUDE.md. Doc drift, not a
> defect — flagged, not changed here.

**Every probe ran inside `BEGIN … ROLLBACK`.** Seeded orders/items never
persisted; confirmed after the run: orders 2, order_items 2, inquiries 12,
`site_theme` back to `{"theme": "default"}`, 0 probe rows left.

---

## §0 — BEFORE: the three holes, demonstrated

Run as the **non-admin** customer, against the policies as they stood:

```
actor          | test                            | outcome
---------------+---------------------------------+----------------------------------------
auth non-admin | is_admin()                      | false
auth non-admin | read ALL orders (the hole)      | 3 rows visible
auth non-admin | rewrite site_content (the hole) | SUCCEEDED — storefront copy is writable
auth non-admin | delete ALL inquiries (the hole) | SUCCEEDED — deleted 12 rows
```

A customer with no admin rights read every order, rewrote the site theme, and
deleted the entire WhatsApp-click log. All three rolled back.

---

## §1 — AFTER: the same probes, plus the cases that must keep working

```
actor          | test                                 | outcome
---------------+--------------------------------------+------------------------------------------
auth non-admin | is_admin()                           | false
auth non-admin | READ OWN order                       | SUCCEEDS - 1 row (correct)
auth non-admin | READ ANOTHER USER'S order            | BLOCKED - 0 rows (correct)
auth non-admin | READ ALL orders (the hole)           | 1 rows visible (was 4; own only)
auth non-admin | READ OWN order_items                 | SUCCEEDS - 1 row (correct)
auth non-admin | READ ANOTHER USER'S order_items      | BLOCKED - 0 rows (correct)
auth non-admin | UPDATE another user's order          | BLOCKED - 0 rows affected (correct)
auth non-admin | DELETE another user's order          | BLOCKED - 0 rows affected (correct)
auth non-admin | REWRITE site_content (hole 1)        | BLOCKED - 0 rows affected (correct)
auth non-admin | READ site_content (must still work)  | 14 rows visible (storefront needs this)
auth non-admin | DELETE all inquiries (hole 3)        | BLOCKED - 0 rows deleted (correct)
auth non-admin | READ inquiries                       | 0 rows visible (expect 0)
auth non-admin | CHECKOUT: INSERT orders RETURNING id | SUCCEEDS (user_id auto-set by DEFAULT)
auth non-admin | CHECKOUT: new order attributed to me | YES (reorder will work)
auth non-admin | SPOOF: insert order as another user  | BLOCKED: new row violates row-level
               |                                      | security policy for table "orders"
---------------+--------------------------------------+------------------------------------------
admin          | is_admin()                           | true
admin          | READ all orders                      | 5 rows visible (expect all)
admin          | READ all order_items                 | 4 rows visible
admin          | READ inquiries                       | 12 rows visible (expect 12)
admin          | WRITE site_content                   | 1 rows updated (expect 1)
---------------+--------------------------------------+------------------------------------------
anon           | INSERT inquiry (WhatsApp log)        | SUCCEEDS (correct)
anon           | READ inquiries                       | 0 rows visible (expect 0)
anon           | READ orders                          | 0 rows visible (expect 0)
```

The required pair the owner asked for is rows 2 and 3: the **same role**, in the
**same transaction**, **succeeds** reading its own order and is **blocked**
reading another customer's.

### What each result protects

- **Reads own / blocked on another's** — the disclosure hole is closed at the row
  level, not by hiding a screen.
- **`READ ALL orders` → 1** — the only row the customer can see is their own.
- **`UPDATE`/`DELETE` another user's order → 0 rows affected.** RLS filters the
  target set rather than raising, so a silent 0 is the correct, secure outcome.
- **`READ site_content` → 14 rows.** Read is deliberately untouched; the
  storefront reads copy anonymously and would go blank otherwise.
- **Admin unchanged** — `AdminOrders`, `AdminEnquiries` and the Site Content
  editor keep full access via `is_admin()`.
- **`anon` can still write the inquiry log** — the WhatsApp-click log is written
  by guests from `ProductCard`.

---

## §2 — Checkout was the real risk, and it is covered

Scoping `SELECT` to `user_id = auth.uid()` would have broken checkout for **every
signed-in customer**, because `orderService.placeOrder()` does
`.insert({...}).select("id").single()` — an `INSERT … RETURNING`, which Postgres
allows only if a SELECT policy admits the new row — and the client has never set
`user_id`.

`ALTER TABLE public.orders ALTER COLUMN user_id SET DEFAULT auth.uid()` closes
that without touching application code. Proven by the two `CHECKOUT:` rows above:
the insert succeeds, and the row comes back attributed to the caller — which also
means **reorder now has its data with no client change**.

Confirmed persisted after the run:

```
user_id_default = auth.uid()
```

---

## §3 — Final policy state

```
tbl          | policy                      | cmd    | roles            | using / check
-------------+-----------------------------+--------+------------------+---------------------------------
inquiries    | admins_manage_inquiries     | ALL    | PUBLIC           | is_admin() / is_admin()
inquiries    | public_insert_inquiry       | INSERT | PUBLIC           | - / true
order_items  | Anyone can add order items  | INSERT | PUBLIC           | - / true            ← see §4
order_items  | admins_manage_order_items   | ALL    | PUBLIC           | is_admin() / is_admin()
order_items  | users_read_own_order_items  | SELECT | authenticated    | is_admin() OR EXISTS (SELECT 1
             |                             |        |                  |   FROM orders o WHERE o.id =
             |                             |        |                  |   order_items.order_id AND
             |                             |        |                  |   o.user_id = auth.uid())
orders       | admins_manage_orders        | ALL    | PUBLIC           | is_admin() / is_admin()
orders       | place_orders                | INSERT | authenticated,anon | - / (user_id IS NULL OR
             |                             |        |                  |      user_id = auth.uid())
orders       | users_read_own_orders       | SELECT | authenticated    | (user_id = auth.uid() OR is_admin())
site_content | admins_manage_site_content  | ALL    | PUBLIC           | is_admin() / is_admin()
site_content | public read                 | SELECT | PUBLIC           | true
```

`users_read_own_orders` was created in the Phase 2 migration and was **inert**
until now — the broad policy OR-ed past it. It becomes load-bearing here, which
is exactly what the Phase 2 record said would happen.

---

## §4 — Known residual risk, stated rather than hidden

**`order_items` INSERT remains `WITH CHECK (true)`.** The obvious tightening —
requiring the parent order to belong to the caller — evaluates its subquery under
the *caller's* RLS, and an anonymous guest has no SELECT policy on `orders` at all
(verified: `anon READ orders → 0 rows visible`). The `EXISTS` could therefore
never be satisfied and **guest checkout would break outright**.

Residual exposure: someone holding the anon key can insert junk `order_items`
rows against arbitrary order ids. They cannot read anything back — §1 shows the
read path is closed — and `order_items` is read only by the admin Orders screen.
So this is junk data in an admin view, not a disclosure. Closing it properly needs
server-side order creation (deferred follow-up #2 in CLAUDE.md), not a policy.

---

## §5 — Pre-existing bug found while baselining, NOT fixed here

**Guest checkout is already broken on production**, independently of this change.
Isolated before anything was modified:

```
test                                  | outcome
--------------------------------------+---------------------------------------------------
anon INSERT orders (NO returning)     | SUCCEEDED
anon INSERT orders RETURNING id       | FAILED: new row violates row-level security policy
                                      |         for table "orders"
anon SELECT orders                    | SUCCEEDED (0 rows)
anon INSERT order_items (no returning)| SUCCEEDED
```

Only the `RETURNING` form fails, and `placeOrder()` uses exactly that form — so a
signed-out visitor reaching checkout gets "Failed to save order. Please try
again." and no WhatsApp message. In practice the storefront gates cart controls
on authentication, so this is reachable mainly with a cart persisted from before
sign-out.

**This PR neither fixes nor worsens it, and deliberately does not paper over it**
by widening anon's reads — that would re-open a disclosure hole to fix a UX bug.
The fix belongs with the ordering/cart work: drop the `.select()` for anonymous
checkout, or move order creation server-side.

---

## §6 — Not fixed: `product-images` storage policies

`auth_read_product_images`, `auth_upload_product_images`,
`auth_update_product_images` and `auth_delete_product_images` grant all four
verbs to **any authenticated user** (bucket check only, no `is_admin()`). Same
class of hole, found during this work but **not among the three the owner
authorised**, so no statement was run against it.

Note the asymmetry this leaves: `category-images` and `banner-images`, added in
Phase 2, *are* `is_admin()`-scoped. `product-images` is now the only bucket a
signed-in customer can write to or delete from. One line per verb to fix, on a
go-ahead.
