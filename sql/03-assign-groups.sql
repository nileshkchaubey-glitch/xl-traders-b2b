-- ============================================================================
-- 03-assign-groups.sql
--
-- Adds group_name, group_order, and image_url columns to categories (if
-- they don't exist yet), then assigns every existing category to one of
-- 5 logical groups based on name.
--
-- Run once in the Supabase SQL Editor after deploying the 2-level catalog.
-- Safe to re-run (UPDATE ... WHERE slug = '...' is idempotent).
-- ============================================================================

-- 1. Add columns if missing
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS group_name  TEXT,
  ADD COLUMN IF NOT EXISTS group_order INTEGER,
  ADD COLUMN IF NOT EXISTS image_url   TEXT;

-- ============================================================================
-- 2. Assign groups
-- ============================================================================

-- GROUP 1 · Food Containers (rigid plastic & aluminium containers)
UPDATE public.categories
SET group_name = 'Food Containers', group_order = 1
WHERE slug IN (
  'round-container',
  'rectangle-container',
  'hinged-container',
  'aluminum-containers',
  'premium-container',
  'rice-bowl'
);

-- GROUP 2 · Tableware & Takeaway (cups, bowls, trays used for serving)
UPDATE public.categories
SET group_name = 'Tableware & Takeaway', group_order = 2
WHERE slug IN (
  'paper-cup',
  'ripple-cup',
  'meal-tray',
  'paper-ice-cream-wati'
);

-- GROUP 3 · Food Packaging & Presentation (boxes, wraps, pouches)
UPDATE public.categories
SET group_name = 'Food Packaging & Presentation', group_order = 3
WHERE slug IN (
  'paper-box',
  'pizza-box',
  'burger-sandwich-box',
  'foil',
  'silver-pouch',
  'cling-wrap'
);

-- GROUP 4 · Hygiene, Cleaning & Facility Care (PPE, tissues, adhesives)
UPDATE public.categories
SET group_name = 'Hygiene, Cleaning & Facility Care', group_order = 4
WHERE slug IN (
  'gloves',
  'bouffant-cap',
  'shipper-glasses',
  'tissue',
  'adhesive'
);

-- GROUP 5 · Decoration & Party (no current categories — ready for future)
-- No rows updated yet. Add future categories with:
--   UPDATE public.categories SET group_name = 'Decoration & Party', group_order = 5 WHERE slug = '...';

-- ============================================================================
-- 3. Verify
-- ============================================================================
SELECT slug, name, group_name, group_order
FROM public.categories
ORDER BY group_order NULLS LAST, display_order;
