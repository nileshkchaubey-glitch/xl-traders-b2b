// Catalogue completeness scoring shared by AdminProducts, AdminOverview and
// the SEO tab. Five equally-weighted dimensions; 20 points each.
// Ported from Catalog Studio (xl-catalog-studio.html).

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

// "Needs Attention" quick filters, applied to the Products tab query.
export type AttentionFilter = 'no-image' | 'no-price' | 'no-slug' | null;

export const ATTENTION_LABELS: Record<Exclude<AttentionFilter, null>, string> = {
  'no-image': 'No image',
  'no-price': 'No price',
  'no-slug': 'No slug',
};
