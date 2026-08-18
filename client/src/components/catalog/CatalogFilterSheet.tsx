import type { CatalogSelection } from "@/lib/catalogQuery";
import type { CategoryGroup, PublicProductSort } from "@/lib/productService";
import type { Category } from "@/lib/supabase";

import { chipClass } from "./chip";
import type { CatalogView } from "./CatalogToolbar";

interface Props {
  open: boolean;
  onClose: () => void;
  selection: CatalogSelection;
  categories: Category[];
  groups: CategoryGroup[];
  brands: string[];
  canSortByPrice: boolean;
  view: CatalogView;
  onViewChange: (view: CatalogView) => void;
  onSortChange: (sort: PublicProductSort) => void;
  onCategoryChange: (slug: string | null) => void;
  onBrandChange: (brand: string | null) => void;
  onClearAll: () => void;
  totalCount: number;
}

/**
 * Mobile filter & sort sheet.
 *
 * KNOWN GAP, deliberately left for the follow-up: this is a hand-rolled overlay
 * with no focus trap, no Escape handler, no `role="dialog"` and no body scroll
 * lock — the page still scrolls behind it. That is an accessibility fix with
 * its own verification (keyboard traversal, screen reader, scroll behaviour at
 * 390px), not something to smuggle into a filter-composition change.
 */
export default function CatalogFilterSheet({
  open,
  onClose,
  selection,
  categories,
  groups,
  brands,
  canSortByPrice,
  view,
  onViewChange,
  onSortChange,
  onCategoryChange,
  onBrandChange,
  onClearAll,
  totalCount,
}: Props) {
  if (!open) return null;

  const sorts: Array<[PublicProductSort, string]> = [
    ["newest", "Newest"],
    ["name", "Name A–Z"],
    ...(canSortByPrice
      ? ([
          ["price-low", "Price: Low"],
          ["price-high", "Price: High"],
        ] as Array<[PublicProductSort, string]>)
      : []),
  ];

  // Narrow to the selected group's categories when there is one, so the list is
  // the categories the customer is actually looking at.
  const categoryOptions =
    selection.group && groups.length > 0
      ? (groups.find(g => g.group_name === selection.group)?.categories ??
        categories)
      : categories;

  const Section = ({ title }: { title: string }) => (
    <div className="mb-2.5 text-caption font-bold uppercase tracking-widest text-slate-400">
      {title}
    </div>
  );

  return (
    <div className="lg:hidden">
      <div
        className="fixed inset-0 z-50 bg-slate-900/45"
        onClick={onClose}
        aria-hidden
      />
      <div className="animate-in slide-in-from-bottom fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-auto rounded-t-[20px] bg-white duration-300">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 pb-2.5 pt-3.5">
          <div className="absolute left-1/2 top-2 h-1 w-9 -translate-x-1/2 rounded-full bg-slate-200" />
          <span className="mt-1.5 text-body-md font-extrabold">
            Filters &amp; Sort
          </span>
          <button
            onClick={onClearAll}
            className="mt-1.5 text-body-sm font-bold text-red-600"
          >
            Clear all
          </button>
        </div>

        <div className="px-5 py-4 pb-24">
          <Section title="Sort" />
          <div className="mb-5 flex flex-wrap gap-2">
            {sorts.map(([value, label]) => (
              <button
                key={value}
                onClick={() => onSortChange(value)}
                className={chipClass(selection.sort === value)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Was desktop-only. The duplicate mobile control bar that used to
              carry it is gone, so it lives here rather than being dropped. */}
          <Section title="View" />
          <div className="mb-5 flex flex-wrap gap-2">
            {(
              [
                ["grid", "Grid"],
                ["list", "List"],
              ] as Array<[CatalogView, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => onViewChange(value)}
                className={chipClass(view === value)}
              >
                {label}
              </button>
            ))}
          </div>

          <Section title="Category" />
          <div className="mb-5 flex flex-wrap gap-2">
            {categoryOptions.map(cat => (
              <button
                key={cat.id}
                onClick={() =>
                  onCategoryChange(
                    selection.category === cat.slug ? null : cat.slug
                  )
                }
                className={chipClass(selection.category === cat.slug)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {brands.length > 0 && (
            <>
              <Section title="Brand" />
              <div className="flex flex-wrap gap-2">
                {brands.map(brand => (
                  <button
                    key={brand}
                    onClick={() =>
                      onBrandChange(selection.brand === brand ? null : brand)
                    }
                    className={chipClass(selection.brand === brand)}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-slate-100 bg-white px-5 py-3">
          <button
            onClick={onClose}
            className="h-[50px] w-full rounded-xl bg-red-600 text-body-md font-extrabold text-white transition hover:bg-red-700"
          >
            Show {totalCount.toLocaleString()} products
          </button>
        </div>
      </div>
    </div>
  );
}
