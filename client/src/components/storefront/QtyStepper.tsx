import { Minus, Plus } from "lucide-react";
import {
  type OrderSpec,
  type Packs,
  pcsFromPacks,
  stepPacks,
  stepPcs,
  packsFromPcs,
} from "@/lib/orderingModel";

interface QtyStepperProps {
  packs: Packs;
  spec: OrderSpec;
  /** Receives the new PACK count. Zero means "remove this line". */
  onChange: (packs: Packs) => void;
  className?: string;
}

/**
 * The quantity stepper. Shows the number in whatever unit the customer counts
 * in — pieces for a pcs product, selling units for a pack product — while
 * always handing its caller a PACK count, because packs are what money
 * multiplies.
 *
 * Every ±1 goes through `orderingModel` (`stepPcs` / `stepPacks`), so the step
 * size, the MOQ floor and the "below MOQ removes the line" rule are applied in
 * one place and cannot drift between the card, the PDP and the cart.
 *
 * Sizing note: this must occupy EXACTLY the footprint of the Add button it
 * replaces (h-9, w-[124px]) so swapping between them does not shift the card.
 * See ProductCard's action-slot comment.
 */
export default function QtyStepper({
  packs,
  spec,
  onChange,
  className = "",
}: QtyStepperProps) {
  const inPcs = spec.unit === "pcs";
  const shown = inPcs ? pcsFromPacks(packs, spec) : packs;

  const bump = (delta: 1 | -1) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inPcs) {
      // Step in pieces, then convert once — never step packs and relabel.
      onChange(packsFromPcs(stepPcs(pcsFromPacks(packs, spec), delta, spec), spec));
    } else {
      onChange(stepPacks(packs, delta, spec));
    }
  };

  return (
    <div
      className={`flex items-center h-9 w-[124px] rounded-lg overflow-hidden bg-red-600 text-white shadow-sm ${className}`}
    >
      <button
        onClick={bump(-1)}
        className="w-9 h-full grid place-items-center hover:bg-red-700 transition"
        aria-label={inPcs ? `Decrease by ${spec.step} pcs` : "Decrease by 1"}
      >
        <Minus size={14} strokeWidth={3} />
      </button>
      <div className="flex-1 text-center leading-none">
        <div className="text-[13px] font-extrabold tabular-nums">
          {shown.toLocaleString("en-IN")}
        </div>
        <div className="text-[8.5px] font-bold uppercase tracking-wide opacity-80">
          {inPcs ? "pcs" : spec.noun}
        </div>
      </div>
      <button
        onClick={bump(1)}
        className="w-9 h-full grid place-items-center hover:bg-red-700 transition"
        aria-label={inPcs ? `Increase by ${spec.step} pcs` : "Increase by 1"}
      >
        <Plus size={14} strokeWidth={3} />
      </button>
    </div>
  );
}
