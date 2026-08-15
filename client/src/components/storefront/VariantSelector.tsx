import type { Product } from "@/lib/supabase";

interface VariantSelectorProps {
  variants: Product[];
  selectedId?: string;
  onSelect: (variant: Product) => void;
}

/**
 * Size / variant picker.
 *
 * Selecting a variant swaps the WHOLE product, not just its label — price,
 * pack size, MOQ and order step all come from the selected row, and the PDP
 * re-resolves its OrderSpec from it. That matters because a 250ml and a 1000ml
 * variant genuinely have different pack sizes, and carrying a piece count
 * across the switch would silently change the order (ORDERING_MODEL §6.4): 6000
 * pieces is 2 packs of one and 6 of another.
 *
 * Renders nothing for a standalone product, so the caller needs no guard.
 */
export default function VariantSelector({
  variants,
  selectedId,
  onSelect,
}: VariantSelectorProps) {
  if (variants.length < 2) return null;

  return (
    <div>
      <div className="mb-2 text-caption font-bold uppercase tracking-wide text-slate-500">
        Size
      </div>
      <div className="flex flex-wrap gap-2">
        {variants.map(v => {
          const active = v.id === selectedId;
          return (
            <button
              key={v.id}
              onClick={() => onSelect(v)}
              aria-pressed={active}
              className={`h-10 rounded-lg border-[1.5px] px-3.5 text-body-sm font-bold transition ${
                active
                  ? "border-red-600 bg-red-50 text-red-600"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              {v.variant_label || v.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
