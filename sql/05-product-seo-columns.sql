-- Adds SEO columns to products for the admin SEO tab and completeness scoring.
-- Run this in the Supabase SQL editor before using the SEO tab.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS meta_description TEXT;

CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
