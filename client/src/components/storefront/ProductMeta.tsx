import { Truck } from "lucide-react";
import {
  type OrderSpec,
  packChipLabel,
  moqChipLabel,
  stepChipLabel,
} from "@/lib/orderingModel";

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
    <span className="absolute top-2.5 left-2.5 z-10 rounded-md bg-slate-900/85 px-2 py-1 text-chip lg:text-chip-lg font-bold text-white backdrop-blur-sm">
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
/**
 * The PDP's MOQ + Step pair, sitting directly under the price.
 *
 * Measured off the rendered prototype (STOREFRONT_RULES §6.1): both pills are
 * 11.5px/700 — exactly `text-product-name` — padding 6/11, radius 99, 28px
 * tall. MOQ is amber (`#fffbeb` on `#fef3c7`, text `#b45309`); Step is neutral
 * (white on `#e2e8f0`, text `#334155`).
 *
 * WHY THE STEP PILL MATTERS: MOQ says how little you may buy, the step says
 * which quantities in between are legal at all. We shipped neither on the PDP
 * in this position, so a buyer facing the stepper could only discover that
 * 610 pcs is unorderable by pressing the button.
 *
 * Deliberately NOT built on `MoqChip` below, even though the label is shared.
 * That chip is sized for the product CARD, whose height is pinned across auth
 * states (§4.1) — restyling it to PDP proportions would move every card in the
 * catalogue. Two sizes, one label function.
 */
export function OrderPills({ spec }: { spec: OrderSpec }) {
  const pill =
    "inline-flex items-center rounded-full border px-[11px] py-1.5 text-product-name font-bold leading-[1.2]";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`${pill} border-amber-100 bg-amber-50 text-amber-700`}>
        {moqChipLabel(spec)}
      </span>
      <span className={`${pill} border-slate-200 bg-white text-slate-700`}>
        {stepChipLabel(spec)}
      </span>
    </div>
  );
}

export function MoqChip({ spec }: { spec: OrderSpec }) {
  return (
    <span className="inline-flex items-center rounded border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-chip lg:text-chip-lg font-bold text-amber-700">
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
    <span className="flex items-center gap-1 text-meta lg:text-meta-lg font-semibold text-slate-400">
      <Truck size={11} strokeWidth={2.5} className="flex-shrink-0" />
      <span className="truncate">{line}</span>
    </span>
  );
}
