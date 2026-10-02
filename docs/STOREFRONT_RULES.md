# Storefront hard rules

Current implementation lives in client/src and verified SQL. Historical incidents
and measured values are preserved in archive, not current success claims.

## Privacy and ordering

Guests must never receive/show protected prices, MRP, bulk rates/thresholds,
discounts or generated per-piece prices. GUEST_PRODUCT_COLS in productService
includes MOQ/order metadata but excludes price fields. Public product services
use the actual session for column shape and price sorting, invalidate that cache
on auth events, and require published+active. Never use guest SELECT \* or widen
anon grants. UI auth alone is not the database boundary.

Use orderingModel.ts for pack/piece/spec conversion, step/MOQ and money. price
is per selling unit, quantity_in_unit is pack size, moq is packs. No pack_size
duplicate. lineTotal takes branded Packs; cart/message totals share cartTotals.
Do not resurrect getItemCount/getTotal or fork specs/totals into components.
The admin priceEntryMode toggle is separate from customer ordering.

Guests get sign-in and price-free WhatsApp cart enquiry with no DB order.
Authenticated checkout reviews fresh rates and requires explicit reconfirmation
after change, using the confirmed atomic RPC. Never auto-retry or create an
order from an unreviewed message. See ORDERING_MODEL and SQL changelog.

## Claims and copy

No unverifiable ratings, years/customer-count boasts, invented stock status,
MRP/strike-through/discount badges, slab/tier rates or freight/free-delivery claims.
A catalogue result count is navigation feedback, not a business boast. Do not add
a freight summary row. No placeholders such as {{FREIGHT_RULE}} in shipped copy.
Dispatch describes goods leaving, not arrival/delivery timing; preserve the
owner-confirmed dispatch copy. Prototype geometry is reusable; sample promises
are not evidence. Do not invent catalogue, product, pricing or SEO information.

settingsService merges stored site_content over fallbacks, so a fallback-only
edit does not change an existing stored row. Inspect stored copy separately:
the source checker cannot see database text. Product dispatch uses the shared
dispatch hook/content. Banner rate_line is owner text, never joined product rates;
an empty/unconfigured slot renders nothing. No auto-publishing real drafts.

## Presentation and architecture

Reuse semantic tokens/xl-shell and shared ProductCard/PriceSlot/QuantityStepper.
PriceSlot preserves guest/auth height; verify rendered parity without enforcing
old dated pixel measurements. Live category counts come from v_category_live_counts;
hide zero-live categories. Theme selectors affect accent/hero variables only.
Selling-unit nouns come from the model: piece words default to pack, box → boxes.

No base64 product images. Existing image URLs are handled through imageUtils/
ProductImage; do not invent rendition srcSet URLs without actual saved images.
Internal links use Wouter Link. Drawers need autofocus, containment, return focus
and the correct variant height; verify with real Tab/Shift+Tab and Escape.
Footer remains desktop-only; Header owns the single five-tab mobile nav.

New component data queries go through existing services. Legacy checker exclusions
are debt, not permission for new direct Supabase calls. v_product_health owns
missing dimensions; do not duplicate that logic as a parallel TS health system.
Protected profiles/admin writes stay behind RLS, triggers and is_admin().

## Automated and direct verification

scripts/check-storefront.mjs implements these 18 named checks: guest-price-columns,
public-select-star, unguarded-price-order, arithmetic-outside-model, inline-orderspec,
local-cart-total, banned-claims, banned-claims-jsx, no-freight-line, base64-image,
raw-internal-anchor, theme-block-scope, supabase-in-component, revived-getitemcount,
drawer-autofocus, arbitrary-text-size, section-rhythm, browser-private-credentials.
The credential rule includes admin/UI modules and reports paths, never secret
values. Local Smart Paste sends no text to an AI provider; generation is disabled.
They are structural source
checks, not proof of stored content, live RLS, keyboard behavior or deployment.
Do not weaken/exclude checks to pass. A planted freight violation was detected
and removed on 2 October, and the legitimate source passed afterward.

Run focused tests and npm run ci, inspect the complete diff, then mobile/desktop
browser checks for affected paths. For security prove denial/allowed behavior
as actual SQL roles on disposable staging and use live-safe verification after
authorized deployment. Clearly label synthetic/mock scopes and NOT TESTED cases.
