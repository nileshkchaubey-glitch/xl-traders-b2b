import type { Product } from "./supabase";

// Single source of truth for the "price on enquiry" rule.
//
// A B2B price is shown "on enquiry" (Price on request) whenever it is not a
// real, positive number: NULL/undefined OR zero/negative. A stored 0 is treated
// exactly like NULL — it must NEVER render as "₹0" anywhere (cards, detail,
// cart, WhatsApp, admin lists). Every price render/consume site funnels through
// this helper so the rule lives in one place.
//
// (The catalogue previously overloaded 0 to mean "free"; that semantic is
// retired — 0 now means enquiry, and existing 0 rows are migrated to NULL.)
export function isPriceOnEnquiry(price?: number | null): boolean {
  return price == null || price <= 0;
}

// The amount a cart line should carry: 0 for on-enquiry items (so totals never
// count a bogus price), otherwise the real price.
export function cartLinePrice(price?: number | null): number {
  return isPriceOnEnquiry(price) ? 0 : (price as number);
}

// ─────────────────────────────────────────────────────────────────────────────
// The Rate Card pricing rule (docs/DESIGN_SYSTEM.md §2.1)
//
//   Signed out → MRP.  Signed in → wholesale.
//
// No strikethrough, no "% OFF", no savings badge, no "sign in to see prices"
// prompt: the two audiences each see one honest number, and neither is shown
// the other's. `isPriceOnEnquiry` remains the only gate deciding whether a
// figure is real — it is applied to whichever of the two columns is in play.
//
// Pack price and per-piece rate ALWAYS travel together, so they are derived
// here as one value and never assembled separately at a call site.
// ─────────────────────────────────────────────────────────────────────────────

/** Which of the two price columns a viewer is being shown. */
export type PriceTag = "MRP" | "Wholesale";

export interface DisplayPrice {
  /** True when the applicable column holds no real, positive figure. */
  onEnquiry: boolean;
  /** Price of ONE SELLING UNIT (the pack/case) — never a per-piece rate. */
  packPrice: number | null;
  /** Which column produced `packPrice`. Rendered under it as "<tag> · per pack". */
  tag: PriceTag;
  /** Derived, never stored. Null when `quantity_in_unit` can't support it. */
  perPiece: number | null;
  /** Singular label for one piece inside the pack — "pc", "pkt", "roll". */
  perPieceUnit: string;
}

/**
 * `unit_of_measure` names the pieces INSIDE the pack, never the selling unit
 * (CLAUDE.md, unit-of-sale canonical rule), so it is the right label for a
 * per-piece rate. Singularised the way the design board does it: "pcs" is
 * special-cased to "pc", everything else just loses a trailing "s".
 */
function singularUnit(unit?: string | null): string {
  const u = (unit ?? "pcs").trim().toLowerCase();
  if (!u) return "pc";
  if (u === "pcs" || u === "pieces" || u === "piece") return "pc";
  return u.replace(/s$/, "");
}

/**
 * Resolve what a given viewer should see for a product.
 *
 * `isAuthenticated` selects the column, and nothing else does — a signed-out
 * viewer can never reach `price`, because the anon role has no SELECT grant on
 * it (Architecture Rule #3) and `productSelectCols()` doesn't request it.
 *
 * NOTE ON TODAY'S DATA: `products.mrp` exists but the anon role has no SELECT
 * grant on it either, so for a signed-out viewer `product.mrp` arrives
 * undefined and every product resolves to `onEnquiry` — which is the honest
 * answer, not a bug, and renders as the design's amber "On enquiry" state
 * rather than a fabricated figure. Applying docs/sql/pr2-mrp-public-read.sql
 * and flipping MRP_PUBLIC_READ (lib/productService.ts) opens that column; the
 * 137 of 143 rows that hold no MRP value stay on enquiry until the data is
 * entered. See the PR description.
 */
export function displayPrice(
  product: Pick<
    Product,
    "price" | "mrp" | "quantity_in_unit" | "unit_of_measure"
  >,
  isAuthenticated: boolean
): DisplayPrice {
  const tag: PriceTag = isAuthenticated ? "Wholesale" : "MRP";
  const raw = isAuthenticated ? product.price : product.mrp;
  const perPieceUnit = singularUnit(product.unit_of_measure);

  if (isPriceOnEnquiry(raw)) {
    return {
      onEnquiry: true,
      packPrice: null,
      tag,
      perPiece: null,
      perPieceUnit,
    };
  }

  const packPrice = raw as number;
  const qty = product.quantity_in_unit;
  // Guarded so a NULL or non-positive pack quantity can't print a bogus rate.
  // qty === 1 is legitimate (the pack IS one piece) and yields rate === price.
  const perPiece =
    typeof qty === "number" && qty >= 1
      ? Math.round((packPrice / qty) * 100) / 100
      : null;

  return { onEnquiry: false, packPrice, tag, perPiece, perPieceUnit };
}

/** "₹2,352" — Indian digit grouping, the only money format on the storefront. */
export function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/**
 * The rate-rule tab's text: the per-piece rate when one is derivable,
 * otherwise the pack price. The tab is the one number that separates two
 * identical black containers, so it is never rendered empty.
 */
export function rateTabLabel(dp: DisplayPrice): string {
  if (dp.packPrice == null) return "";
  if (dp.perPiece == null) return formatRupees(dp.packPrice);
  // 2dp keeps sub-rupee rates honest (₹0.28/pc), which is most of the catalogue.
  return `₹${dp.perPiece.toFixed(2)}/${dp.perPieceUnit}`;
}
