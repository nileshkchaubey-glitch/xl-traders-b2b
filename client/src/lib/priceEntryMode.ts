// Per-piece price ENTRY — a typing convenience, never a storage change.
//
// CLAUDE.md's canonical unit-of-sale rule is unchanged and non-negotiable:
// `products.price` is the price of ONE SELLING UNIT (the pack / case), always.
// `quantity_in_unit` stays descriptive, `moq` still counts selling units, and
// the per-piece figure the storefront shows is still derived at render time.
//
// What this module adds is purely an input transform for the admin: supplier
// price lists quote a per-piece rate, so the operator can type 10.20 and have
// the pack price computed, instead of reaching for a calculator 142 times.
// There is NO per-product or per-category "pricing basis" — the mode is one
// UI preference for the whole editor, held in the URL, and the only thing it
// touches is the string sitting in the price input before validation runs.
//
// Everything downstream (validateEdit, isPriceOnEnquiry, the save path, cart,
// orders, storefront) sees exactly the pack price it always saw.

export type PriceEntryMode = "pack" | "piece";

/** URL param, per the no-localStorage rule the rest of this editor follows. */
export const PRICE_MODE_PARAM = "priceEntry";

/**
 * Per piece is the default: the owner's supplier lists quote per-piece rates,
 * so it is the mode that matches the paper on the desk during data entry.
 * "pack" is therefore what gets written to the URL, and the absent param
 * means the default.
 */
export const DEFAULT_PRICE_MODE: PriceEntryMode = "piece";

export function parsePriceMode(raw: string | null): PriceEntryMode {
  return raw === "pack" ? "pack" : DEFAULT_PRICE_MODE;
}

/**
 * Pieces per selling unit — the multiplier between the two modes — or null
 * when per-piece entry has no meaning.
 *
 * 1 is deliberately null alongside blank/junk: at one piece per pack the two
 * modes are the same number, so offering the choice is noise, and it keeps
 * "divisor != null" the single test for "per-piece is available here".
 */
export function packDivisor(
  quantityInUnit: number | string | null | undefined
): number | null {
  if (quantityInUnit === null || quantityInUnit === undefined) return null;
  const n = Number(String(quantityInUnit).trim());
  if (!Number.isFinite(n) || n <= 1) return null;
  return n;
}

/** Kill float noise: 10.2 * 480 is 4896.000000000001 in binary floating point. */
function roundTo(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/**
 * Per-piece text → the pack-price text that gets validated and stored.
 *
 * Unparseable input is passed through VERBATIM rather than blanked: a blank
 * price is the "On Enquiry" signal, and DE-01 was exactly the bug where a
 * typo became one. `validateEdit` must be the thing that sees "abc" and
 * refuses it.
 */
export function packFromPiece(piece: string, divisor: number): string {
  const t = piece.trim();
  if (t === "") return "";
  const n = Number(t);
  if (!Number.isFinite(n)) return t;
  return String(roundTo(n * divisor, 2));
}

/**
 * Pack-price text → the per-piece text shown in the input.
 *
 * 4 dp, because a cheap item in a 900-pack can be a fraction of a paisa and
 * rounding the DISPLAY to 2 would make a round trip through the field change
 * the stored price. Unparseable passes through for the same reason as above.
 */
export function pieceFromPack(pack: string, divisor: number): string {
  const t = pack.trim();
  if (t === "") return "";
  const n = Number(t);
  if (!Number.isFinite(n)) return t;
  return String(roundTo(n / divisor, 4));
}

/**
 * The per-piece rate for DISPLAY, or null when this row cannot express one —
 * no usable pack quantity, or no real price. Callers must fall back to the
 * pack figure (and say so) rather than rendering a divide-by-null.
 */
export function perPieceRate(
  price: number | null | undefined,
  quantityInUnit: number | string | null | undefined
): number | null {
  const divisor = packDivisor(quantityInUnit);
  if (divisor == null) return null;
  if (price == null || !Number.isFinite(Number(price))) return null;
  return Number(price) / divisor;
}

/**
 * 2–4 decimals. A pack of 480 at ₹12 is ₹0.025 a piece: 2 dp alone would
 * render that as ₹0.03 and quietly overstate the rate the operator is about
 * to type against, which is the whole reason this figure is on screen.
 */
export function formatPerPiece(rate: number): string {
  return rate.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}
