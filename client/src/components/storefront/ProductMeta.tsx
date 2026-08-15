import { Truck } from "lucide-react";
import { type OrderSpec, packChipLabel, moqChipLabel } from "@/lib/orderingModel";

/**
 * The pack chip — sits TOP-LEFT over the product image.
 *
 * Renders nothing when the pack size is unusable (NULL / 0 / 1), because
 * "Pack of 1" is noise. The label comes from `orderingModel.packChipLabel`, so
 * the noun it uses is the same one the cart line and the WhatsApp message use.
 */
export function PackChip({ spec }: { spec: OrderSpec }) {
  const label = packChipLabel(spec);
  if (!label) return null;
  return (
    <span className="absolute top-2.5 left-2.5 z-10 rounded-md bg-slate-900/85 px-2 py-1 text-[10.5px] font-bold text-white backdrop-blur-sm">
      {label}
    </span>
  );
}

/**
 * The MOQ chip.
 *
 * Shown in EVERY auth state. `moq` is granted to `anon` (V3 Phase 2), so a
 * signed-out visitor learns the minimum order before they learn the rate —
 * which on a catalogue of near-identical black containers is often the more
 * decision-relevant number.
 */
export function MoqChip({ spec }: { spec: OrderSpec }) {
  return (
    <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10.5px] font-bold text-slate-600">
      {moqChipLabel(spec)}
    </span>
  );
}

/**
 * The per-product dispatch line.
 *
 * Stated per product rather than as a site-wide banner promise, and sourced
 * from the admin-editable `dispatch` site_content key so there is one wording
 * in one place. There is deliberately NO freight line: that rule is unsettled,
 * and omitting it is better than stating a threshold we cannot honour
 * (docs/STOREFRONT_V3_PLAN.md §12).
 */
export function DispatchLine({ line }: { line: string }) {
  if (!line) return null;
  return (
    <span className="flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700">
      <Truck size={11} strokeWidth={2.5} className="flex-shrink-0" />
      <span className="truncate">{line}</span>
    </span>
  );
}
