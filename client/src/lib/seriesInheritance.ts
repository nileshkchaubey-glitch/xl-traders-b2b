import { Product } from "./supabase";

/**
 * PIM P2 — series read-through inheritance.
 *
 * "Series" is the owner's and the suppliers' word for what the schema calls
 * `product_masters` (see CLAUDE.md glossary). A variant is a product row with
 * `master_id IS NOT NULL`.
 *
 * A variant inherits presentation fields from its series **when its own value
 * is empty**. The variant always wins when it has a value of its own.
 *
 * This is READ-THROUGH, not copy-on-create. Nothing is written into the variant
 * row, so editing the series immediately updates every variant that has not
 * overridden the field — one description covers eleven Hinged box sizes. The
 * previous implementation copied instead: `masterService.addVariant` snapshotted
 * brand/description at insert time (so later series edits never reached existing
 * variants) and `setMasterPrimaryImage` ran an unconditional
 * `UPDATE products SET image_url = … WHERE master_id = …` that destroyed
 * per-variant photos. Both were deleted in this PR; this resolver replaces them.
 *
 * Resolution lives HERE and nowhere else — components must never re-implement
 * it (CLAUDE.md architecture rule #1), exactly as `v_product_health` is the only
 * home for missing-field logic. The view was extended in the same PR so an
 * inherited description/brand/meta_title no longer counts as missing.
 *
 * **Applied on public read paths only** (`getAll`, `getById`, `getFeatured`,
 * `search`, `getVariantsByMasterId`). Admin fetches stay RAW on purpose: an
 * editor seeded with inherited text would save that text back into the variant
 * on the next submit, silently recreating the copy-on-create problem this
 * replaces. Admin surfaces that want to show what a variant inherits should read
 * the series directly via `masterService`.
 */

/** Fields a variant can inherit from its series. `brand`/`brand_id` move as a pair. */
export const INHERITED_FIELDS = [
  "description",
  "meta_title",
  "meta_description",
  "brand",
  "image_url",
] as const;

export type InheritedField = (typeof INHERITED_FIELDS)[number];

/** The master shape embedded by `SERIES_SELECT`. */
export interface EmbeddedSeries {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  brand?: string | null;
  brand_id?: string | null;
  sort_order?: number | null;
  product_master_images?: Array<{
    image_url: string;
    is_primary: boolean | null;
    display_order: number | null;
  }> | null;
}

/**
 * PostgREST embedded-resource clause for the series + its images. Append to an
 * existing select list — it composes with both `"*"` (authenticated) and the
 * narrowed `GUEST_PRODUCT_COLS` (anon) that `productSelectCols()` returns.
 *
 * Safe for guests: `product_masters` carries no price columns, anon holds SELECT
 * on all 13 of them, and its RLS policy (`is_active = true`) means an archived
 * series embeds as null rather than leaking.
 */
export const SERIES_SELECT =
  "product_masters(id,name,slug,description,meta_title,meta_description," +
  "brand,brand_id,sort_order,product_master_images(image_url,is_primary,display_order))";

/** A product as it arrives from a query that included `SERIES_SELECT`. */
export type ProductWithSeries = Product & {
  product_masters?: EmbeddedSeries | null;
};

/** The resolved product handed to components. */
export type ResolvedProduct = Product & {
  /** Series metadata, present only for variants. UI may show "part of X". */
  series?: { id: string; name: string; slug: string } | null;
  /** Which fields came from the series rather than the row itself. */
  inherited_fields?: InheritedField[];
};

/**
 * True when a field holds no operator-entered value. Empty string counts as
 * empty — `products.brand` defaults to `''`, so a NULL check alone would treat
 * every unbranded row as "set" and block inheritance.
 */
function isBlank(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

/** The series' primary image, falling back to its lowest-ordered one. */
function seriesPrimaryImage(series: EmbeddedSeries): string | null {
  const images = series.product_master_images ?? [];
  if (images.length === 0) return null;
  const primary = images.find(img => img.is_primary);
  if (primary) return primary.image_url;
  return [...images].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  )[0].image_url;
}

/**
 * Fills a variant's empty fields from its series. Standalone products (no
 * `master_id`, or no embedded series) are returned untouched apart from having
 * the embedded relation stripped.
 */
export function resolveSeries(row: ProductWithSeries): ResolvedProduct {
  const { product_masters: series, ...product } = row;
  if (!series) return product as ResolvedProduct;

  const resolved: ResolvedProduct = {
    ...(product as Product),
    series: { id: series.id, name: series.name, slug: series.slug },
  };
  const inherited: InheritedField[] = [];

  if (isBlank(resolved.description) && !isBlank(series.description)) {
    resolved.description = series.description!;
    inherited.push("description");
  }
  if (isBlank(resolved.meta_title) && !isBlank(series.meta_title)) {
    resolved.meta_title = series.meta_title!;
    inherited.push("meta_title");
  }
  if (isBlank(resolved.meta_description) && !isBlank(series.meta_description)) {
    resolved.meta_description = series.meta_description!;
    inherited.push("meta_description");
  }

  // brand_id is canonical (unbranded == brand_id IS NULL) and the legacy text
  // column is dual-written, so the two must inherit together or a variant ends
  // up with a name from the series and no link — the same desync `bulkSetBrand`
  // guards against with its paired Undo snapshot.
  if (resolved.brand_id == null && isBlank(resolved.brand)) {
    if (series.brand_id != null || !isBlank(series.brand)) {
      resolved.brand_id = series.brand_id ?? null;
      resolved.brand = series.brand ?? "";
      inherited.push("brand");
    }
  }

  if (isBlank(resolved.image_url)) {
    const image = seriesPrimaryImage(series);
    if (image) {
      resolved.image_url = image;
      inherited.push("image_url");
    }
  }

  if (inherited.length > 0) resolved.inherited_fields = inherited;
  return resolved;
}

/** `resolveSeries` over a result set. */
export function resolveSeriesAll(rows: ProductWithSeries[]): ResolvedProduct[] {
  return rows.map(resolveSeries);
}
