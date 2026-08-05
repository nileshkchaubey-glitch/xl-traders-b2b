import { Link } from "wouter";
import ProductImageSlot from "./ProductImageSlot";
import type { SeriesEntry } from "@/lib/seriesModel";

interface SeriesCardProps {
  entry: SeriesEntry;
  /** Tier-2 image source for the lead variant's category. */
  categoryImageUrl?: string;
}

/**
 * A whole series as ONE rate-card item (docs/DESIGN_SYSTEM.md §3.1b).
 *
 * Same vocabulary as `ProductCard` — figure, name, rate rule, action — so the
 * grid stays visually uniform. Only the content of each slot differs, because
 * what identifies a series is different from what identifies one pack:
 *
 *   figure     the size RANGE ("100–2000 ml"), not one size
 *   rate rule  the cheapest rate in the series ("from ₹0.28/pc")
 *   action     "View N sizes" → the PDP, whose variant picker already exists
 *
 * The variant count is the point: ten cards that all said "Hinged box" told a
 * buyer nothing, and one card that says "11 sizes · 100–2000 ml" tells them
 * everything they needed from those ten.
 */
export default function SeriesCard({
  entry,
  categoryImageUrl,
}: SeriesCardProps) {
  const count = entry.variants.length;
  const href = `/product/${entry.leadVariant.id}`;

  return (
    <div className="flex flex-col">
      <Link href={href} className="block group">
        <ProductImageSlot
          product={entry.leadVariant}
          categoryImageUrl={categoryImageUrl}
          size={entry.sizeRange}
          sizeUnit={entry.sizeUnit}
          // The range IS the figure here, so the slot must not also print a
          // pack line for the lead variant — that number is one size's, not
          // the series'.
          sizeIsPackCount
        />
        <div className="mt-3 text-body-sm md:text-body-md font-medium text-ink group-hover:text-red-600 transition-colors duration-150">
          {entry.name}
        </div>
      </Link>

      {/* The rate rule — "from", because a series spans rates. */}
      <div className="mt-3 md:mt-[15px] border-t-2 border-ink flex">
        {entry.allOnEnquiry || entry.fromPerPiece == null ? (
          <span className="bg-amber-600 text-white font-mono text-caption md:text-body-sm font-semibold px-2 py-[5px] md:px-[9px] md:py-1.5 whitespace-nowrap">
            On enquiry
          </span>
        ) : (
          <span className="bg-ink text-white font-mono text-caption md:text-body-sm font-semibold px-2 py-[5px] md:px-[9px] md:py-1.5 whitespace-nowrap tabular-nums">
            from ₹{entry.fromPerPiece.toFixed(2)}/{entry.perPieceUnit}
          </span>
        )}
      </div>

      <div className="flex-1">
        <div className="font-mono text-price md:text-price-lg font-bold text-ink mt-3 tracking-[-0.025em] tabular-nums">
          {count}
        </div>
        <div className="text-meta md:text-caption font-medium uppercase tracking-[0.1em] text-ink-faint mt-1.5">
          {count === 1 ? "size" : "sizes"} available
        </div>
      </div>

      <Link
        href={href}
        className="mt-3.5 md:mt-4 h-[38px] md:h-[46px] bg-ink text-white text-body-sm md:text-body-md font-semibold flex items-center justify-center hover:bg-red-600 transition-colors duration-150"
      >
        {/* Not "Add" — a series has no single pack to add. Choosing the size
            is the next real step, and the PDP is where that happens. */}
        Choose size
      </Link>
    </div>
  );
}
