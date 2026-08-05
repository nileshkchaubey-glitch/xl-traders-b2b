import { Link, useLocation } from "wouter";
import { useCartStore } from "@/stores/cartStore";
import { useMinOrder } from "@/hooks/useMinOrder";
import { formatRupees } from "@/lib/priceUtils";

/**
 * The cart bar (docs/DESIGN_SYSTEM.md §3.6) — shown storefront-wide whenever
 * the cart has 1+ items.
 *
 * Same rate-card vocabulary as everything else: a 2px ink rule above it, the
 * running figures in mono with tabular numerals, and a single square red
 * action. The pack count and the total are the two things a B2B buyer tracks
 * mid-order, so they read as one stacked figure rather than a sentence.
 *
 * Mobile: full-width, docked directly above the bottom tab nav.
 * Desktop: the same bar, full-width at the foot of the viewport — not a
 * floating rounded panel, which was the old rounded-card language.
 */
export default function CartBar() {
  const [location] = useLocation();
  const items = useCartStore(s => s.items);
  const total = useCartStore(s => s.getTotal());
  const minOrder = useMinOrder();

  if (items.length === 0 || location === "/cart") return null;

  const qty = items.reduce((s, i) => s + i.quantity, 0);
  const allEnquiry = items.every(i => i.priceOnEnquiry);
  // Never ₹0: an all-enquiry cart has no quoted total to show.
  const totalLabel = allEnquiry ? "On enquiry" : formatRupees(total);

  const showProgress = minOrder.enabled && minOrder.value > 0 && !allEnquiry;
  const met = !showProgress || total >= minOrder.value;
  const remaining = showProgress ? Math.max(0, minOrder.value - total) : 0;

  return (
    <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] md:bottom-0 z-40 bg-white border-t-2 border-ink">
      {showProgress && !met && (
        <p className="shell font-mono text-caption font-medium text-red-600 pt-2 tabular-nums">
          {formatRupees(remaining)} more to reach the minimum order
        </p>
      )}
      <div className="shell py-3 md:py-4 flex items-center justify-between gap-4">
        <div className="md:flex md:items-baseline md:gap-[18px] min-w-0">
          <div className="font-mono text-meta md:text-body-sm font-medium text-ink-faint whitespace-nowrap tabular-nums">
            {items.length} item{items.length !== 1 ? "s" : ""} ·{" "}
            {qty.toLocaleString("en-IN")} packs
          </div>
          <div className="font-mono text-price-sm md:text-display-sm font-bold text-ink mt-[3px] md:mt-0 tracking-[-0.03em] tabular-nums">
            {totalLabel}
          </div>
        </div>
        <Link
          href="/cart"
          className="flex-none bg-red-600 text-white px-4 md:px-[22px] py-[11px] md:py-[13px] text-body-sm md:text-body-md font-semibold whitespace-nowrap hover:bg-red-700 transition-colors duration-150"
        >
          <span className="md:hidden">View order</span>
          <span className="hidden md:inline">Review order</span>
        </Link>
      </div>
    </div>
  );
}
