# Phase 1 — Products List + Detail-Drawer Redesign

**Status:** ready to build. Phase 0 (repo hygiene, Cloudflare Pages confirmed) is merged.
**Scope:** UI/presentation layer only. No schema, service, or business-logic changes.

---

## 1. Why

Current Products list is a 13-column horizontal grid with inline edit. Columns overflow the
viewport — status/actions get cut off, horizontal scroll is painful, cells are cramped for
editing. This blocks fast catalogue entry and won't scale toward the 1000-product goal.

**Approved direction (mockup reviewed):** compact list (5–6 columns, no horizontal scroll) +
right-side detail drawer for full editing, with inline quick-edit for the fields used most.

---

## 2. Scope — preserve everything that already works

This is a **replacement of presentation, not capability**. Every existing function must still
be reachable after this ships:

- AI Smart Paste button
- Image Library (+ "Select from Library" inside the drawer's Media section)
- Missing-data filters (8-dimension dropdown) + dashboard chips deep-link into this list
- Bulk update: select-all-matching-current-filter, set brand/MOQ/unit/category,
  publish/unpublish/activate/delete, N/A marking
- Right-click PIM menu (Edit, Images, Duplicate, Delete, Toggle status, View Live, Copy info)
- Route-based editor (`/admin/products/new`, `/admin/products/:id`) — the drawer can reuse
  this route's logic/state; don't duplicate the save logic in two places

If anything above doesn't have an obvious home in the new layout, ask before dropping it.

---

## 3. Components (React 19 + shadcn/ui)

| Component | Responsibility |
|---|---|
| `ProductsToolbar` | Sticky. Search input, catalogue filter, status filter, Missing-data dropdown (existing 8-dim filter), AI Smart Paste entry point. |
| `ProductsTable` | TanStack Table. Columns: select, thumbnail, name (+ variant badge + category subtext), price, status, score, row-menu. Add **TanStack Virtual** — list must stay smooth past 1000 rows; this replaces the current "Page 1 of 4" pagination. |
| `EditableCell` | Click-to-edit for price + status inline. Optimistic update via TanStack Query → `productService` (never raw Supabase calls). |
| `ProductDrawer` | shadcn `Sheet`, `side="right"`. Sections: **Basics** (name, category, brand), **Pricing & stock** (price, MRP, MOQ, unit), **Media**, **SEO** (meta title/description), **Status** (draft/published + N/A marking). "Save & next" advances to the next row in the current filtered list. Reuses the existing route-editor's save logic — don't fork it. |
| `BulkActionBar` | Sticky, appears on selection. Wires into the existing bulk-update capability (select-all-matching-filter, set fields, publish/unpublish/delete, N/A marking) — UI only, logic already exists. |
| `RapidEntryRow` | Single-line add: name, category, price, unit. Enter = save & refocus name for the next entry. This is the "quick-sell"-style fast path for bulk data entry. |

### Media section — schema reality, read this before building

There are **two** image surfaces, not one:
- `products.image_url` — the single primary image (what list thumbnails use)
- `product_images` table (`product_id, image_url, alt_text, display_order`) — the
  **real gallery** mechanism, separate per product, currently underused (14 rows / 151 products)

The drawer's Media section must show **both**: primary image + a thumbnail strip of any
`product_images` rows, with add/remove/reorder + "Select from Library." Don't build a
second/competing image-storage pattern — this table already exists for exactly this.

---

## 4. Build order (small, reviewable commits — same pattern as Phase 0)

1. `ProductsTable` (read-only) — get the compact list rendering correctly, virtualized, no
   horizontal scroll. Verify against real data before moving on.
2. `ProductDrawer` (view + edit one product, reusing existing save logic) — verify Basics/
   Pricing/Status sections round-trip correctly.
3. Media section inside the drawer (wire `product_images` + Image Library "select from").
4. `EditableCell` (inline price/status quick-edit on the list).
5. `BulkActionBar` (wire to existing bulk-update logic).
6. `RapidEntryRow`.
7. Re-wire `ProductsToolbar` — Missing-data dropdown, dashboard-chip deep-links, AI Smart Paste
   entry point, search/catalogue/status filters — confirm every existing entry point still works.

Commit each step separately (`feat: ...`), same isolated-commit discipline as the Phase 0 PR.
One PR is fine if commits stay scoped and reviewable — don't squash into one giant diff.

---

## 5. Guardrails (non-negotiable, from CLAUDE.md)

- Components **never** call Supabase directly — `*Service.ts` only.
- Missing/health logic lives **only** in `v_product_health` — never reimplemented in a component.
- All product reads go through `productSelectCols()` — price stays gated for anonymous/public contexts.
- No schema or migration changes in this phase. If something here reveals a real schema gap,
  flag it — don't silently add a migration.
- New products still default to `draft`; don't change that behavior while restyling the UI.

---

## 6. Definition of done

- [ ] No horizontal scroll on the Products list at any viewport ≥ 1024px
- [ ] List stays smooth scrolling with 500+ rows (virtualized)
- [ ] Search, catalogue filter, status filter, and Missing-data filter all work and compose together
- [ ] Drawer open → edit → Save & next correctly advances through the *filtered* list
- [ ] Inline price/status edit works without opening the drawer
- [ ] Bulk select + at least Publish/Unpublish + N/A marking work end-to-end
- [ ] Rapid-entry row adds a product and refocuses for the next one
- [ ] `npm run build` clean, local smoke test (logged in + out) before PR
- [ ] No behavior change to price-gating, health scoring, or draft/publish defaults

---

## 7. Kickoff prompt — paste into Claude Code

```
Read CLAUDE.md and phase1_products_redesign_brief.md. Execute Phase 1 — Products list +
detail-drawer redesign, following the build order in the brief exactly (ProductsTable →
ProductDrawer → Media section → EditableCell → BulkActionBar → RapidEntryRow → Toolbar
re-wire). Commit each step separately, same scoped-commit discipline as the Phase 0 PR.
Preserve every existing capability listed in section 2 of the brief — confirm each one still
works before moving to the next step. No schema/migration changes. Open the PR when done;
don't merge without my review.
```
