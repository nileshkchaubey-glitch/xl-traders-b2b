export interface DailySuggestion {
  id: number;
  title: string;
  priority: 'High' | 'Medium' | 'Low';
  impact: 'Conversion' | 'Design' | 'Catalog' | 'Mobile' | 'SEO';
  note: string;
}

export const DAILY_SUGGESTIONS: DailySuggestion[] = [
  { id: 1, title: 'Add MOQ badge to every product card', priority: 'High', impact: 'Conversion', note: 'B2B buyers need minimum order quantity info at a glance. Add a small "MOQ: 50 pcs" badge below the price on every product card.' },
  { id: 2, title: 'Pin a "WhatsApp for bulk rate" button above the fold', priority: 'High', impact: 'Conversion', note: 'First-time B2B visitors want instant pricing. A sticky "Get Bulk Rate on WhatsApp" CTA above the fold can increase enquiry rate significantly.' },
  { id: 3, title: 'Add a category filter bar on the catalog page', priority: 'High', impact: 'Catalog', note: 'When browsing 100+ products, a sticky top filter bar with category pills reduces bounce. Already partially implemented — make it sticky.' },
  { id: 4, title: 'Show product stock status (In Stock / Low Stock / Pre-Order)', priority: 'High', impact: 'Catalog', note: 'Wholesale buyers plan ahead. A green/yellow/red stock badge on cards reduces back-and-forth enquiries.' },
  { id: 5, title: 'Add a "New Arrival" badge to products added in last 30 days', priority: 'Medium', impact: 'Catalog', note: 'Auto-tag products created within 30 days. Keeps returning buyers engaged and highlights fresh stock.' },
  { id: 6, title: 'Add product weight / dimensions to detail page', priority: 'Medium', impact: 'Catalog', note: 'Caterers and cloud kitchens need container volume/capacity. Even approximate size info reduces the need to call.' },
  { id: 7, title: 'Enable lazy loading on all catalog images', priority: 'Medium', impact: 'Mobile', note: 'Large image grids slow mobile loading. Ensure all <img> tags have loading="lazy" and correct aspect ratios to prevent layout shift.' },
  { id: 8, title: 'Add a "Compare Products" feature for similar SKUs', priority: 'Low', impact: 'Conversion', note: 'Allow buyers to compare 2-3 containers side by side (size, price, material). Reduces purchase hesitation for large orders.' },
  { id: 9, title: 'Add an FAQ section on the homepage', priority: 'Medium', impact: 'Conversion', note: 'Common questions: What is MOQ? Do you deliver outside Surat? Can you print logos? An FAQ accordion reduces support load.' },
  { id: 10, title: 'Add a "Request a Sample" button on product detail pages', priority: 'High', impact: 'Conversion', note: 'B2B buyers often want a sample before placing bulk orders. A WhatsApp-linked "Request Sample" button can accelerate decisions.' },
  { id: 11, title: 'Improve mobile category card tap area to minimum 48px', priority: 'High', impact: 'Mobile', note: 'Small tap targets cause frustration on mobile. Ensure each category card is at least 48×48px touchable area.' },
  { id: 12, title: 'Add "Customers Also Buy" section on product detail', priority: 'Medium', impact: 'Conversion', note: 'Cross-sell adjacent products. E.g., a customer looking at cups might also need lids or cup sleeves.' },
  { id: 13, title: 'Add a "Bulk Pricing Table" component to product pages', priority: 'High', impact: 'Conversion', note: 'Show tiered pricing: 100 units = ₹X, 500 units = ₹Y, 1000+ = ₹Z. Wholesale buyers respond strongly to quantity breaks.' },
  { id: 14, title: 'Add skeleton loading states to catalog grid', priority: 'Medium', impact: 'Mobile', note: 'Replace the "Loading..." text with animated skeleton cards that match the product card size. Feels faster.' },
  { id: 15, title: 'Add product category breadcrumbs on detail page', priority: 'Low', impact: 'SEO', note: 'Breadcrumbs like Home > Containers > Round Container > 500ml improve navigation and help search engine crawling.' },
  { id: 16, title: 'Add a "Recently Viewed" horizontal scroll on homepage', priority: 'Medium', impact: 'Conversion', note: 'Store last 5 viewed products in localStorage and show them in a horizontal strip. Helps returning buyers resume quickly.' },
  { id: 17, title: 'Use structured data markup (Schema.org) for products', priority: 'Medium', impact: 'SEO', note: 'Add Product schema JSON-LD to product pages. Enables rich search snippets with price and availability.' },
  { id: 18, title: 'Add an "Express Delivery" badge for same-day stock', priority: 'High', impact: 'Conversion', note: 'Mark certain products as "Available for same-day dispatch in Surat." Creates urgency for local buyers.' },
  { id: 19, title: 'Add a persistent cart / enquiry basket', priority: 'High', impact: 'Conversion', note: 'Let buyers add multiple products to an enquiry basket and send one consolidated WhatsApp message. Reduces friction for multi-product orders.' },
  { id: 20, title: 'Improve image quality by migrating to Supabase Storage', priority: 'High', impact: 'Design', note: 'Google Drive thumbnails can be slow or blocked. Migrate product images to Supabase Storage bucket for reliable, fast CDN serving.' },
  { id: 21, title: 'Add a search suggestions / autocomplete dropdown', priority: 'Medium', impact: 'Catalog', note: 'When typing in the search box, show instant suggestions from product names and categories. Reduces search abandonment.' },
  { id: 22, title: 'Make footer WhatsApp link open a pre-filled message', priority: 'Low', impact: 'Conversion', note: 'Footer WhatsApp link should use wa.me with a pre-filled message like "Hi XL Traders, I need a price list." Small change, big impact.' },
  { id: 23, title: 'Add a "Download Price List" CTA for logged-in users', priority: 'Medium', impact: 'Conversion', note: 'Generate a PDF price list dynamically and let logged-in B2B users download it. Useful for offline sharing with procurement teams.' },
  { id: 24, title: 'Show category product count in the nav bar', priority: 'Low', impact: 'Catalog', note: 'e.g. "Round Containers (48)" in the nav bar. Helps buyers gauge depth of catalog before clicking through.' },
  { id: 25, title: 'Add animated number counters to the trust strip', priority: 'Low', impact: 'Design', note: 'Already partially implemented. Verify the counter animation triggers correctly on scroll-into-view on mobile Chrome.' },
  { id: 26, title: 'Add a full-width promotional banner slot (configurable)', priority: 'Medium', impact: 'Conversion', note: 'A text-based banner at the very top (like "New: 3-ply Aluminum Containers now in stock") is easy to change and great for promotions.' },
  { id: 27, title: 'Add dark-mode support', priority: 'Low', impact: 'Design', note: 'A dark theme for the admin panel would reduce eye strain. The ThemeContext is already set up — just wire in the dark palette.' },
  { id: 28, title: 'Add Google Analytics / Plausible to track top-viewed products', priority: 'Medium', impact: 'Catalog', note: 'Understanding which products get the most views helps prioritize stock and feature placement. Easy to add via a script tag in index.html.' },
  { id: 29, title: 'Speed test on mobile (Lighthouse score target: 80+)', priority: 'High', impact: 'Mobile', note: 'Run Lighthouse on the deployed site. Common issues: oversized images, render-blocking JS. Fix the top 3 issues found.' },
  { id: 30, title: 'Add "Customers like you also ordered" personalization', priority: 'Low', impact: 'Conversion', note: 'Based on the enquiries table, find common co-purchased products and surface them on relevant product pages.' },
];

export function getTodaysSuggestion(): DailySuggestion {
  const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
  const dayOfYear = Math.floor((Date.now() - startOfYear) / 86400000);
  return DAILY_SUGGESTIONS[dayOfYear % DAILY_SUGGESTIONS.length];
}
