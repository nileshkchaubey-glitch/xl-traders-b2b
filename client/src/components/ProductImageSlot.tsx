import { useEffect, useState } from "react";
import type { Product } from "@/lib/supabase";
import { normalizeImageUrl } from "@/lib/imageUtils";

const MONOGRAM = "/images/brand/xl-monogram.png";

/**
 * The image fallback chain (docs/DESIGN_SYSTEM.md §3.2). Three tiers:
 *
 *   1. product photo        — a genuine shot of this SKU
 *   2. category default     — one honest image for the aisle
 *   3. XL monogram + size   — the pack size at display scale over a 9% watermark
 *
 * Tier 3 is the DESIGN, not a degraded state. Most of the catalogue lands
 * there, and on a catalogue of near-identical black containers the capacity and
 * pack count identify a product far better than a stock photo of a black
 * container would. So the size figure is the loudest thing in the slot — twelve
 * cards read as twelve products, not twelve logos.
 *
 * The tier is resolved at RUNTIME, not just from whether a URL exists: a URL
 * that 404s (or a Google-Drive link that fails) advances the tier via onError,
 * so a dead link falls through to the watermark instead of leaving a broken
 * image. That matters here specifically — 127 of 143 products point at
 * Google Drive, which has failed wholesale before.
 */
interface ProductImageSlotProps {
  product: Pick<
    Product,
    | "name"
    | "image_url"
    | "image_alt_text"
    | "category_id"
    | "quantity_in_unit"
    | "unit_of_measure"
  >;
  /** Tier-2 source, from useCategoryImages(). Undefined = skip tier 2. */
  categoryImageUrl?: string;
  /** The headline figure over the watermark — "500" / "2" / "M". */
  size?: string | null;
  /** Its unit — "ml", "cmp", "size". Rendered small, uppercase, tracked. */
  sizeUnit?: string | null;
  /**
   * Set when `size` IS the pack count (no capacity was parseable), so the
   * "N pcs/pack" line is suppressed rather than stating the same number twice.
   */
  sizeIsPackCount?: boolean;
}

export default function ProductImageSlot({
  product,
  categoryImageUrl,
  size,
  sizeUnit,
  sizeIsPackCount = false,
}: ProductImageSlotProps) {
  // Candidate sources in tier order. normalizeImageUrl rewrites Google Drive
  // share links to the thumbnail form that actually renders (Critical Rule #7).
  const sources = [
    normalizeImageUrl(product.image_url, 600),
    categoryImageUrl ? normalizeImageUrl(categoryImageUrl, 600) : null,
  ].filter(Boolean) as string[];

  const [failed, setFailed] = useState(0);

  // A product can be swapped into the same slot (grid re-filter, pagination),
  // and a stale failure count would wrongly demote the incoming product's
  // perfectly good photo. Reset whenever the source list changes.
  const sourceKey = sources.join("|");
  useEffect(() => {
    setFailed(0);
  }, [sourceKey]);

  const src = sources[failed];
  const isCategoryImage = !!src && failed > 0;

  const packLine =
    product.quantity_in_unit && !sizeIsPackCount
      ? `${product.quantity_in_unit.toLocaleString("en-IN")} ${product.unit_of_measure ?? "pcs"}/pack`
      : null;

  // ── Tiers 1 & 2 — a real image fills the slot ──────────────────────────────
  if (src) {
    return (
      <>
        <div className="relative w-full aspect-[3/2] md:aspect-[8/5] bg-sunken overflow-hidden">
          <img
            src={src}
            alt={product.image_alt_text || product.name}
            loading="lazy"
            decoding="async"
            // Advancing the index re-renders with the next candidate; when the
            // list is exhausted `src` becomes undefined and tier 3 renders.
            onError={() => setFailed(f => f + 1)}
            className={`w-full h-full object-cover ${
              // Tier 2 identifies the aisle rather than the product and repeats
              // across a category, so it is desaturated to read as a stand-in.
              isCategoryImage ? "saturate-[.7]" : ""
            }`}
          />
          {isCategoryImage && (
            <span className="absolute left-0 bottom-0 bg-ink text-white font-mono text-meta font-medium uppercase tracking-[0.1em] px-[7px] py-[5px]">
              Category image
            </span>
          )}
        </div>
        {/* With a photo the size sits UNDER the image, at supporting scale. */}
        <div className="flex items-baseline gap-[9px] mt-[11px]">
          {size && (
            <span className="font-mono text-figure-sm md:text-figure-md font-bold text-ink tracking-[-0.04em] tabular-nums">
              {size}
            </span>
          )}
          {sizeUnit && (
            <span className="font-mono text-meta md:text-caption font-medium uppercase tracking-[0.14em] text-ink-faint">
              {sizeUnit}
            </span>
          )}
          {product.quantity_in_unit && !sizeIsPackCount && (
            <span className="font-mono text-meta md:text-caption font-medium text-ink-faint ml-auto tabular-nums">
              {product.quantity_in_unit.toLocaleString("en-IN")}/pack
            </span>
          )}
        </div>
      </>
    );
  }

  // ── Tier 3 — monogram watermark, pack size carries the identification ──────
  return (
    <div className="relative overflow-hidden pt-2 pb-0.5">
      <img
        src={MONOGRAM}
        alt=""
        aria-hidden="true"
        // Bled off the right edge so no two cards frame it identically, and
        // held at 9% so it stays texture rather than becoming the subject.
        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-[74%] md:w-[70%] h-auto opacity-[0.09]"
      />
      <div className="relative flex items-baseline gap-[9px]">
        {size && (
          <span className="font-mono text-figure md:text-figure-lg font-bold text-ink tracking-[-0.045em] tabular-nums">
            {size}
          </span>
        )}
        {sizeUnit && (
          <span className="font-mono text-meta md:text-caption font-medium uppercase tracking-[0.14em] text-ink-faint">
            {sizeUnit}
          </span>
        )}
      </div>
      {packLine && (
        <div className="relative font-mono text-caption md:text-micro font-medium text-ink-muted mt-[9px] tabular-nums">
          {packLine}
        </div>
      )}
    </div>
  );
}
