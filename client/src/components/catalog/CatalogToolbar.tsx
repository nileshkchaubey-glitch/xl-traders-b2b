import { ChevronDown, Grid3x3, List } from "lucide-react";

import type { PublicProductSort } from "@/lib/productService";

export type CatalogView = "grid" | "list";

interface Props {
  sort: PublicProductSort;
  onSortChange: (sort: PublicProductSort) => void;
  view: CatalogView;
  onViewChange: (view: CatalogView) => void;
  /** Price sorts are offered only when the visitor can actually run them. */
  canSortByPrice: boolean;
  className?: string;
}

/**
 * ONE sort + view control. There used to be two — a desktop pair in the title
 * row and a near-identical mobile bar — whose option labels had already drifted
 * apart ("Sort: Newest" vs "Newest"). Two controls for one piece of state is
 * how they disagree.
 */
export default function CatalogToolbar({
  sort,
  onSortChange,
  view,
  onViewChange,
  canSortByPrice,
  className = "",
}: Props) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative">
        <select
          value={sort}
          onChange={e => onSortChange(e.target.value as PublicProductSort)}
          aria-label="Sort products"
          className="h-10 cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-body-sm font-semibold outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100"
        >
          <option value="newest">Sort: Newest</option>
          <option value="name">Name (A–Z)</option>
          {/* anon has no SELECT grant on `price`; ORDER BY price is refused
              by Postgres, so a guest choosing it got an EMPTY catalogue.
              See STOREFRONT_RULES §1.3. */}
          {canSortByPrice && (
            <>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </>
          )}
        </select>
        <ChevronDown
          size={15}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500"
        />
      </div>

      <div className="flex overflow-hidden rounded-lg border border-slate-200">
        {(
          [
            ["grid", Grid3x3, "Grid view"],
            ["list", List, "List view"],
          ] as const
        ).map(([value, Icon, label]) => (
          <button
            key={value}
            onClick={() => onViewChange(value)}
            aria-label={label}
            aria-pressed={view === value}
            className={`flex h-10 w-10 items-center justify-center transition ${
              view === value
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}
