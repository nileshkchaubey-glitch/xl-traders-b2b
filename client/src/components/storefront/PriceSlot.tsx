import { Link } from "wouter";
import { isPriceOnEnquiry } from "@/lib/priceUtils";
import {
  type OrderSpec,
  perPiecePrice,
  formatPerPiecePrice,
} from "@/lib/orderingModel";

interface PriceSlotProps {
  price?: number | null;
  spec: OrderSpec;
  isAuthenticated: boolean;
  /** Stop a card-level link from swallowing the sign-in click. */
  onLinkClick?: (e: React.MouseEvent) => void;
  /**
   * "card" pins a fixed 52px so a grid cell cannot change height between auth
   * states. "pdp" is the same component at buy-panel scale — the rules are
   * identical, only the type sizes differ, which is why this is a prop rather
   * than a second component.
   */
  size?: "card" | "pdp";
}

/**
 * The price area of a product card.
 *
 * ── The two rules this component exists to hold ──────────────────────────
 *
 * 1. A GUEST SEES NO PRICE AT ALL — not a struck-through one, not a range, not
 *    a "from". Just "Sign in for rates". There is no code path here that can
 *    render a number without `isAuthenticated`, and the guest branch never
 *    receives one: `price` is not even selected for anon by the service.
 *
 * 2. THE CARD MUST NOT CHANGE HEIGHT between the two states. This is why the
 *    wrapper carries a fixed `h-[52px]` rather than letting content size it —
 *    a guest and a signed-in buyer see the same grid, and signing in does not
 *    reflow the page under the cursor. Both branches are built to fit it.
 *
 * A signed-in buyer sees ONE rate — the per-piece figure — with the pack price
 * as small supporting text. No MRP, no strike-through, no discount badge, no
 * slab table: those are all deliberately absent, not yet to be built.
 */
export default function PriceSlot({
  price,
  spec,
  isAuthenticated,
  onLinkClick,
  size = "card",
}: PriceSlotProps) {
  const pdp = size === "pdp";
  // Fixed height — see rule 2 above. Change either and you must re-check both
  // auth states at 390px and 1440px.
  const shell = pdp
    ? "min-h-[68px] flex flex-col justify-center"
    : "h-[52px] flex flex-col justify-center";
  // COLOUR: the rate is text-red-600, not slate. The prototype puts the rate in
  // #dc2626 on every surface, and it was shipping slate-900 -- the single
  // biggest visual loss found in the type/spacing sweep. red-600 IS #dc2626.
  // SIZE: the prototype-derived role tokens (DESIGN_SYSTEM 1.2). Card and PDP
  // are different roles at 13.5/15 and 17/18, not one size scaled.
  const rateCls = pdp
    ? "text-price-detail lg:text-price-detail-lg font-extrabold text-red-600 tabular-nums leading-none"
    : "text-price-card lg:text-price-card-lg font-extrabold text-red-600 tabular-nums leading-none";
  const subCls = pdp
    ? "text-meta lg:text-meta-lg text-slate-500 tabular-nums"
    : "text-meta lg:text-meta-lg text-slate-500 tabular-nums";

  if (!isAuthenticated) {
    return (
      <div className={shell}>
        <Link
          href="/auth"
          onClick={onLinkClick}
          className={`inline-flex w-fit items-center gap-1 font-extrabold text-red-600 hover:underline ${
            pdp ? "text-xl" : "text-body-sm"
          }`}
        >
          Sign in for rates
        </Link>
        <span
          className={
            pdp ? "text-body-sm text-slate-500" : "text-caption text-slate-500"
          }
        >
          Wholesale rates for businesses
        </span>
      </div>
    );
  }

  if (isPriceOnEnquiry(price)) {
    return (
      <div className={shell}>
        {/* Amber is the documented On-Enquiry colour (DESIGN_SYSTEM §1.3). */}
        <span
          className={`font-bold text-amber-700 ${pdp ? "text-xl" : "text-body-sm"}`}
        >
          Price on enquiry
        </span>
        <span
          className={
            pdp ? "text-body-sm text-slate-500" : "text-caption text-slate-500"
          }
        >
          Ask us on WhatsApp
        </span>
      </div>
    );
  }

  const rate = perPiecePrice(price, spec);

  return (
    <div className={shell}>
      {rate != null ? (
        <>
          <span className="flex items-baseline gap-1">
            <span className={rateCls}>₹{formatPerPiecePrice(rate)}</span>
            <span className="text-price-unit lg:text-price-unit-lg font-semibold text-slate-500">
              / piece
            </span>
          </span>
          <span className={subCls}>
            ₹{price!.toLocaleString("en-IN")} per {spec.noun}
          </span>
        </>
      ) : (
        // No usable pack size, so a per-piece rate would be a division by an
        // unknown. Show the selling-unit price and say which unit it is.
        <>
          <span className={rateCls}>₹{price!.toLocaleString("en-IN")}</span>
          <span className={subCls}>per {spec.noun}</span>
        </>
      )}
    </div>
  );
}
