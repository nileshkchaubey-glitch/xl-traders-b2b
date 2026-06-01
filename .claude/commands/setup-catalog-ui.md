---
description: XL Traders B2B site me 2-level category UI + emoji ki jagah category image lagao
---

Implement the 2-level category UI in this React (Vite + TS + Tailwind + Supabase) repo.
Assume the DB migration in `sql/01-category-groups-migration.sql` has already been run, so
the `categories` table has: `group_name` (text), `group_order` (int), `image_url` (text).
Do NOT connect to the DB; just use these columns.

Make these changes, keeping the repo's existing style/colors:

1. Types — `client/src/lib/supabase.ts`: add to the Category type:
   `group_name: string; group_order: number; image_url: string | null;`

2. Service — `client/src/lib/productService.ts`:
   - In the categories query, also select `group_name, group_order, image_url`.
   - Add `getCategoriesGroupedByGroup()` returning an array of
     `{ group: string; group_order: number; categories: Category[] }`,
     groups sorted by `group_order`, categories sorted by name.

3. Catalog — `client/src/pages/Catalog.tsx`:
   - Replace the flat category list with a 2-level layout:
     show each GROUP as a heading; under it, its categories.
   - For every category, render its **image** (`category.image_url`) as the chip/card icon,
     NOT an emoji. If `image_url` is null, fall back to `icon_emoji`, then to a neutral
     placeholder. Use a small rounded thumbnail (e.g. 40–48px, object-cover).
   - Clicking a GROUP shows all products in that group; clicking a CATEGORY filters to it.
   - Keep search working across product name + category name.
   - On mobile, categories within the selected group are a horizontal scrollable strip.

4. Product cards: ensure each card shows `product.image_url` (already there). If a product
   has no image, fall back to its category image.

5. Admin — `client/src/pages/Admin.tsx`: in the Add/Edit form, add a **Group** dropdown that
   filters the **Category** dropdown (dependent selects). Saving still sets `category_id`.

After implementing, run the build/typecheck, fix any type errors, and summarize changed files.
