import { useEffect, useState } from "react";
import { Link } from "wouter";

import ProductImage from "@/components/storefront/ProductImage";
import { productService } from "@/lib/productService";
import type { Product } from "@/lib/supabase";

/** The prototype shows 12 tiles; the track is duplicated once so -50% loops. */
const COUNT = 12;

/**
 * The product spotlight strip — an auto-scrolling row of product tiles.
 *
 * Ported from `design-reference/xl-traders-storefront.source.dc.html`
 * (between the category grid and the second banner slot, both breakpoints).
 *
 * ⚠️ A marquee was DELETED in storefront PR-1, so reintroducing one needs a
 * reason rather than a shrug. The objection then was **duplication**: that
 * marquee scrolled brand names and value props that the static trust row
 * directly above it already listed, so it repeated content the eye had just
 * read. This one carries real, clickable PRODUCTS that appear nowhere else on
 * the page — it duplicates nothing. The pattern was never the problem.
 *
 * Motion: reuses the existing `.xl-marquee` class, which already pauses on
 * hover and is switched off entirely under `prefers-reduced-motion` in
 * index.css. The prototype's 52s (ours was 34s) is slower because these are
 * images to glance at, not text to read.
 *
 * Renders NOTHING when there are no products — no skeleton, no reserved
 * space. Same rule as the promo slot (STOREFRONT_RULES §4.3): a storefront
 * with nothing to spotlight must look deliberate.
 */
export default function HomeSpotlightStrip() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    let cancelled = false;
    productService
      .getAll({ sort: "newest", page: 1, pageSize: COUNT })
      .then(rows => {
        if (!cancelled) setProducts(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (products.length === 0) return null;

  // Duplicated once so the -50% keyframe loops seamlessly.
  const track = [...products, ...products];

  return (
    <section className="xl-shell overflow-hidden pt-3.5 md:pt-[26px]">
      <div
        className="xl-marquee flex w-max"
        // 52s inline, not as a utility. `.xl-marquee` lives in index.css
        // OUTSIDE any @layer, so it outranks Tailwind's utilities layer and a
        // `[animation-duration:52s]` class is silently ignored — measured 34s.
        // Same specificity trap as `.container` (#167) and `max-h-[85vh]`
        // (#164). An inline style is the one thing that cannot lose.
        style={{ animationDuration: "52s" }}
        // The track is decorative motion around links that are themselves
        // reachable from the catalogue; the duplicate half is hidden from AT
        // so a screen reader does not read every product twice.
      >
        {track.map((p, i) => (
          <Link
            key={`${p.id}-${i}`}
            href={`/product/${p.id}`}
            aria-hidden={i >= products.length}
            tabIndex={i >= products.length ? -1 : undefined}
            className="mr-3 w-[124px] flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-red-200"
          >
            <div className="bg-slate-50">
              <ProductImage
                url={p.image_url}
                alt={p.name}
                slotPx={248}
                aspect="aspect-square"
              />
            </div>
            {/* The prototype gives this tile its own 10px size, a role the
                token scale does not carry (nearest is text-meta-lg at 9.5).
                Recorded as a known 0.5px near-miss rather than minting a
                thirteenth token, same call as the guest price prompt. */}
            <div className="line-clamp-2 h-8 px-[9px] pt-[7px] text-meta-lg font-bold leading-[1.25] text-slate-900">
              {p.name}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
