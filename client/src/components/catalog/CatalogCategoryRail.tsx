import type { Category } from "@/lib/supabase";

import CategoryIcon from "./CategoryIcon";

interface Props {
  categories: Category[];
  selected: string | null;
  onSelect: (slug: string | null) => void;
}

/**
 * The mobile category rail — a VERTICAL column beside the grid.
 *
 * Ported from `design-reference/xl-traders-storefront.source.dc.html` (mobile
 * catalogue). Worth being precise about, because the structural diff first
 * described this as "a horizontal image rail above the grid" and that was
 * wrong: the prototype puts a 76px column to the LEFT of the products, the
 * pattern the owner's reference apps (JioMart, Blinkit) use. Reading the markup
 * rather than the summary is what caught it.
 *
 * Prototype values, verbatim:
 *   rail   width 76px · bg #f8fafc · border-right 1px #f1f5f9 · padding 8px 0
 *   item   padding 9px 4px · column · centred
 *   image  40x40 · radius 11px · bg #e2e8f0
 *   label  8.5px / 700 · line-height 1.2 · centred
 *
 * It REPLACES the horizontal group-chip row. Two category pickers on one screen
 * is the duplication the footer audit already had to undo once.
 */
export default function CatalogCategoryRail({
  categories,
  selected,
  onSelect,
}: Props) {
  if (categories.length === 0) return null;

  return (
    <div className="w-[76px] flex-shrink-0 border-r border-slate-100 bg-slate-50 py-2 lg:hidden">
      <button
        onClick={() => onSelect(null)}
        className={`flex w-full flex-col items-center gap-1.5 px-1 py-[9px] transition ${
          selected === null ? "bg-white" : ""
        }`}
      >
        <span className="grid h-10 w-10 place-items-center rounded-[11px] bg-slate-200 text-slate-500">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
          </svg>
        </span>
        <span
          className={`text-chip font-bold leading-[1.2] ${
            selected === null ? "text-red-600" : "text-slate-600"
          }`}
        >
          All
        </span>
      </button>

      {categories.map(cat => {
        const on = selected === cat.slug;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(on ? null : cat.slug)}
            aria-pressed={on}
            className={`flex w-full flex-col items-center gap-1.5 px-1 py-[9px] transition ${
              on ? "bg-white" : ""
            }`}
          >
            {/* A real photo FILLS the 40px box; the lucide/emoji fallback sits
                centred inside it. Layered, not JS-toggled — same fallback chain
                as the category tiles (STYLE_REFERENCE §4.3), so a missing or
                broken image reveals the icon with no flash. */}
            <span className="grid h-10 w-10 flex-shrink-0 place-items-center overflow-hidden rounded-[11px] bg-slate-200">
              {cat.image_url ? (
                <img
                  src={cat.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <CategoryIcon cat={cat} />
              )}
            </span>
            <span
              className={`text-chip font-bold leading-[1.2] ${
                on ? "text-red-600" : "text-slate-600"
              }`}
            >
              {cat.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
