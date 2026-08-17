<!--
  Delete any section that genuinely does not apply, and say why in one line.
  Ticking a box you did not verify is worse than leaving it unticked.
-->

## What changed

<!-- One paragraph. What a reviewer needs before reading the diff. -->

## Why

<!-- The problem, not the solution. Link the plan section or issue if there is one. -->

---

## Verification

<!-- Paste REAL output. "Should work" is not verification, and neither is tsc
     alone — the "5 pcses" bug type-checked cleanly and was only found by
     opening a browser and reading what the page actually said. -->

```
npm run check            
npm run check:storefront 
npm test                 
npm run build            
```

**Observed behaviour** (browser / SQL output / screenshots — whichever applies):

<!-- e.g. "Signed out on /catalog: no ₹ in the document, 24 price slots all
     52px, 0 rows with mismatched card heights." -->

---

## Storefront invariants

Only tick what this PR actually touches. Full reasoning, with the incident
behind each rule, is in [`docs/STOREFRONT_RULES.md`](../docs/STOREFRONT_RULES.md).

`npm run check:storefront` enforces most of these. The **[manual]** items cannot
be grepped and need a human.

### Price gate
- [ ] A guest sees **no price at all** — "Sign in for rates", never a number, range, or struck-through figure
- [ ] No price column added to `GUEST_PRODUCT_COLS` (`price`, `mrp`, `discount_percent`, `price_per_piece`, `bulk_*`)
- [ ] Any new public read of `products` goes through `publicProductQueryShape()` — no `select("*")`, no unguarded `ORDER BY price`
- [ ] **[manual]** Card height is identical between guest and signed-in states (checked at 390px and 1440px)

### Ordering & money
- [ ] All pack/pcs/money arithmetic is in `orderingModel.ts` — none added elsewhere
- [ ] `OrderSpec` built only via `resolveOrderSpec` / `specFromSnapshot`
- [ ] Cart, cart bar, saved order and WhatsApp message all read `cartTotals` — no local `reduce`
- [ ] **[manual]** WhatsApp message totals match the cart exactly (this is the document the business fulfils against)

### Copy
- [ ] No customer count, SKU count, rating, years-in-business, freight/free-delivery, stock-availability, slab-pricing, MRP or discount claim
- [ ] **[manual]** If copy changed, the `site_content` **row** was updated too — a stored row wins over `FALLBACKS`, so a code-only change is cosmetic

### Presentation
- [ ] Category counts come from `v_category_live_counts`; no zero-count category renders
- [ ] Empty promo slot renders **nothing** — no box, no skeleton, no reserved space
- [ ] Theme changes accent + hero gradient only — never layout, never prices
- [ ] No base64 image in source; no `srcSet` for renditions that do not exist
- [ ] Internal nav uses wouter `<Link>`

### Data / SQL
- [ ] Migration written to `docs/sql/`, wrapped in `BEGIN`/`COMMIT`, idempotent
- [ ] Verification queries run and **real output pasted**
- [ ] `docs/CHANGELOG_SQL.md` updated in this same PR
- [ ] Destructive operations announced before running
- [ ] **[manual]** If RLS changed: hole proved to exist, then proved closed — as the real role, with real output

---

## Risk & rollback

<!-- What could break, how it would be noticed, how to undo it.
     For SQL: name the rollback statement. -->

## Follow-ups deliberately not in this PR

<!-- Anything found but out of scope. Better recorded here than silently dropped. -->
