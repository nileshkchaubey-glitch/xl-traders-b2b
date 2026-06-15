// Catalogue completeness scoring shared by AdminProducts, AdminOverview and
// the SEO tab. Five equally-weighted dimensions; 20 points each.
// Ported from Catalog Studio (xl-catalog-studio.html).
// NOTE: v_product_health (Supabase view) is now the authoritative source of
// missing-field data. These local TS checks will be retired in a later step
// once the dashboard and filters are wired to healthService.getMissingCounts().

export interface CompletenessInput {
  image_url?: string | null;
  price?: number | null;
  category_id?: string | null;
  slug?: string | null;
  meta_title?: string | null;
}

export interface CompletenessResult {
  score: number;
  missing: string[];
}

export function productCompleteness(p: CompletenessInput): CompletenessResult {
  const missing: string[] = [];
  if (!p.image_url) missing.push('image');
  if (!p.price || p.price <= 0) missing.push('price');
  if (!p.category_id) missing.push('category');
  if (!p.slug) missing.push('slug');
  if (!p.meta_title) missing.push('meta title');
  return { score: (5 - missing.length) * 20, missing };
}

export function completenessColor(score: number): string {
  if (score === 100) return 'bg-green-100 text-green-700';
  if (score >= 60) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Same templates Catalog Studio used for auto-generated SEO fields.
export function metaTitleFor(name: string, categoryName?: string): string {
  return (name + (categoryName ? ' — ' + categoryName : '') + ' | XL Traders').slice(0, 60);
}

export function metaDescriptionFor(name: string, categoryName?: string, description?: string | null): string {
  const base = description?.trim()
    ? description.trim().slice(0, 140)
    : `Buy ${name}${categoryName ? ' (' + categoryName + ')' : ''} wholesale at XL Traders, Surat. Bulk rates, free delivery.`;
  return base.slice(0, 155);
}

// "Missing…" quick filters for the Products tab. The truth for what counts as
// "missing" lives in the v_product_health DB view (and healthService) — these
// keys only name the dimension and map to that view's boolean columns. Never
// re-implement the missing-logic in TS.
export type MissingFilter =
  | 'no-price'
  | 'no-category'
  | 'no-moq'
  | 'no-brand'
  | 'no-image'
  | 'no-specs'
  | 'no-description'
  | 'no-seo';

export type AttentionFilter = MissingFilter | null;

export const MISSING_FILTERS: MissingFilter[] = [
  'no-price', 'no-category', 'no-moq', 'no-brand',
  'no-image', 'no-specs', 'no-description', 'no-seo',
];

export const ATTENTION_LABELS: Record<MissingFilter, string> = {
  'no-price': 'No price',
  'no-category': 'No category',
  'no-moq': 'No MOQ',
  'no-brand': 'No brand',
  'no-image': 'No image',
  'no-specs': 'No specs',
  'no-description': 'No description',
  'no-seo': 'No SEO',
};

// Maps a filter key to the healthService MissingCounts key (== the
// v_product_health column suffix, e.g. 'specifications' → missing_specifications).
export type MissingField =
  | 'price' | 'category' | 'moq' | 'brand'
  | 'image' | 'specifications' | 'description' | 'seo';

export const ATTENTION_FIELD: Record<MissingFilter, MissingField> = {
  'no-price': 'price',
  'no-category': 'category',
  'no-moq': 'moq',
  'no-brand': 'brand',
  'no-image': 'image',
  'no-specs': 'specifications',
  'no-description': 'description',
  'no-seo': 'seo',
};

export function isMissingFilter(value: string | null | undefined): value is MissingFilter {
  return !!value && (MISSING_FILTERS as string[]).includes(value);
}
