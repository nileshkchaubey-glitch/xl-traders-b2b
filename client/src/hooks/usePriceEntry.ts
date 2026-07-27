import { useEffect, useRef, useState } from "react";
import {
  type PriceEntryMode,
  packDivisor,
  packFromPiece,
  pieceFromPack,
} from "@/lib/priceEntryMode";

/**
 * Per-piece price entry for a form-shaped surface (the Workbench fields pane
 * and the Catalog Editor's side drawer — both `useProductForm` consumers).
 *
 * Shared rather than copied because the whole point is that every editing
 * surface means the SAME thing by the number in its price box. Three surfaces
 * each rolling their own conversion is exactly how one of them ends up storing
 * a per-piece figure as a pack price.
 *
 * The contract is unchanged from lib/priceEntryMode.ts: `price` in and out of
 * this hook is always the PACK price — the string that gets validated, coerced
 * and stored. Only `value` (what the input displays) is ever per-piece.
 */
export function usePriceEntry({
  mode,
  price,
  quantityInUnit,
  onPriceChange,
  resetKey,
}: {
  mode: PriceEntryMode;
  /** The pack price as held in form state. */
  price: string;
  /** Pieces per pack; per-piece entry is unavailable when this is blank or 1. */
  quantityInUnit: string;
  /** Writes the PACK price back to form state. */
  onPriceChange: (packPrice: string) => void;
  /** Changing this drops any in-progress draft — pass the product id. */
  resetKey?: string | null;
}) {
  const divisor = packDivisor(quantityInUnit);
  /** Whether this product can express a per-piece rate at all. */
  const available = divisor != null;
  /** Whether the box is currently taking a per-piece figure. */
  const active = mode === "piece" && divisor != null;

  // The displayed value is DERIVED from the pack price, with this as a local
  // override while the operator is mid-keystroke. Without it a half-typed
  // "10." round-trips through Number() as "10" and the decimal point can
  // never be typed at all.
  const [draft, setDraft] = useState<string | null>(null);

  /**
   * The (pack price, displayed rate) pair as it stood before the current edit
   * began.
   *
   * `pieceFromPack` and `packFromPiece` are NOT a lossless pair — display
   * rounds to 4 dp, storage to 2 — so ₹4897 over a pack of 480 shows as
   * 10.2021 and converts back to ₹4897.01. Converting unconditionally would
   * therefore rewrite a price the operator never touched. Widening the
   * precision only moves that boundary; the fix is to not convert at all
   * unless the displayed rate actually changed, and to hand back the original
   * string byte-for-byte when it didn't.
   */
  const originRef = useRef<{ pack: string; shown: string } | null>(null);

  useEffect(() => {
    setDraft(null);
    originRef.current = null;
  }, [resetKey, mode]);

  const value =
    active && divisor != null
      ? (draft ?? pieceFromPack(price, divisor))
      : price;

  const onChange = (raw: string) => {
    if (!active || divisor == null) {
      onPriceChange(raw);
      return;
    }
    // First keystroke of this edit. `draft === null` guarantees the box was
    // still showing the derived value, so `price` here is the untouched
    // original — the only moment this pair can be captured safely.
    if (draft === null) {
      originRef.current = { pack: price, shown: pieceFromPack(price, divisor) };
    }
    setDraft(raw);

    const origin = originRef.current;
    if (origin && raw === origin.shown) {
      onPriceChange(origin.pack);
      return;
    }
    onPriceChange(packFromPiece(raw, divisor));
  };

  /**
   * Call on blur. Drops back to the derived value, which normalises "10." and
   * stops a stale rate from surviving an edit to the pack quantity.
   */
  const settle = () => setDraft(null);

  return { divisor, available, active, value, onChange, settle };
}
