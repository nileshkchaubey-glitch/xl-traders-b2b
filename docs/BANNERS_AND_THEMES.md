# Banner and theme controls

Open Admin → Site Content. The Site theme selector supports default, diwali,
holi, monsoon and independence. Save applies the accent/hero colours in the
mounted theme provider; layout, catalogue prices and ordering are unaffected.
Unsupported themes are rejected before writing. Failed saves leave the effective
theme unchanged. A newly opened session reads the persisted site_content key.

Promo banners use the existing promo_banners table. Add a headline, optional
public text/image/link, position, sort order and optional scheduling window.
Only verified public copy belongs here, never computed/protected rates or
unconfirmed commercial promises. Existing Image Library HTTPS URLs and same-site
paths are accepted. Script/data/protocol-relative URLs and URL credentials are
rejected. Rendering also rejects unsafe stored image/link targets.

New banners start inactive. Edit a saved banner to enable it; deactivate to hide
it while preserving its record. There is no deletion operation. Start/end inputs
are browser-local time, stored as UTC timestamps. End must be after start.
Positions are Home top, Home middle and a shared slot on category-filtered
catalogue pages; the schema has no per-category targeting field. Empty or inactive
slots render nothing, including no reserved wrapper/space. Public service queries
filter activation/scheduling even for admins who can see management records.

Authorization stays in the existing database is_admin()/RLS policies, not client
metadata. Public/customer banner reads require an active, current scheduling
window; banner and site_content writes require database admin truth. No grants,
policy, schema, production copy/theme/banner or paid infrastructure changed.

Code verification and hosted-test limitations are recorded in
[the report](reports/2026-10-02-banner-theme-admin.md). Unit, in-memory role and
real Chrome fixture tests are distinct from hosted admin write verification.
