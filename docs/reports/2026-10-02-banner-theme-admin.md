# Banner/theme admin verification

Verified before implementing: the storefront service and ThemeProvider existed,
but Site Content offered no promo_banners or site_theme editing controls. The
category_top slot had no consumer. Live production inspection found zero banners,
site_theme=default, promo_banners RLS enabled, the active/start/end read policy,
admin is_admin() management policy and current position/date-window constraints.
site_content uses key/value/updated_at, public reads and admin writes. Existing
schemas are compatible; no migration or production mutation was required.

Added create/edit/deactivation controls inside the existing Site Content surface,
shared service validation, inactive creation, explicit target updates and no
deletion operation. Local scheduling values persist as UTC. Safe URL handling
rejects script/data/protocol-relative/credential-bearing targets, including at
render time for pre-existing records. Storefront queries explicitly gate active
and current schedules because the admin management RLS policy can see all rows.
Category-filtered catalogue pages now consume the existing shared category slot;
there is no new per-category targeting, copy, price claim or theme engine.

The five existing themes use a shared vocabulary. Successful saves notify the
mounted provider; denied/unsupported saves do not change the effective theme.
CSS changes remain accent/hero colour variables. No layout/price/order logic or
authorization source changes. Existing other Site Content sections are retained.

Validation on Node 20.20.2:

- npm test -- client/src/lib/promoBannerService.test.ts client/src/lib/siteTheme.test.ts:
  20 service/vocabulary checks passed for safe URLs, activation defaults, exact
  update targets, normalized dates, invalid schedules/sort values, write-denial,
  nonfatal public reads and theme notification/cache behavior. A test hook
  accidentally returned a mock as its teardown callback; fixed the harness
  without changing production error handling or removing assertions.
- npm test -- client/src/lib/bannerThemeAccess.test.ts: 15 assertions in one
  in-memory PostgreSQL scenario using the inspected relevant policies and
  existing authorization migration. Anonymous/customer reads expose only the
  live banner, writes/upserts are denied and update/delete affect zero rows.
  Admins see/manage records, new banner defaults inactive and theme saves work.
  This is a minimal synthetic policy fixture, not a hosted/full-schema test.
- npm run ci: 252 application tests, existing 41 authorization, 12 minimum-order
  and 13 reconfirmation assertions, TypeScript, guardrails and build/PWA passed.
- Actual Chrome at 390×844 and 1440×900 with synthetic database responses:
  real Site Content/banner form and storefront banner component exercised.
  Inactive/future/expired fixtures and new inactive banners rendered no wrapper;
  activation showed an internal Wouter link and deactivation removed the slot.
  Unsafe image URL and reversed schedule were blocked before writes. All five
  themes changed the actual CSS accent; a denied theme save preserved default.
  Autofocus plus an actual Tab press followed the form order; no overflow,
  page error or hosted Supabase request occurred.

Hosted admin/banner/theme writes remain NOT TESTED because valid admin test
access is unavailable. No banner, theme, catalogue/account/order/storage data,
schema, function, policy or grant was changed in production. Empty production
slots remain empty. The existing broad table grants were not widened; policy
behavior is the authorization gate tested here.

Deployment: code-only focused PR with required CI green; no SQL to apply.
Rollback: revert the code commit. Preserve existing banner/theme records;
do not delete data or loosen security. ThemeProvider still falls back to default
for unknown values. Prior code can serve existing stored banner URLs/text.
