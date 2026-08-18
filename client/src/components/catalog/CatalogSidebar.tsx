import type { CategoryGroup } from "@/lib/productService";
import type { Category } from "@/lib/supabase";

import CategoryIcon from "./CategoryIcon";

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  categories: Category[];
  groups: CategoryGroup[];
  brands: string[];
  selectedCategory: string | null;
  selectedGroup: string | null;
  selectedBrand: string | null;
  onCategoryChange: (slug: string | null) => void;
  onGroupChange: (group: string | null) => void;
  onBrandChange: (brand: string | null) => void;
}

export default function CatalogSidebar({
  search,
  onSearchChange,
  categories,
  groups,
  brands,
  selectedCategory,
  selectedGroup,
  selectedBrand,
  onCategoryChange,
  onGroupChange,
  onBrandChange,
}: Props) {
  const noCategoryFilter = !selectedCategory && !selectedGroup;

  const itemClass = (active: boolean) =>
    `flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition ${
      active
        ? "bg-red-100 font-semibold text-red-600"
        : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <div className="sticky top-24 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <input
          type="search"
          placeholder="Search products..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          aria-label="Search products"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-100"
        />
      </div>

      <div className="max-h-[60vh] overflow-y-auto p-4">
        <h3 className="mb-3 text-sm font-bold text-slate-900">Categories</h3>
        <div className="space-y-0.5">
          {/* Clears the category axis only — an active brand or search stays. */}
          <button
            onClick={() => onCategoryChange(null)}
            className={itemClass(noCategoryFilter)}
          >
            All Products
          </button>

          {groups.length > 0
            ? groups.map(group => {
                const groupActive = selectedGroup === group.group_name;
                const childActive = group.categories.some(
                  c => c.slug === selectedCategory
                );
                return (
                  <div key={group.group_name} className="mt-3">
                    <button
                      onClick={() => onGroupChange(group.group_name)}
                      className={`w-full rounded px-3 py-2 text-left text-xs font-bold uppercase tracking-wider transition ${
                        groupActive
                          ? "bg-red-600 text-white"
                          : childActive
                            ? "text-red-600"
                            : "text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {group.group_name}
                    </button>
                    <div className="ml-1 mt-0.5 space-y-0.5">
                      {group.categories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => onCategoryChange(cat.slug)}
                          className={itemClass(selectedCategory === cat.slug)}
                        >
                          <CategoryIcon cat={cat} />
                          <span className="truncate">{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            : categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => onCategoryChange(cat.slug)}
                  className={itemClass(selectedCategory === cat.slug)}
                >
                  <CategoryIcon cat={cat} />
                  <span className="truncate">{cat.name}</span>
                </button>
              ))}
        </div>
      </div>

      {brands.length > 0 && (
        <div className="border-t border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Brands</h3>
          <div className="space-y-0.5">
            {brands.map(brand => (
              <button
                key={brand}
                onClick={() =>
                  onBrandChange(selectedBrand === brand ? null : brand)
                }
                className={itemClass(selectedBrand === brand)}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
