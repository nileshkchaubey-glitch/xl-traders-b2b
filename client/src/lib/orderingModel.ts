// ============================================================================
// orderingModel.ts — the ONLY module that converts between packs, pieces and
// money. Pure: no React, no Supabase, no currency formatting.
//
// The one-sentence invariant (docs/ORDERING_MODEL.md §0):
//
//   Money is `packs × price`. `packs` is an integer. A piece count is a display
//   and input convenience that is converted to packs BEFORE any arithmetic
//   involving money happens.
//
// `order_unit` changes what the CUSTOMER COUNTS. It does not change what is
// stored and it does not change what is priced: `products.price` is always the
// price of ONE SELLING UNIT (CLAUDE.md canonical unit-of-sale rule).
//
// THE RULE, stated so it can be grepped (§2.3): outside this file, no module may
// contain `* price`, `/ packSize`, `± 1` on a quantity, or a comparison against
// `moq`. The single exception is `cartStore.getTotal`, which calls `lineTotal`.
// ============================================================================

import type { Product, OrderUnit } from "./supabase";
import { cartLinePrice } from "./priceUtils";
import { packDivisor } from "./priceEntryMode";

// Re-exported so consumers import the ordering vocabulary from one place; the
// definition itself lives with the Product type it describes.
export type { OrderUnit };

// ── The branded pack count ──────────────────────────────────────────────────
//
// `lineTotal` must make "money from a piece count" INEXPRESSIBLE, not merely
// discouraged (brief, Phase 3 §1). A plain `number` parameter cannot do that —
// pcs and packs are both numbers, so a mix-up type-checks. So `Packs` is a
// branded number: structurally a number at runtime (JSON, arithmetic and
// localStorage are unaffected), but not assignable from a bare number.
//
// The brand is a `unique symbol` that is declared but never defined, so it
// exists only in the type system and costs nothing at runtime.
declare const PACKS_BRAND: unique symbol;
export type Packs = number & { readonly [PACKS_BRAND]: true };

/**
 * The ONLY way to mint a Packs from a raw number. Deliberately explicit and
 * deliberately ugly to type: every call is a place a reviewer should check that
 * the number really is a pack count.
 *
 * Floors and clamps at 0 — a fractional pack is not orderable (§6.2) and a
 * negative one is meaningless.
 */
export function asPacks(n: number): Packs {
  if (!Number.isFinite(n)) return 0 as Packs;
  return Math.max(0, Math.floor(n)) as Packs;
}

/** The resolved truth for one product. Nothing downstream reads the raw columns. */
export interface OrderSpec {
  /** Resolved — already downgraded to 'pack' if pcs mode is impossible (§6.1). */
  unit: OrderUnit;
  /** Pieces per pack. 1 when unknown or unusable. */
  packSize: number;
  /** Pieces per stepper click. Always a whole multiple of packSize. */
  step: number;
  /** MOQ in packs. Always >= 1. */
  minPacks: number;
  /** The pieces floor, snapped UP to a whole step (§6.2). */
  minPcs: number;
  /** Selling-unit noun for copy: "box" | "pack" | "roll" … (§8.1). */
  noun: string;
}

/**
 * `unit_of_measure` names the PIECES inside the pack on some rows ("pcs") and
 * the SELLING UNIT on others ("box", "roll" — see the Import Template v3 unit
 * list in CLAUDE.md). When it is not a piece word, it is naming the selling
 * unit, which is exactly the noun the cart line needs (§8.1).
 */
const PIECE_WORDS = new Set(["pcs", "pc", "piece", "pieces", "nos", "no", "unit", "units"]);

function sellingUnitNoun(unitOfMeasure?: string | null): string {
  const raw = unitOfMeasure?.trim() ?? "";
  if (!raw) return "pack";
  return PIECE_WORDS.has(raw.toLowerCase()) ? "pack" : raw;
}

/**
 * Pluralise a selling-unit noun.
 *
 * NOTE: ORDERING_MODEL.md §8.1 specifies a naive `+ "s"` and claims it is
 * "right for box/pack/roll/set/carton". It is not — `"box" + "s"` is "boxs".
 * Sibilant endings (-s, -x, -z, -ch, -sh) take "-es", which covers `box`, the
 * single most likely selling unit in this catalogue. The unit tests assert
 * "2 boxes"; the spec is wrong on this point and the code is right.
 */
export function pluralNoun(noun: string, n: number): string {
  if (n === 1) return noun;
  return /(?:s|x|z|ch|sh)$/i.test(noun) ? `${noun}es` : `${noun}s`;
}

type OrderingFields = Pick<
  Product,
  "order_unit" | "order_step" | "quantity_in_unit" | "moq" | "unit_of_measure"
>;

/**
 * Build the OrderSpec for a product. This is the only place the raw ordering
 * columns are read.
 *
 * Degradation, never an error (§6.1 / §6.2) — a row mid-edit is a normal state
 * during the catalogue rebuild, so an impossible combination renders as a
 * correct pack product rather than throwing at the customer:
 *   * quantity_in_unit NULL / 0 / 1  → packSize 1, and pcs mode downgrades to pack
 *   * order_step not a whole multiple of packSize → step falls back to packSize
 */
export function resolveOrderSpec(p: OrderingFields | null | undefined): OrderSpec {
  // packDivisor is the single already-tested answer to "is this a usable
  // pieces-per-pack divisor?" (NULL / blank / junk / <= 1 → null). Two
  // independent answers to that question is the pack_size mistake in function
  // form, so this is the ONE permitted import from priceEntryMode (§2.1).
  const divisor = packDivisor(p?.quantity_in_unit);
  const packSize = divisor ?? 1;

  const unit: OrderUnit =
    p?.order_unit === "pcs" && divisor != null ? "pcs" : "pack";

  const rawStep = p?.order_step;
  const stepIsUsable =
    typeof rawStep === "number" &&
    Number.isFinite(rawStep) &&
    rawStep > 0 &&
    rawStep % packSize === 0;
  const step = stepIsUsable ? rawStep : packSize;

  const rawMoq = p?.moq;
  const minPacks =
    typeof rawMoq === "number" && Number.isFinite(rawMoq) && rawMoq >= 1
      ? Math.floor(rawMoq)
      : 1;

  // Snap the MOQ floor UP to a whole step, or an MOQ of 1 pack against a 2-pack
  // step would leave the floor unreachable by the stepper (§6.2).
  const minPcs = Math.ceil((minPacks * packSize) / step) * step;

  return {
    unit,
    packSize,
    step,
    minPacks,
    minPcs,
    noun: sellingUnitNoun(p?.unit_of_measure),
  };
}

// ── Quantity conversion — the ONLY place these two multiply/divide ──────────

export function pcsFromPacks(packs: Packs, spec: OrderSpec): number {
  return packs * spec.packSize;
}

/**
 * Pieces → packs. Rounds UP: a customer who asks for more pieces than a whole
 * number of packs holds gets the pack that covers them, never fewer pieces than
 * they asked for.
 *
 * Callers that want the ladder to stay on-step should `snapPcsToStep` first;
 * this function alone never returns a fractional pack.
 */
export function packsFromPcs(pcs: number, spec: OrderSpec): Packs {
  if (!Number.isFinite(pcs) || pcs <= 0) return asPacks(0);
  return asPacks(Math.ceil(pcs / spec.packSize));
}

// ── Stepper behaviour ───────────────────────────────────────────────────────

/**
 * Snap a typed piece count to the nearest whole step, ties rounding UP, then
 * clamp to the MOQ floor. `0` is preserved as 0 so a stepper can still reach
 * "remove the line".
 *
 * Worked (step 3000, minPcs 3000):  4500 → 6000 · 1000 → 3000 · 0 → 0
 * 1000, 2000 and 4500 are never RETAINED, which is the brief's requirement.
 */
export function snapPcsToStep(pcs: number, spec: OrderSpec): number {
  if (!Number.isFinite(pcs) || pcs <= 0) return 0;
  const snapped = Math.round(pcs / spec.step) * spec.step;
  // Math.round is half-up for positives, which is the tie rule we want.
  return Math.max(snapped, spec.minPcs);
}

/** One stepper click in pcs mode. Going below the MOQ floor yields 0 (remove the line). */
export function stepPcs(pcs: number, delta: 1 | -1, spec: OrderSpec): number {
  const next = pcs + delta * spec.step;
  if (next < spec.minPcs) return 0;
  return next;
}

/** One stepper click in pack mode. Going below the MOQ floor yields 0 (remove the line). */
export function stepPacks(packs: Packs, delta: 1 | -1, spec: OrderSpec): Packs {
  const next = packs + delta;
  if (next < spec.minPacks) return asPacks(0);
  return asPacks(next);
}

/** The starting quantity when a product is first added — its MOQ, in packs. */
export function initialPacks(spec: OrderSpec): Packs {
  return asPacks(spec.minPacks);
}

// ── Money ───────────────────────────────────────────────────────────────────

/**
 * The line amount.
 *
 * NOTE THE SIGNATURE: it takes `Packs`, not `number`. There is no way to pass a
 * piece count in, so "money derived from pieces" is not expressible — that is
 * the enforcement mechanism, not a convention.
 *
 * Composes `cartLinePrice` (the single price rule, priceUtils.ts) so a NULL or
 * on-enquiry price yields 0, never NaN.
 */
export function lineTotal(packs: Packs, price?: number | null): number {
  const amount = packs * cartLinePrice(price);
  // NaN guard. `cartLinePrice` routes through `isPriceOnEnquiry`, which tests
  // `price == null || price <= 0` — and NaN satisfies neither, so a NaN price
  // passes straight through and would render as "₹NaN" in a total.
  //
  // Fixed here rather than in priceUtils deliberately: that module is the single
  // price rule shared with ten call sites including admin validation, and
  // widening its contract is not this PR's scope. The gap is recorded in the
  // plan instead. Money must be a number, so this function ends total.
  return Number.isFinite(amount) ? amount : 0;
}

// ── Copy (§8) ───────────────────────────────────────────────────────────────

export interface OrderQtyLabel {
  /** The number the customer is counting in, e.g. "6000 pcs" or "2 boxes". */
  primary: string;
  /** The other unit, e.g. "2 boxes × 3000 pcs". null in pack mode. */
  secondary: string | null;
}

/**
 * Render one quantity in both units. Pack mode keeps today's wording exactly
 * (a bare pack count with no secondary line), so no existing screen changes.
 */
export function formatOrderQty(packs: Packs, spec: OrderSpec): OrderQtyLabel {
  if (spec.unit === "pack") {
    return {
      primary: `${packs} ${pluralNoun(spec.noun, packs)}`,
      secondary: null,
    };
  }
  const pcs = pcsFromPacks(packs, spec);
  return {
    primary: `${pcs.toLocaleString("en-IN")} pcs`,
    secondary: `${packs} ${pluralNoun(spec.noun, packs)} × ${spec.packSize.toLocaleString("en-IN")} pcs`,
  };
}
