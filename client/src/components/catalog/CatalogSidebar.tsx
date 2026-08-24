import type { CategoryGroup } from "@/lib/productService";
import type { Category } from "@/lib/supabase";

import CategoryIcon from "./CategoryIcon";

/**
 * The desktop catalogue sidebar.
 *
 * Ported from `design-reference/xl-traders-storefront.source.dc.html` by
 * RENDERING its Catalogue screen at 1440 and reading computed styles
 * (STOREFRONT_RULES §6.1). Measured:
 *
 *   card            250px · padding 16 · radius 14 · border #e2e8f0
 *   "Filters"       13px/800 #0f172a · margin-bottom 12
 *   facet heading   11px/800 #334155 · uppercase · letter-spacing 0.77px
 *   facet group     margin-bottom 16
 *   chip            11px/600 #475569 · bg #f8fafc · border #e2e8f0 ·
 *                   padding 5px 10px · radius 99px · row gap 7, margin-top 9
 *   categories      separated by a #f1f5f9 top border, padding-top 13
 *   category row    flex space-between · padding 7px 9px · radius 8 · 28px tall
 *                   label 11.5px/700, #475569, ACTIVE #b91c1c on #fef2f2
 *
 * Every one of those sizes is an exact role token: 13 = text-heading-sub,
 * 11 = text-caption, 11.5 = text-product-name. Nothing minted.
 *
 * FOUR DELIBERATE DIFFERENCES, none of them cosmetic drift:
 *
 * 1. **No search box.** The prototype has none here, and ours was redundant:
 *    the header search writes the same `?search=` param this page already
 *    reads (`Header.tsx` → `/catalog?search=…`), and `ActiveFilters` still
 *    shows and clears an active search. Two inputs bound to one param is the
 *    duplication §2.4 keeps flagging, not a second capability.
 *
 * 2. **No per-row counts.** The prototype shows "3 categories" / "10 items" on
 *    every row. Counts are an owner instruction against
 *    (`STOREFRONT_RULES` §3.1) and the grouped-count service PR-3 needs does
 *    not exist yet — `productService.countPublished()` is per-category, so a
 *    sidebar of 25 rows would be 25 queries. The row keeps its
 *    `CategoryIcon` in that slot instead, which is real and cannot drift.
 *
 * 3. **The card is sticky and viewport-capped.** The prototype's sidebar is
 *    `position: static` with no max-height — it simply grows (876px there).
 *    Ours stays sticky because a 139-product catalogue is several screens
 *    long, but the cap moved from the category LIST to the whole card, so the
 *    common case has no inner scrollbar at all and the rows keep the
 *    prototype's full 218px width (a list scrollbar was eating 14px of it).
 *
 * 4. **Groups are kept.** The prototype's list is flat; ours nests real
 *    `group_name`s. That is information we have and it is how the rest of the
 *    site is organised (mega-menu, footer links, the mobile rail).
 *
 * NOT BUILT, and not silently dropped: the prototype's MOQ / Per-piece rate /
 * Material facets. Each needs a new query axis in `productService` — service
 * work, not presentation — so they are out of scope for a structural pass.
 */
interface Props {
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

const FACET_HEADING =
  "text-caption font-extrabold uppercase tracking-[0.07em] text-slate-700";

function brandChip(active: boolean): string {
  return `rounded-full border px-2.5 py-[5px] text-caption font-semibold transition-colors ${
    active
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
  }`;
}

function rowClass(active: boolean): string {
  return `flex w-full items-center gap-2 rounded-[8px] px-[9px] py-[7px] text-left transition-colors ${
    active ? "bg-red-50" : "hover:bg-slate-50"
  }`;
}

function labelClass(active: boolean): string {
  return `truncate text-product-name font-bold leading-[1.2] ${
    active ? "text-red-700" : "text-slate-600"
  }`;
}

export default function CatalogSidebar({
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

  return (
    <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-[14px] border border-slate-200 bg-white p-4">
      <div className="mb-3 text-heading-sub font-extrabold text-slate-900">
        Filters
      </div>

      {brands.length > 0 && (
        <div className="mb-4">
          <div className={FACET_HEADING}>Brand</div>
          <div className="mt-[9px] flex flex-wrap gap-[7px]">
            {brands.map(brand => {
              const active = selectedBrand === brand;
              return (
                <button
                  key={brand}
                  onClick={() => onBrandChange(active ? null : brand)}
                  aria-pressed={active}
                  className={brandChip(active)}
                >
                  {brand}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        className={
          brands.length > 0 ? "border-t border-slate-100 pt-[13px]" : ""
        }
      >
        <div className={FACET_HEADING}>Categories</div>

        <div className="mt-[9px] space-y-px">
          {/* Clears the category axis only — an active brand or search stays. */}
          <button
            onClick={() => onCategoryChange(null)}
            className={rowClass(noCategoryFilter)}
          >
            <span className={labelClass(noCategoryFilter)}>All products</span>
          </button>

          {groups.length > 0
            ? groups.map(group => {
                const groupActive = selectedGroup === group.group_name;
                const childActive = group.categories.some(
                  c => c.slug === selectedCategory
                );
                return (
                  <div key={group.group_name} className="pt-2.5">
                    <button
                      onClick={() => onGroupChange(group.group_name)}
                      className={`w-full rounded-[8px] px-[9px] py-[5px] text-left text-meta-lg font-extrabold uppercase tracking-[0.07em] transition-colors ${
                        groupActive
                          ? "bg-red-600 text-white"
                          : childActive
                            ? "text-red-600"
                            : "text-slate-400 hover:bg-slate-50"
                      }`}
                    >
                      {group.group_name}
                    </button>
                    <div className="mt-px space-y-px">
                      {group.categories.map(cat => {
                        const active = selectedCategory === cat.slug;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => onCategoryChange(cat.slug)}
                            className={rowClass(active)}
                          >
                            <CategoryIcon cat={cat} px={14} />
                            <span className={labelClass(active)}>
                              {cat.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            : categories.map(cat => {
                const active = selectedCategory === cat.slug;
                return (
                  <button
                    key={cat.id}
                    onClick={() => onCategoryChange(cat.slug)}
                    className={rowClass(active)}
                  >
                    <CategoryIcon cat={cat} px={14} />
                    <span className={labelClass(active)}>{cat.name}</span>
                  </button>
                );
              })}
        </div>
      </div>
    </div>
  );
}
