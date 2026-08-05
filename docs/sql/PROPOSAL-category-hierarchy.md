# Proposal — a real 3-level category hierarchy

**Status: PROPOSAL. No SQL has been run. Nothing in this file is applied.**
Decide the open questions at the bottom first; the migration is written to match
whatever you choose.

---

## What exists today

There are already **two** levels, but only one of them is a real table:

| Level        | Where it lives          | Type                                     |
| ------------ | ----------------------- | ---------------------------------------- |
| Department   | `categories.group_name` | **TEXT, repeated on every category row** |
| Category     | `categories.name`       | a real row with an id                    |
| Sub-category | —                       | does not exist                           |

Live data: **5 departments, 38 categories, 143 products.**

```
Food Containers ................... 6 categories,  57 live products
Food Packaging & Presentation ..... 6 categories,  47 live products
Tableware & Takeaway .............. 5 categories,  21 live products
Hygiene, Cleaning & Facility Care . 5 categories,  11 live products
Decoration & Party ............... 15 categories,   1 live product
(no department) ................... 1 category,     2 live products
```

The homepage now renders the department level (this PR). That was a wiring fix,
not a schema fix — it groups `group_name` strings in the browser on every page
load, because there is nothing else to group by.

## Why the text column has to go

1. **Renaming a department is a bulk UPDATE.** "Food Containers" is stored 6
   times. Rename it in 5 places and you have created a 6th department.
2. **A typo silently forks a department.** `"Food Containers "` with a trailing
   space is a new department on the storefront. There is no constraint that can
   catch this.
3. **Ordering has no integrity.** `group_order` is also per-row, so the six rows
   of one department can disagree about where it sits. The homepage currently
   copes by taking `Math.min` of them — that is a workaround for a schema bug.
4. **A department cannot own anything.** No image, no icon, no description, no
   `meta_title`. The homepage tiles use hardcoded icons for exactly this reason.
5. **There is no room for a third level**, which is the thing you actually asked
   for.
6. **One category has no department at all** (`Paper Ice Cream Wati`, 2 live
   products). Nothing prevents that today, and those products are currently
   unreachable from the department navigation.

## Proposed shape

**One self-referencing table, not three.** `categories` gains `parent_id` and
`level`:

```
categories
  id           uuid  PK
  parent_id    uuid  FK → categories(id)     -- NULL only at level 1
  level        int   1 = department, 2 = category, 3 = sub-category
  name, slug, image_url, display_order, is_active, …   (unchanged)
```

Why adjacency-list rather than three tables:

- **`products.category_id` does not change.** It already points at
  `categories.id`; it simply points at a deeper row. No product migration, no
  change to `v_product_health`, no change to the admin PIM's product form.
- One set of RLS policies, one service, one admin screen — three tables would
  triple all of that for no gain at this size.
- A fourth level later costs nothing.

Integrity is enforced in the database, not in TypeScript:

- `level` ∈ {1,2,3}
- `level = 1` ⟺ `parent_id IS NULL`
- a child's parent must be **exactly one level up** (trigger)
- no cycles (trigger)
- `slug` stays globally unique, so URLs stay flat and stable
- `ON DELETE RESTRICT` — deleting a department with children fails loudly rather
  than orphaning them

Plus a recursive view, `v_category_tree`, giving every node its ancestors and
its full descendant set — so "all products in Food Containers" becomes one
indexed query instead of the client-side `categoryIds[]` array the catalogue
builds today.

## Migration path (expand → migrate → contract)

Deliberately the same shape as the P1 brands transition, so nothing breaks
mid-flight:

1. **Expand.** Add `parent_id` + `level`, both nullable/defaulted. Nothing reads
   them yet. Zero-downtime.
2. **Backfill.** Create one level-1 row per distinct `group_name` (5 rows), then
   set every existing category's `parent_id` to its department and `level = 2`.
   `group_name` is left populated and untouched.
3. **Dual-read.** The storefront and admin move to `parent_id`. `group_name` is
   still written so a rollback is a code revert, not a data restore.
4. **Contract.** Once nothing reads it, drop `group_name` and `group_order` in a
   separate, later migration.

Level 3 is created by the owner in admin afterwards — the migration does not
invent sub-categories, because there is no data to derive them from.

## What this unlocks

- Departments get their own image, icon and SEO fields — the homepage tiles stop
  using hardcoded icons.
- `/catalog?department=food-containers` becomes a real indexed filter.
- Breadcrumbs: `Food Containers › Round Container › Milky`.
- The 22 categories with **zero live products** become manageable as a tree
  rather than a flat list of 38.

---

## Open questions — I need answers before writing the migration

**1. What is level 3, concretely?**
This is the one I cannot infer from the data, and it changes the backfill. Two
readings of your "Department > Category > Sub-category":

- **(a) Today's categories are already the sub-categories.** Then "Round
  Container", "Rice Bowl" and "Premium Container" move to level 3 under a new
  level-2 "Containers", and you author the middle level by hand. More work, but
  it matches how you described the levels.
- **(b) Today's categories stay at level 2** and level 3 is new and finer —
  "Round Container › Milky / Black / Transparent". Backfill is mechanical and
  you add level 3 only where it earns its place.

I'd suggest **(b)**: it is a pure addition, needs no re-filing of 143 products,
and level 3 can stay empty for departments that don't need it. But (a) is what
your wording implies, so tell me which you meant.

**2. Must a product always attach to the deepest level?**
If "Round Container" gains sub-categories, do its existing 20 products have to
be re-filed into one of them, or can a product sit on a level-2 node while its
siblings sit at level 3? Allowing both is more forgiving during data entry;
requiring the leaf is cleaner to query. I'd allow both and let admin flag the
stragglers.

**3. `Paper Ice Cream Wati` has no department.** Which one does it belong to —
Tableware & Takeaway? It has 2 live products that are currently unreachable from
department navigation.

**4. Decoration & Party has 15 categories and 1 live product.** Do you want it
on the homepage at all right now? It renders today because the count is ≥ 1. I
can hide departments below a threshold, or leave it — your call.

Answer 1–4 and I'll write `docs/sql/pr3-category-hierarchy.sql` with the
constraints, triggers, backfill, verification queries and rollback, in the same
format as the other files in this directory — for you to run.
