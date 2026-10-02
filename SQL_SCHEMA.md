# Database implementation map

This is a reference, not executable bootstrap DDL. The earlier incomplete schema
and sample data are preserved as history. Inspect the live schema before SQL;
TypeScript interfaces and old CREATE snippets are not migration truth.

Production project: `danoeaftaazhbldeeuxj`. A schema-only capture was compared
with live metadata on 2 October before reviewed checkout migrations. It contains
15 public tables, two public views, auth.users and required Auth helpers; no real
customer/catalogue/order rows were copied to disposable staging.

| Area | Objects / code |
| --- | --- |
| Catalogue | products, categories, brands, product_masters, product_images, product_master_images; product/master services |
| Ordering | orders, order_items; orderService and confirmed-price RPC |
| Identity | user_profiles; authStore and public.is_admin() |
| Leads | enquiries and inquiries are intentionally separate |
| Content/admin | site_content, promo_banners, business_settings, import_logs |
| Views | v_category_live_counts (published+active counts), v_product_health (health flags under caller RLS) |

products.price is per selling unit; quantity_in_unit is pack size; moq counts
packs. order_unit is pack/pcs; order_step is pieces and valid multiples resolve
through orderingModel. price_per_piece is generated and must not be readable
by anon. New products default to draft. Keep published+active public gates and
uncategorized, and never rerun sql/02-public-read-policies.sql.

business_settings is a key/value table (id, key, value, updated_at), not one wide
row with phone/address columns. site_content also stores key/jsonb values.
The current AdminSettings mismatch is tracked in launch status. pg_trgm name
GIN index products_name_trgm already exists; do not duplicate it from the handoff.

Authorization is database-owned: protected profile flags, admin-only settings/
import writes, anon denial on v_product_health, scoped orders and protected atomic
order creation. Admins/customers share authenticated SQL role; table grants alone
do not prove a customer may write. Test RLS behavior with the actual role.

The four files in [supabase/migrations](supabase/migrations) represent reviewed
authorization, atomic creation, minimum enforcement and price reconfirmation.
Installed history timestamps can differ from filenames. All four are applied
by name/definition as verified in [CHANGELOG_SQL](docs/CHANGELOG_SQL.md); old data
foundation SQL also exists in docs/sql and is historical, not a reset procedure.
The confirmed RPC is customer-executable; legacy RPC is revoked after reconfirmation.

Use [supabase/tests/README](supabase/tests/README.md) for role tests and the
[restored-schema report](docs/reports/2026-09-23-price-reconfirmation-validation.md)
for complete disposable validation, preserved rollback and hosted-service limits.
