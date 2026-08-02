import { useEffect, useState } from "react";
import { masterService, type ProductMaster } from "@/lib/masterService";
import type { InheritedField } from "@/lib/seriesInheritance";

/**
 * Loads the series behind a variant so ADMIN surfaces can show what an empty
 * field will inherit — without seeding the editor with that value.
 *
 * This is deliberately a *separate* fetch rather than resolving the product:
 * admin reads stay raw (see `seriesInheritance.ts`), because a form seeded with
 * inherited text writes that text back onto the variant on the next save, which
 * is exactly the copy-on-create behaviour PIM P2 removed. The hint reads from
 * here; the form keeps reading the raw row.
 *
 * Without this, an operator working through 47 series sees a blank Description
 * with "Add description" and fills it in per variant — destroying the leverage
 * read-through exists to create.
 */
export interface SeriesInheritance {
  series: ProductMaster | null;
  /** Primary image of the series, or its lowest-ordered one. */
  seriesImage: string | null;
  loading: boolean;
  /** The value this field would inherit, or null if the series has none. */
  valueFor: (field: InheritedField) => string | null;
}

function primaryImage(series: ProductMaster | null): string | null {
  const images = series?.product_master_images ?? [];
  if (images.length === 0) return null;
  const primary = images.find(img => img.is_primary);
  if (primary) return primary.image_url;
  return [...images].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  )[0].image_url;
}

export function useSeriesInheritance(
  masterId: string | null | undefined
): SeriesInheritance {
  const [series, setSeries] = useState<ProductMaster | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!masterId) {
      setSeries(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    masterService
      .getSeriesWithImages(masterId)
      .then(s => {
        if (!cancelled) setSeries(s);
      })
      .catch(() => {
        // A missing series is not an error worth interrupting data entry for —
        // the hint simply doesn't render.
        if (!cancelled) setSeries(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [masterId]);

  const seriesImage = primaryImage(series);

  const valueFor = (field: InheritedField): string | null => {
    if (!series) return null;
    const raw =
      field === "image_url"
        ? seriesImage
        : field === "brand"
          ? series.brand
          : series[field];
    const trimmed = typeof raw === "string" ? raw.trim() : raw;
    return trimmed ? String(trimmed) : null;
  };

  return { series, seriesImage, loading, valueFor };
}
