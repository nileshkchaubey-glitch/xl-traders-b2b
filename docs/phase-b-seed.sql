-- ============================================================================
-- Phase B — site_content seed
-- Run manually in the Supabase SQL Editor.
--
-- Values are exactly the current storefront copy (== the in-code FALLBACKS in
-- client/src/lib/settingsService.ts), so seeding produces no visible change —
-- it just makes each item editable from Admin → Site Content.
--
-- `on conflict (key) do nothing` → safe to re-run; it will NOT overwrite any
-- rows you've already edited in the admin.
-- ============================================================================

insert into site_content (key, value, updated_at) values
  ('hero', '{"titleLead":"Packaging Solutions For","titleAccent":"Growing Businesses","subline":"Wholesale food containers, paper cups, carry bags, corrugated boxes and restaurant supplies. Order in under a minute — delivered same-day in Surat.","bullets":["Bulk wholesale pricing","24h dispatch","GST invoice on every order"]}'::jsonb, now()),

  ('trust_badge', '{"rating":"4.8 on Google","businesses":"500+ businesses served"}'::jsonb, now()),

  ('trust_stats', '[{"value":"4.8★","label":"Google Rating","sub":"From local businesses"},{"value":"10+","label":"Years in Business","sub":"Wholesale since day one"},{"value":"500+","label":"Businesses Served","sub":"Restaurants to kirana"},{"value":"24h","label":"Dispatch Promise","sub":"Same-day in Surat"}]'::jsonb, now()),

  ('trust_points', '[{"glyph":"GST","title":"GST-registered wholesaler","body":"Proper GST invoice with every order — claim your input credit."},{"glyph":"₹","title":"Transparent wholesale pricing","body":"Sign in to see exact prices; bulk orders unlock better rates."},{"glyph":"✓","title":"Quality-checked supply","body":"Food-grade materials from verified manufacturers."}]'::jsonb, now()),

  ('service_areas', '["Surat City","Udhna","Katargam","Varachha","Navsari","Bardoli","Ankleshwar","Pan-India"]'::jsonb, now()),

  ('faqs', '[{"q":"What is the minimum order quantity?","a":"Each product shows its own MOQ. The cart checks MOQ before you order so there are no surprises later."},{"q":"Do you deliver outside Surat?","a":"Yes — same-day in Surat city, next-day across South Gujarat, and 2–4 days pan-India via surface transport."},{"q":"Do I get a GST invoice?","a":"Every order ships with a GST invoice. Share your GSTIN on WhatsApp once and it is applied to all future orders."},{"q":"Can I get custom printing on bags and boxes?","a":"Yes, for bulk orders. Use the Bulk Quote button and we respond within 2 business hours with slab pricing."}]'::jsonb, now()),

  ('bulk_banner', '{"eyebrow":"Bulk & Custom Orders","title":"Ordering 10,000+ units or need custom branding?","body":"Get a dedicated quote with slab pricing, custom printing and scheduled deliveries. Response within 2 business hours."}'::jsonb, now()),

  ('announcement', '{"gstLine":"GST Registered Wholesaler","deliveryLine":"Same-day delivery in Surat · 24h dispatch pan-India","hours":"Mon–Sat 9AM–9PM","mobilePill":"Same-day Surat"}'::jsonb, now()),

  ('footer', '{"description":"Wholesale food packaging & disposables for restaurants, cafés, cloud kitchens, caterers and distributors. Surat, Gujarat.","address":"Surat, Gujarat 395002","tagline":"You Order, We Deliver — wholesale in under 60 seconds.","ordering":["Same-day delivery in Surat","24h dispatch pan-India","GST invoice on every order","Order & confirm on WhatsApp"]}'::jsonb, now()),

  ('gst_enabled', 'false'::jsonb, now()),

  ('gst_percentage', '0'::jsonb, now())
on conflict (key) do nothing;
