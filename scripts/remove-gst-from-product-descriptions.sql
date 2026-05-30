-- Run in Supabase SQL Editor to strip GST wording from existing product descriptions.
UPDATE public.products
SET description = trim(
  regexp_replace(
    regexp_replace(description, ',?\s*GST invoicing( available)?\.?', '', 'gi'),
    '\s{2,}',
  ' ',
    'g'
  )
)
WHERE description IS NOT NULL
  AND description ~* 'gst';
