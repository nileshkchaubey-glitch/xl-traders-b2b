import type { Product } from "./supabase";
// Explicit .ts extension so scripts/check-card-model.ts can execute this module
// directly under Node's native type stripping, which does not resolve
// extensionless specifiers. Vite and `tsc` both accept it
// (allowImportingTsExtensions is on) — same arrangement as priceEntryMode.ts.
import { displayPrice, rateTabLabel, type DisplayPrice } from "./priceUtils.ts";

/**
 * toCardModel — the single pure mapper from a `Product` row to everything the
 * rate-card item renders (docs/DESIGN_SYSTEM.md §3.1).
 *
 * It exists because the card needs four derived values (display name, pack
 * size, pack unit, price block) and deriving any of them at a call site is how
 * two surfaces end up disagreeing about the same product. Catalog, Home and
 * the PDP all read this.
 *
 * Pure: no I/O, no React, no service calls. `isAuthenticated` is passed in
 * rather than read from the store so the function stays testable.
 */

export interface CardModel {
  /** Cleaned product name — see stripNoise(). */
  name: string;
  /** The headline figure: "500", "8×8×3", "3", or the pack count as a last resort. */
  size: string | null;
  /** Its label: "ml", "kg", "cmp", "in", or "pcs" when size fell back to the count. */
  sizeUnit: string | null;
  /**
   * True when no capacity could be read and `size` is the pack COUNT instead.
   * The image slot uses this to suppress its "N pcs/pack" line, which would
   * otherwise state the same number twice, inches apart.
   */
  sizeIsPackCount: boolean;
  price: DisplayPrice;
  /** Text for the rate rule's hanging tab. Empty string when on enquiry. */
  rateTab: string;
}

/**
 * Units we will confidently read out of a product name. Deliberately closed:
 * a bare "l", "m" or "g" matches far too much English to be safe (a name like
 * "Meal Tray" would yield 0 "l"), so only unambiguous tokens are listed and
 * anything unrecognised simply leaves the size null.
 */
const UNIT_PATTERN = "ml|ltr|litre|liter|kg|gsm|gm|inch|in|mm|cm|oz";

/** Canonical short label for each recognised unit. */
function normaliseUnit(raw: string): string {
  const u = raw.toLowerCase();
  if (u === "litre" || u === "liter" || u === "ltr") return "ltr";
  if (u === "inch") return "in";
  if (u === "gm") return "g";
  return u;
}

/** Trim a numeric string without inventing precision: 1.60 → 1.6, 500.0 → 500. */
function tidyNumber(raw: string): string {
  const n = Number(raw);
  return Number.isFinite(n) ? String(n) : raw;
}

interface SizeMatch {
  size: string;
  unit: string;
  /** The exact substring matched, so the caller can strip it from the name. */
  matched: string;
}

/**
 * Pull a size out of a single string. Ordered by how unambiguous each shape is.
 */
function parseSize(text: string): SizeMatch | null {
  if (!text) return null;

  // 1. Capacity / weight / gauge — "500ml", "2000 ml", "1.6KG", "16INCH".
  const capacity = text.match(
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})\\b`, "i")
  );
  if (capacity) {
    return {
      size: tidyNumber(capacity[1]),
      unit: normaliseUnit(capacity[2]),
      matched: capacity[0],
    };
  }

  // 2. Compartment count — "3 COMPARTMENT MEAL TRAY". The compartment count is
  //    what distinguishes these SKUs from each other, so it earns the figure.
  const compartment = text.match(/(\d+)\s*compartment/i);
  if (compartment) {
    return { size: compartment[1], unit: "cmp", matched: compartment[0] };
  }

  // 3. Box dimensions — "8x8x3", "5X7", "8X8X1.5". No unit is asserted because
  //    the data doesn't state one; the figure alone is the identifier.
  const dims = text.match(
    /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*[x×]\s*(\d+(?:\.\d+)?))?/i
  );
  if (dims) {
    const parts = [dims[1], dims[2], dims[3]].filter(Boolean).map(tidyNumber);
    return { size: parts.join("×"), unit: "", matched: dims[0] };
  }

  return null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const tidy = (s: string) =>
  s
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s.,\-·]+|[\s.,\-·]+$/g, "")
    .trim();

/**
 * Strip the pack-count parenthetical — "( 1000 pcs )", "(Pack of 100pcs)",
 * "( 6 ROLL )". Always safe: the pack line on the card states that number
 * already, inches away.
 *
 * This runs BEFORE size parsing, and must. "5X7 SILVER POUCH ( 10 KG )" would
 * otherwise have its PACK WEIGHT read as the product size — the parenthetical
 * is full of numbers and units that describe the case, not the item.
 */
function stripPackCount(name: string): string {
  return tidy(
    name.replace(
      /\s*\(\s*(?:pack\s+of\s+)?[\d,]+\s*(?:pcs?|pkt|pieces?|roll|nos|kg)?\s*\)\s*/gi,
      " "
    )
  );
}

/**
 * Lift the size token out of the name once it is shown as the headline figure,
 * so "500ml Round Container Milky" reads "Round Container Milky".
 *
 * Two guards, both learned from real rows:
 *   - only at the START or END of the name. A size in the middle
 *     ("BOUFFANT CAP 16INCH") is left alone rather than punching a hole in it.
 *   - only if at least two words survive. "8x8x3 WHITE" would otherwise
 *     collapse to "WHITE", which names nothing.
 *
 * Case is deliberately NOT touched. Many rows are ALL CAPS, but re-casing is
 * data editing, not presentation, and the catalogue is being rebuilt by hand
 * anyway (CLAUDE.md Critical Rule #13).
 */
function stripSizeToken(name: string, matched: string): string {
  const tok = escapeRe(matched);
  for (const re of [
    new RegExp(`^\\s*${tok}\\s*`, "i"),
    new RegExp(`\\s*${tok}\\s*$`, "i"),
  ]) {
    if (!re.test(name)) continue;
    const candidate = tidy(name.replace(re, " "));
    if (candidate.split(/\s+/).filter(Boolean).length >= 2) return candidate;
  }
  return name;
}

export function toCardModel(
  product: Product,
  isAuthenticated: boolean
): CardModel {
  // The pack parenthetical goes first — it is noise for BOTH the name and the
  // size parser (see stripPackCount).
  const cleanName = stripPackCount(product.name);

  // variant_label is authored ("2000 ml") and beats parsing a messy name.
  const match = product.variant_label
    ? parseSize(product.variant_label)
    : parseSize(cleanName);

  let size = match?.size ?? null;
  let sizeUnit = match ? match.unit || null : null;
  let sizeIsPackCount = false;

  // Last resort: the pack COUNT becomes the figure. Tier 3 of the image chain
  // leans on this slot carrying a loud number — a card with neither a photo nor
  // a figure would be an empty rectangle, which is the one outcome the design
  // is built to avoid.
  if (!size && product.quantity_in_unit && product.quantity_in_unit > 0) {
    size = product.quantity_in_unit.toLocaleString("en-IN");
    sizeUnit = product.unit_of_measure ?? "pcs";
    sizeIsPackCount = true;
  }

  const price = displayPrice(product, isAuthenticated);

  return {
    // Every step only ever removes, and each has its own guard; if nothing
    // survived, fall back to the row's own name rather than render a blank.
    name:
      (match ? stripSizeToken(cleanName, match.matched) : cleanName) ||
      product.name,
    size,
    sizeUnit,
    sizeIsPackCount,
    price,
    rateTab: rateTabLabel(price),
  };
}
