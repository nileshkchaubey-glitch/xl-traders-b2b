-- Migration 02: Add SKU, barcode, MOQ to products
-- Run manually against your Supabase project SQL editor

-- Add new columns (idempotent)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS moq INTEGER DEFAULT 1;

-- Ensure sku column exists (may already exist in some setups)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku TEXT;

-- Backfill SKU for all products that don't have one yet
-- Format: {FIRST-3-LETTERS-OF-CATEGORY}-{4-DIGIT-SEQUENCE}
-- e.g. BAL-0001, BAC-0002
DO $$
DECLARE
  rec RECORD;
  cat_prefix TEXT;
  seq_num INTEGER;
BEGIN
  FOR rec IN
    SELECT p.id, p.category_id, c.name AS category_name
    FROM public.products p
    JOIN public.categories c ON c.id = p.category_id
    WHERE p.sku IS NULL OR p.sku = ''
    ORDER BY p.created_at ASC
  LOOP
    -- Get 3-letter prefix from category name (uppercase, letters only)
    cat_prefix := UPPER(REGEXP_REPLACE(LEFT(rec.category_name, 3), '[^A-Za-z]', '', 'g'));
    IF LENGTH(cat_prefix) < 3 THEN
      cat_prefix := LPAD(cat_prefix, 3, 'X');
    END IF;

    -- Find next sequence for this prefix
    SELECT COALESCE(MAX(
      CASE WHEN sku ~ ('^' || cat_prefix || '-[0-9]{4}$')
        THEN (SPLIT_PART(sku, '-', 2))::INTEGER
        ELSE 0
      END
    ), 0) + 1
    INTO seq_num
    FROM public.products
    WHERE sku LIKE cat_prefix || '-%';

    -- Assign SKU
    UPDATE public.products
    SET sku = cat_prefix || '-' || LPAD(seq_num::TEXT, 4, '0')
    WHERE id = rec.id;
  END LOOP;
END $$;

-- Unique index on sku (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku
  ON public.products(sku)
  WHERE sku IS NOT NULL AND sku <> '';

-- Non-unique index on barcode (same barcode can exist for variants)
CREATE INDEX IF NOT EXISTS idx_products_barcode
  ON public.products(barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';
