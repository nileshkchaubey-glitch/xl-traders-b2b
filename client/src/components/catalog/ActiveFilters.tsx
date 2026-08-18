import { X } from "lucide-react";

import type { CatalogSelection } from "@/lib/catalogQuery";
import type { Category } from "@/lib/supabase";

interface Props {
  selection: CatalogSelection;
  categories: Category[];
  onClearCategory: () => void;
  onClearGroup: () => void;
  onClearBrand: () => void;
  onClearSearch: () => void;
  onClearAll: () => void;
}

/**
 * Filters now AND together, so the customer has to be able to SEE what is
 * applied and drop one without dropping the rest. Before, only one filter could
 * ever be active, and the mobile button could honestly say "Filters · 1"; with
 * composition that row is the difference between a narrowed list and an
 * inexplicably empty one.
 */
export default function ActiveFilters({
  selection,
  categories,
  onClearCategory,
  onClearGroup,
  onClearBrand,
  onClearSearch,
  onClearAll,
}: Props) {
  const categoryName =
    categories.find(c => c.slug === selection.category)?.name ??
    selection.category;

  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
  if (selection.group)
    chips.push({
      key: "group",
      label: selection.group,
      onRemove: onClearGroup,
    });
  if (selection.category && categoryName)
    chips.push({
      key: "category",
      label: categoryName,
      onRemove: onClearCategory,
    });
  if (selection.brand)
    chips.push({
      key: "brand",
      label: selection.brand,
      onRemove: onClearBrand,
    });
  if (selection.search)
    chips.push({
      key: "search",
      label: `“${selection.search}”`,
      onRemove: onClearSearch,
    });

  if (chips.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map(chip => (
        <button
          key={chip.key}
          onClick={chip.onRemove}
          className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-white py-1.5 pl-3 pr-2 text-body-sm font-semibold text-slate-700 transition hover:border-red-300 hover:text-red-600"
        >
          {chip.label}
          <X size={13} aria-hidden />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      {chips.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-body-sm font-bold text-red-600 hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
