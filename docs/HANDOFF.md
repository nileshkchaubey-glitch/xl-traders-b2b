# XL Traders B2B — Handoff for ChatGPT / Codex

Written 2 Oct 2026 from a long planning-and-review chat with Claude. Read this whole file first. It replaces that chat history.
Put a copy in the repo as `docs/HANDOFF.md`. A short `AGENTS.md` at repo root should point here.

---

## 0. How to use this file (autonomous mode)

The owner wants the work done **without stopping to ask**. So:

1. FIRST reconcile state (section 8). Other agents (Claude Code, Codex) have already merged work. Do not assume this file is current. `git log`, `gh pr list`, and the code are ground truth.
2. Work through section 7 in order, one branch and one PR at a time.
3. **Never stop to ask about routine choices.** Pick the safest option, record it in the PR body, continue.
4. **Gated items do not stop the run.** If a task needs the owner (migration, security change, business claim), open the PR or write the SQL file, add a line to `docs/OWNER_QUEUE.md`, then **move to the next independent task**.
5. Stop completely only if: a settled rule in section 3 would have to be loosened, a deletion has a consumer you did not expect, or CI cannot be made green without weakening a guardrail.
6. At the end of each block, write a short report with real command output, not summaries. List what you could NOT verify.

---

## 1. Project snapshot

- **Business:** XL Traders, B2B wholesale of food packaging and disposables, Pandesara, Surat. Buyers: kirana stores (dominant), restaurants, caterers, cloud kitchens. Solo owner (Nilesh). Language with the owner: professional Hindi (Devanagari) with English technical terms. **All code, commits, docs and agent prompts: English only.**
- **Repo:** `github.com/nileshkchaubey-glitch/xl-traders-b2b` (was public; check current visibility).
- **Stack:** React 19, Vite, TypeScript, Tailwind v4 (`@theme` in `client/src/index.css`, no tailwind config file), Wouter, Zustand, shadcn/ui, Supabase (project `danoeaftaazhbldeeuxj`), Cloudflare Pages (auto-deploys from `main`).
- **Status:** NOT live. About 142 products are scraped demo data to be replaced from an Excel master sheet.
- **Real launch blocker is catalogue content, not code:** descriptions about 7% done, SEO about 3%, product and category photos missing. Code work should never wait on it, and never invent content to fill it.
- **Dev:** `npm run dev` (localhost:5000). `npm run ci` = `tsc` + `check:storefront` + vitest + build. At last report: 17 guardrails, 113 tests. Node 24 (`.nvmrc`). Never rely on Node's native TypeScript stripping.

---

## 2. Working protocol (non-negotiable)

- Never push to `main`. New branch per task, PR of about 15 files or fewer, `npm run ci` green before merge. Enable GitHub branch protection (require PR + checks) if not already on.
- One agent, one branch at a time. No parallel admin systems (a past `admin-v2` build was removed for this reason).
- **Verify before claiming.** Grep before saying a file is unused. Measure before saying something improved. Paste real output.
- If a test fails, first ask whether the test is wrong before bending code.
- Reading markup is not testing behaviour. A focus trap looked right in markup and failed on 6 Tab presses.
- Compare design by serving the prototype and reading **computed styles**, not by reading its markup.
- Prove every new guardrail both ways: plant a violation and show it caught, then show it silent on legitimate text.
- Do not "tidy" an exclusion or exception without proof it is safe.
- **SQL:** write the file in `docs/sql/` (additive, `BEGIN/COMMIT`, idempotent), log it in `docs/CHANGELOG_SQL.md`. Do **not** execute it. The owner runs it in the Supabase SQL Editor. Never `DROP`, `TRUNCATE` or `DELETE` data.
- Do not self-merge security, schema, payment, or irreversible-deletion PRs.

---

## 3. Locked decisions (do not reopen)

**Pricing**
- Guests see **no price**: "Sign in for rates". Card height must be identical for guest and signed-in.
- Enforced by PostgreSQL **column-level GRANTs** on `products` for role `anon`, not by UI. `price_per_piece` is never granted to anon and never in `GUEST_PRODUCT_COLS`. `moq` IS granted to anon.
- Signed-in buyers see ONE per-piece rate, pack price as small subtext. **No MRP, no strike-through, no discount badge, no slab/tier pricing.** `bulk_price` and `bulk_threshold` stay unused.
- Price NULL or 0 renders "On Enquiry" in amber, never ₹0.

**Ordering**
- `products.price` is the price of ONE SELLING UNIT (pack/box/bag/roll). Customers order in pieces, snapped to `order_step`, at or above MOQ.
- All pack/pcs conversion lives only in `client/src/lib/orderingModel.ts`. Money is computed from packs, never pieces. Cart, cart bar and the WhatsApp message all use `cartTotals`/`lineTotal` (parity test exists).
- Columns added: `order_unit`, `order_step`. Do NOT add `pack_size` (`quantity_in_unit` already is it) or a piece-based MOQ.
- `unit_of_measure` of null, empty or any piece word (`pcs`, `nos`, `unit`) is treated as absent and renders "Pack of N". Do not hardcode "pack". Real units arrive with the Excel import.

**Copy and claims**
- "Dispatch", never "delivery", as a timing promise: **Surat — same day · Outside Surat — 2–3 days.**
- **No freight claim anywhere** (rule unsettled). No SKU count, customer count, rating, years-in-business, or stock-availability claim. No `{{TOKEN}}` may render.
- A functional results count ("139 products") on the catalogue is allowed. Marketing boasts are not.
- Shop pincode: **394221**. One source only.
- The design prototype is the source of truth for **layout only**, never for business claims. It contains sample copy, mock products and `{{FREIGHT_RULE}}` tokens. Those never ship.

**Architecture**
- Components → `lib/*Service.ts` → Supabase. Components never import the Supabase client.
- Admin PIM (`/admin`, about 15,800 lines) stays. Catalog Editor is the single products surface.
- One `StorefrontLayout` (header, footer, mobile nav each rendered once). `MobileNav` lives inside `Header`. Do not render it twice.
- Storefront uses Tailwind breakpoints (no JS switch). Admin uses `useIsMobile()`.
- Images: no paid Supabase transformations. Resize on upload in admin and store a web-sized WebP next to the original. Never base64 in the bundle.
- Search must scale to about 10,000 products: `pg_trgm` GIN index, not bare `ILIKE`.
- Festival dates are data, never code. Themes change only accent colour and hero gradient.
- Do not add `pnpm-lock.yaml` (Cloudflare build fails). npm only.

**Unit and category facts**
- 11 "Hinged box" variants have per-piece prices that conflict with their standalone duplicates. Never script or auto-merge them. The owner reconciles by hand.
- `uncategorized` category (slug) is a sentinel. Never delete.
- New products default to `draft` and need an explicit publish.
- `sql/02-public-read-policies.sql` must never be re-run (it would expose draft products). Keep it as a warning.

---

## 4. Architecture map

- Ordering and money: `lib/orderingModel.ts`, `stores/cartStore.ts` (`cartTotals`), `lib/orderMessage.ts` (WhatsApp text), `lib/priceEntryMode.ts` (admin price-typing toggle; unrelated to customer ordering).
- Data: `lib/productService.ts` (`GUEST_PRODUCT_COLS`, `productSelectCols()`), `categoryService`, `settingsService` (`FALLBACKS` + `site_content` rows; stored row beats fallback), `catalogQuery.ts`.
- Storefront components: `components/storefront/` (PriceSlot, ProductImage, ProductMeta, QtyStepper, OrderRule, VariantSelector, HeroSlideshow, PromoBanners, PageTitleBar, HomeSpotlightStrip, MerchandisedRow), `components/home/`, `components/catalog/`.
- DB objects: `order_unit`, `order_step`, `price_per_piece` (generated), `v_category_live_counts` (the one category-count rule), `promo_banners`, `site_content`, `orders.user_id`, buckets `product-images`, `category-images`, `banner-images` (public read, admin-only writes via `is_admin()`).
- Auth truth is `public.is_admin()` reading `user_profiles.is_admin`. The client-side `isAdmin` check is UX only.
- Design system: `docs/DESIGN_SYSTEM.md`. 13 semantic type tokens derived from the prototype (e.g. `--text-price-card`, `--text-product-title`), each with a `-lg` sibling for desktop. Colours and weights use existing Tailwind values. Page shell is one `xl-shell` rule capped at 1440px.
- Rules docs: `docs/STOREFRONT_RULES.md`, `docs/ORDERING_MODEL.md`, `docs/CHANGELOG_SQL.md`, `docs/archive/` (history; not authoritative).

**The 17 guardrails** (`scripts/check-storefront.mjs`): guest-price-columns, public-select-star, unguarded-price-order, arithmetic-outside-model, inline-orderspec, local-cart-total, banned-claims, banned-claims-jsx, no-freight-line, base64-image, raw-internal-anchor, theme-block-scope, supabase-in-component, revived-getitemcount, drawer-autofocus, arbitrary-text-size, section-rhythm. They scan files only, so they cannot see database-stored copy. Stored `site_content` rows must also be checked for `{{` and unbacked claims (last scan: all 15 rows clean).

---

## 5. What is already done (through about PR #181)

- **Phase 1–3:** audit and plan, data foundation (SQL), ordering core with tests.
- **Security:** three RLS holes closed (`site_content`, `orders`/`order_items`, `inquiries`, PR #148). `product-images` storage writes admin-scoped (#158). Each proven as a real non-admin role before and after.
- **Phase 4 storefront:** ProductCard, PDP, Cart + WhatsApp message, Home, Search, Categories, Account, 5-tab mobile nav, filters that compose (URL is the source of truth), accessible filter sheet, service-worker fix, search-term escaping, one layout, tablet overflow fix.
- **Design implementation:** rebuilt screen by screen against `design-reference/xl-traders-storefront.dc.html` (frozen prototype). Home, catalogue, Account, footer, PDP and Cart now match, with the deliberate deviations recorded in `docs/` (fixed mobile buy bar kept, sticky PDP column kept, Similar products kept, order notes kept, Enquire button beside the primary).
- **Guardrails and tooling:** rules doc, 17-rule checker, PR template, CI, Claude Code skills and a Stop hook (Claude-only; not usable from Codex).
- **Block B audit:** completed as lists only. PR-1 merged (#181): two branch-only documents rescued into `docs/archive/`, stale citations fixed, skill path fixed.

---

## 6. Lessons that recur (apply them)

1. A guardrail that depends on an agent noticing is not a guardrail. Make rules structural.
2. Code can be clean while the site is wrong: stored database copy is invisible to file scanners.
3. **Unlayered CSS beats Tailwind utilities.** Found three times: `.container`, `max-h-[85vh]`, an animation duration. Fix by matching the variant (`data-[vaul-drawer-direction=bottom]:max-h-[85vh]`) or an inline style.
4. A comment asserting behaviour that was never true is worse than no comment. Five were found. Verify every doc claim against code.
5. Do not trust your own summary; re-read the source (a "horizontal rail" was actually a vertical column).
6. Adding a field to `CartItem` bumps the persisted store version and silently wipes every cart in progress. Treat it as a data change.
7. Do not mint two tokens for a near-value accident; do keep two names for a real semantic difference.
8. A screenshot showing `{{FREIGHT_RULE}}` was the design prototype, not the live site. Check which one you are looking at before diagnosing.
9. Category and some product images are Google Drive links that fail on localhost but work in production. Do not judge image work from a local screenshot.

---

## 7. REMAINING WORK — do in this order

### Block B — repo cleanup (mechanical; one PR each)

Verify every list yourself with grep or a resolved import graph first. State of PR-2..5 is unknown (see section 8).

**PR-2: dead UI primitives + CSS + two bugs**
- Delete these 32 files in `client/src/components/ui/` (zero importers outside the dead set at last check):
  accordion, alert, aspect-ratio, avatar, breadcrumb, button-group, calendar, carousel, chart, collapsible, empty, field, form, hover-card, input-group, input-otp, item, kbd, menubar, navigation-menu, pagination, progress, radio-group, resizable, scroll-area, separator, sidebar, slider, spinner, tabs, toggle, toggle-group.
- **KEEP `alert-dialog.tsx`** (used by `confirm-dialog.tsx`, which 6 admin files import) and keep `confirm-dialog.tsx`.
- Record in `DESIGN_SYSTEM.md` that breadcrumbs are hand-rolled in Catalog, ProductDetail and Account.
- Delete dead CSS `.xl-kenburns` and `.xl-hero-crossfade` in `index.css` (their components are gone).
- Fix two inert classes: `MobileCategorySheet.tsx:101` and `MobileMasterSheet.tsx:55` have `className="max-h-[88vh]"` on `DrawerContent`. Use `rounded-t-[20px] data-[vaul-drawer-direction=bottom]:max-h-[85vh]` as in `CatalogFilterSheet.tsx`. Also add the `autoFocus` prop to those two drawers (vaul disables autofocus by default, so focus escapes the sheet). Verify with real Tab presses.

**PR-3: dependencies.** Candidates (re-verify each; run `npx depcheck`; finish with a clean `npm ci` and `npm run ci`):
`framer-motion`, `@hookform/resolvers`, `zod`, `@tanstack/react-virtual`, `axios`, `nanoid`, `streamdown`, `tailwindcss-animate`; devDependencies `postcss`, `autoprefixer`, `@tailwindcss/typography` (Tailwind loads through `@tailwindcss/vite`; no postcss or tailwind config exists). Re-run depcheck after PR-2, since deleting files changes what is used.

**PR-4: dead exports.** About 10 value exports with no consumer: all four data sets in `lib/adminDailyImprovements.ts` (this may be a dead feature: if so, propose removing it whole), `chatAssist` in `aiService.ts`, `generateCSVTemplate`, `metaDescriptionFor`, `buildCsvExportUrl`, `parseSheetInput`, `extractDriveFileId`, `TEMPLATE_COLUMNS`. Verify each.

**PR-5: branches.** Delete merged branches (about 111), the 16 `claude/friendly-dijkstra-*`, the 4 `devin/*`, `feat/price-protection`. **Keep `feat/storefront-rate-card` and the tag `pr142-backup`.** Use the GitHub PR API for merged state (`git branch --merged` misses squash merges). Branch deletion is irreversible: list first, delete after the PR for the two rescued docs has merged.

**Also:** make sure `docs/` has no remaining reference to deleted files or branches.

### Block C — shrink CLAUDE.md (about 100 KB → 15 KB or less)
1. Inventory first. Every section, its size, tagged: hard rule / reference / history / duplicated. Commit the inventory.
2. Keep only: what the project is, hard rules, working protocol, links.
3. Move reference detail to the focused docs (link, never restate). Move history to `docs/archive/` (do not delete). Relocate the long dated implementation notes (e.g. the A2.1 catalogue entry) there.
4. **Verify every surviving claim against code.** Known false or stale claims: `HeroMotionTiles` and `HomeCatalogueShowcase` described as shipped (both deleted); framer-motion scroll-reveal sections; `scripts/check-price-entry.ts` (now a vitest suite); Home composition (real one: HeroSlideshow, PromoBanners, HomeCategoryGrid, HomeSpotlightStrip, PromoBanners, MerchandisedRow); "Known Issues" entries that are already fixed. Audit every other `.md` the same way.
5. Add a short "read this first" ordering at the top. Create `AGENTS.md` (about 2 KB: hard rules + pointers) so Codex does not need the long file.
6. No behaviour changes in this PR.

### Block D — Phase 5 (one PR each, about 15 files max)
- **5.1 Admin "Ordering" section** in the product editor: Order Unit (pack|pcs), Pack Size (read-only mirror of `quantity_in_unit`), MOQ, Order Step. Block `order_unit='pcs'` without a pack size; warn when the step is not a sensible multiple. Name it clearly different from `priceEntryMode` (that toggle is about how a price is typed; this is how a customer orders).
- **5.2 Image resize on upload** (product and category images): store a web-sized WebP beside the original; then `ProductImage` can emit a real `srcSet`. Confirm by uploading one image and listing the bucket.
- **5.3 Excel/CSV import:** `unit_of_measure`, `order_unit`, `order_step` are already mapped in `bulkImportService.ts`. Verify end to end with a real sheet, confirm the template no longer lists `pcs` as a normal unit, and document the sheet columns in `docs/`.
- **5.4 Admin screens for promo banners and the site theme** (default | diwali | holi | monsoon | independence). An empty banner slot renders nothing.
- **5.5 `pg_trgm` GIN index:** write the migration file only (owner runs it). Measure search latency before and after. Goes to the owner queue, not self-merge.
- **5.6 Route-level code splitting** (entry chunk about 235 kB gzip). Report per-chunk before and after; verify a cold load with empty cache.
- **5.7 Order history and one-tap reorder:** use `orders.user_id` and the existing user-scoped policy. Quantities pre-filled at valid steps, MOQ enforced, all maths through `orderingModel`. Account stat cards stay as dashes until this exists.
- **Also pending:** move the Anthropic key out of the browser (`VITE_ANTHROPIC_API_KEY` is in the bundle) to a Supabase Edge Function, or disable AI Smart Paste before launch. This is a **launch blocker**; the AI provider is the owner's choice. Fix `business_settings` `.single()` to `.maybeSingle()`. Admin sheets: autoFocus/max-h (PR-2).

### Deferred, not for this run
- Facets not built: MOQ, per-piece rate, material (each needs a new query axis in `productService`).
- Cart brand eyebrow (needs a `CartItem` change and a store version bump).
- PDP Share control.
- Browser regression test for horizontal overflow and card height (needs Playwright; CI has vitest only).
- Seasonal/festival engine (festival table, season tags, scheduled activation, AI-drafted campaigns reviewed by the owner; tracked as SEA-01..07 in the owner's Notion). Do after launch; needs the Anthropic-key move first.
- Guest checkout bug: `placeOrder` uses `INSERT … RETURNING`, which anon cannot do. Fix client-side or server-side. Do not widen anon reads.
- Service-worker fix needs a real-device check (unregister SW, clear storage, reload) on the Cloudflare preview.

### Owner-only (agents cannot do these)
Real catalogue data from Excel, product and category photos (ideally uploaded to Supabase Storage instead of Drive links), descriptions and SEO text, price reconciliation of the 11 Hinged box variants, running SQL migrations, any business claim.

---

## 8. First step for Codex: reconcile state

Before starting, run and report:
```
git fetch --all --prune
git log origin/main --oneline -40
gh pr list --state all --limit 40
ls docs docs/archive; wc -c CLAUDE.md AGENTS.md
ls client/src/components/ui | wc -l
```
For each item in Block B, C, D mark: done / partly done / not started, with the commit or PR as proof. Check the work other agents already did (including any Codex PRs) against sections 2, 3 and 6: run `npm run ci`, run the checker with a planted violation, and grep for the forbidden set (MRP, `line-through`, `% OFF`, slab, base64, direct supabase import in components, "delivery" as a timing promise, freight). Fix or revert violations in a separate PR before continuing. Then proceed with section 7.
