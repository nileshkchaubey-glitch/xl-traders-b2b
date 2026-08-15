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
}: PriceSlotProps) {
  // Fixed height — see rule 2 above. Change this and you must re-check both
  // states at 390px and 1440px.
  const shell = "h-[52px] flex flex-col justify-center";

  if (!isAuthenticated) {
    return (
      <div className={shell}>
        <Link
          href="/auth"
          onClick={onLinkClick}
          className="inline-flex w-fit items-center gap-1 text-body-sm font-extrabold text-red-600 hover:underline"
        >
          Sign in for rates
        </Link>
        <span className="text-caption text-slate-500">
          Wholesale rates for businesses
        </span>
      </div>
    );
  }

  if (isPriceOnEnquiry(price)) {
    return (
      <div className={shell}>
        {/* Amber is the documented On-Enquiry colour (DESIGN_SYSTEM §1.3). */}
        <span className="text-body-sm font-bold text-amber-700">
          Price on enquiry
        </span>
        <span className="text-caption text-slate-500">
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
            <span className="text-lg font-extrabold text-slate-900 tabular-nums leading-none">
              ₹{formatPerPiecePrice(rate)}
            </span>
            <span className="text-caption font-semibold text-slate-500">
              / piece
            </span>
          </span>
          <span className="text-caption text-slate-500 tabular-nums">
            ₹{price!.toLocaleString("en-IN")} per {spec.noun}
          </span>
        </>
      ) : (
        // No usable pack size, so a per-piece rate would be a division by an
        // unknown. Show the selling-unit price and say which unit it is.
        <>
          <span className="text-lg font-extrabold text-slate-900 tabular-nums leading-none">
            ₹{price!.toLocaleString("en-IN")}
          </span>
          <span className="text-caption text-slate-500">per {spec.noun}</span>
        </>
      )}
    </div>
  );
}
