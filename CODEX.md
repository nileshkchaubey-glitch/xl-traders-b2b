# XL Traders B2B — PIM Product & Delivery Blueprint

**Purpose:** This is the working agreement for future Codex tasks involving the
Admin System, PIM, catalogue entry, data quality, and related UX.

**Read with `CLAUDE.md`:**

- `CLAUDE.md` remains the technical and project source of truth: architecture,
  database rules, shipped features, deployment, and critical constraints.
- `CODEX.md` records the agreed product philosophy, daily operator workflow,
  design direction, and approval process.
- When the documents conflict, follow `CLAUDE.md` for technical/security/data
  rules and ask the owner before changing product scope.

Last updated: July 18, 2026

---

## 1. Product context

**Business:** XL Traders is a solo-operated B2B wholesale distributor in Surat.
The owner must be able to create, correct, and publish a catalogue of 1,000+
products without needing staff, a specialist PIM operator, or repeated work.

**Current PIM:** `/admin` is the only Admin/PIM experience. The Catalog Editor
is the only products surface. Do not restore, recreate, or design a parallel
`/admin-v2` or replacement products application.

**Primary outcome:** A clean, publishable, searchable catalogue with accurate
category, pack, MOQ, price/on-enquiry state, image, and description data.

---

## 2. Chosen product philosophy

The system takes inspiration from the useful catalogue-entry philosophy seen in
QuickSell: work in a catalogue/category context, make entry possible from more
than one source, select products before performing a shared batch action, and
keep fast list work distinct from deep product editing.

This is inspiration, not a copy. XL Traders must preserve one master product
truth and its existing category/variant model. Do **not** introduce duplicate
product libraries, copied product records between catalogues, or complexity
that does not materially improve entry speed or catalogue quality.

### Non-negotiable product principles

1. **Speed over ceremony.** The common task should take the fewest safe clicks.
2. **Progressive disclosure.** Only show fields required for the current task;
   advanced fields remain available without cluttering daily work.
3. **Context before data entry.** Selecting a category/group should prefill
   context and reduce repeated choices.
4. **Quality is a workflow, not just a metric.** A missing-data count must
   lead directly to a focused fix queue.
5. **Draft first, publish deliberately.** Fast entry never risks accidental
   storefront publication.
6. **Bulk action must be understandable and reversible where practical.**
7. **No feature for its own sake.** Every change must either reduce time/clicks,
   raise catalogue quality, or make 1,000+ products safer to manage.

---

## 3. Approved UX direction — Catalog Workbench

The agreed design direction is a single Catalog Workbench inside the existing
Catalog Editor, with three task modes. It is a redesign of the workflow, not a
new PIM or a removal of existing capability.

### A. Enter products

**Goal:** Add related products quickly in the currently selected category.

- Category/group context is visible and prefilled.
- Fast-entry fields are limited to: product name, variant/size, pack quantity,
  MOQ, and price/on-enquiry. SKU may be auto-generated or optional.
- New items always save as `draft`.
- Primary action is **Save & Add Next**; focus returns to the name field.
- Existing supplier paste/AI assistance and imports remain available as optional
  entry sources, not mandatory steps.
- The full product panel and route editor remain available for deep editing.

### B. Complete quality

**Goal:** Finish one quality gap at a time with minimal context switching.

- Work queues are powered by `v_product_health`; do not reproduce missing-data
  rules in TypeScript or components.
- Examples: Needs description, Needs image, Needs MOQ, Needs category, Ready
  to publish.
- A selected queue presents the relevant product context and only the missing
  field(s).
- **Save & Next Incomplete** advances to the next product in the same queue.
- `na_fields` remains the honest way to mark genuinely non-applicable data;
  never force fake values merely to improve a score.
- Current priority: the description-completion queue, because descriptions are
  the largest observed data gap.

### C. Publish review

**Goal:** Publish complete drafts quickly and safely.

- Only products that meet the agreed readiness criteria appear in this queue.
- The row makes readiness visible: category, pack/unit, MOQ or N/A,
  price/on-enquiry state, image, and description.
- Support single and bulk publish using existing safe bulk-action patterns,
  confirmation where appropriate, and Undo when a snapshot is available.
- Storefront visibility still requires both `status='published'` and
  `is_active=true`.

### Existing capability that must remain available

- Category/group tree filtering and server-side pagination
- Global name/SKU search, Columns control, density control, keyboard editing,
  sticky columns, row menu, Ctrl+K, bulk actions, and contextual side panel
- Full product editor, product media/gallery, masters/variants, SEO,
  specifications, image library, CSV import, Google Sheets import, orders,
  enquiries, site content, and settings

The workbench should simplify the *default path*; it must not delete or fork
the proven advanced tools.

---

## 4. Default visual hierarchy

The main Products screen should favour task completion over raw field density.

### Default daily table

1. Product name + SKU/variant context
2. Category/group context
3. Pack/unit
4. Quality/readiness state
5. Draft/published state
6. Essential row actions

All other existing columns remain discoverable through the current Columns
control. Do not make the default table wide merely because a field exists.

### Language conventions

- Use **Categories** for category management; avoid the ambiguous label
  “Catalogues” when the feature manages categories.
- Use plain operator language: “Needs description”, “Ready to publish”,
  “Save & next”, “Price on enquiry”.
- Explain Masters once as “products with shared details and size/pack variants.”

---

## 5. Import philosophy

The eventual UX direction is one **Import catalogue** entry point, with source
selection inside it:

1. CSV/XLSX file
2. Google Sheet
3. Supplier text / assisted extraction (only when server-side AI is safe)

Every import follows the same mental model:

1. Choose source
2. Map fields
3. Validate SKU/category/duplicates
4. Preview inserts versus updates
5. Import as drafts
6. Show a clear receipt: inserted, updated, skipped, errors
7. Open the relevant completion queue

Until this is specifically approved and implemented, preserve the existing CSV
and Google Sheets flows. Do not claim tags or name-fallback matching works
unless the tracked schema and implementation support it.

---

## 6. Out of scope unless explicitly approved

- A second admin/PIM, alternate products route, or duplicate product library
- Complex warehouse/inventory accounting
- Catalogue-copying/curation features that duplicate product records
- Broad automation, dashboards, tags, or AI features without a direct speed or
  quality case
- Database schema/migration changes, security changes, checkout/payment logic,
  or destructive changes without explicit approval

---

## 7. Technical and data guardrails

These are mandatory when work is eventually approved:

- All database access remains in `client/src/lib/*Service.ts`; components do not
  call Supabase directly.
- `v_product_health` is the sole source for missing-data logic.
- The `productSelectCols()` price gate and null-price safety rules remain intact.
- All new products default to draft.
- Preserve the `uncategorized` sentinel; never delete it.
- Preserve master/variant relationships and do not break standalone products.
- Reuse existing service methods and shared form/media components where they
  already represent the same domain behaviour.
- Avoid untracked schema assumptions. SQL changes happen only through the
  owner-approved Supabase SQL Editor process documented in `CLAUDE.md`.

---

## 8. Approval and delivery protocol

Codex must not directly implement a conceptual UX request in production code.

For Admin/PIM changes, use this sequence:

1. **Review** — inspect current UX, code constraints, and user goals.
2. **Design proposal** — state the focused problem, proposed workflow, retained
   functionality, and trade-offs.
3. **Prototype** — create an isolated, interactive demo outside production code
   when visual approval is useful.
4. **Explicit approval** — wait for the owner to approve the specific design.
5. **Implementation plan** — split approved work into safe, incremental steps.
6. **Implement** — change only the approved scope; preserve existing behaviour.
7. **Verify** — typecheck, production build, and relevant live/local workflow
   tests. Report any environment limitation honestly.
8. **Document** — update `CLAUDE.md` Shipped/Roadmap and this file when the
   agreed workflow materially changes.

“Start”, “continue”, or “make it better” means begin the next approved
*review/prototype* stage unless the owner explicitly approves production
implementation scope.

---

## 9. Current decision status

**Approved for prototype/review:** Catalog Workbench concept with Enter,
Complete, and Publish modes; category-scoped Fast Entry; description-completion
queue; publish-ready review.

**Not yet approved for production implementation:** Any change to the real
Admin System. Obtain explicit approval after the prototype is reviewed and the
specific first implementation phase is chosen.

