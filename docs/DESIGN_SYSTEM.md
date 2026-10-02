# Design system — current implementation

Read the latest owner scope and STOREFRONT_RULES first. Tokens live in
[client/src/index.css](../client/src/index.css); geometry references live under
design-reference. Render the reference to compare layout. Prototype sample
claims are not catalogue/business truth. Earlier detailed notes are archived.

## Tokens, shell and theme

Tailwind v4 uses @tailwindcss/vite, @import tailwindcss and tw-animate-css;
there is no Tailwind/PostCSS config or typography plugin. Inter is the sans
font. Reuse existing semantic text tokens instead of arbitrary text-[Npx].
caption/body-sm/body-md/display and the role tokens are defined in @theme.
Role siblings include price-card, price-detail, price-hero, price-unit,
product-name, brand, chip, meta, product-title, page-title, heading-section,
heading-row and heading-sub, with -lg values for desktop. CSS is the exact
numeric authority; do not copy obsolete sizes from archived measurements.

xl-shell caps desktop at 1440px with 16/24/32px mobile/tablet/desktop gutters.
Avoid container overrides. Responsive storefront type uses the semantic tokens.
Admin palette tokens and Tailwind colors/weights remain; no redesign is implied.

ThemeContext reads site_content.site_theme, validates default/diwali/holi/monsoon/
independence, and writes data-xl-theme. Theme selectors change only --xl-accent,
--xl-accent-soft and --xl-hero-grad. They must not affect layout, pricing or
ordering. Admin theme editing remains pending at this record.

## Current components and composition

One StorefrontLayout owns Header and Footer; Header alone renders MobileNav.
Footer is desktop-only; Account carries mobile contact/help. Main spacing stays
with the page for cart/PDP bottom bars. Home is HeroSlideshow → top PromoBanners
→ HomeCategoryGrid → HomeSpotlightStrip → middle PromoBanners → two MerchandisedRow
sections. HeroMotionTiles, HomeCatalogueShowcase and framer-motion reveals are
retired. Do not restore them based on an old shipped list.

Reuse ProductCard, PriceSlot, ProductImage, ProductMeta, PageTitleBar and
QuantityStepper. PriceSlot reserves the same space for guest and signed-in
branches; verify parity on rendered cards rather than asserting an old pixel
height. PDP's mobile fixed buy bar, desktop sticky column, Similar products and
notes are deliberate documented deviations, not arbitrary redesign targets.

New image uploads preserve the selected original plus 800/1600 maximum-edge
WebP renditions. The shared uploader records actual widths in managed filenames;
ProductImage emits width-based srcSet only for those guaranteed siblings. Small
sources are not enlarged and do not claim two distinct resolutions. Legacy
Storage/external images retain one source; Drive retains its real thumbnails.
No paid Supabase transformations or base64 product images are used. Originals
and companion renditions are hidden from separate Image Library/SKU choices.

Remaining UI primitives: alert-dialog, badge, button, card, checkbox, command,
confirm-dialog, context-menu, dialog, drawer, dropdown-menu, input, label,
popover, select, sheet, skeleton, sonner, switch, table, textarea, tooltip;
DataTable is also in that directory as the shared table building block.
Keep alert-dialog/confirm-dialog and the single confirmation host.

Breadcrumbs are hand-written Wouter Link + ChevronRight + current-item label in
desktop PDP and AdminMasters; mobile PDP uses PageTitleBar's back link. There
is no unused shadcn breadcrumb primitive. Drawers enable autoFocus, contain
Tab/Shift+Tab and return focus on Escape. Category/master sheets override the
matching data-[vaul-drawer-direction=bottom]:max-h-[85vh] variant; a plain max-h
utility loses to the primitive's matching variant. Real keyboard checks passed
390×844 and 1440×900 on the actual sheet components with synthetic props.

## Architecture and verification

Components call existing services. useProductForm/productForm share the route
and CatalogProductPanel save path; CatalogTreeEditor is the products surface.
Reuse category/brand pickers and ProductMediaSection. Do not create Admin-v2.
Existing legacy component queries are checker-grandfathered debt, not a pattern.
Health flags/counts stay in the views; ordering arithmetic stays in orderingModel.

Run TypeScript, guardrails, focused tests and full CI. Check mobile/desktop
interaction, overflow, price privacy and focus in a browser. Tests must distinguish
actual hosted access from intercepted synthetic component data. See DEPLOYMENT,
TEST_ADMIN and launch status for deployment/auth/physical-device limitations.
