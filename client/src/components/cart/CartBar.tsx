import { Link, useLocation } from "wouter";
import { ShoppingCart, ArrowRight } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { useMinOrder } from "@/hooks/useMinOrder";

/**
 * Persistent floating cart bar — shown storefront-wide whenever the cart has
 * 1+ items. Mobile: full-width bar docked above the bottom tab nav. Desktop:
 * bottom-right bar. Reads the same Zustand cart store as Cart.tsx;
 * total already excludes on-enquiry lines (cartLinePrice zeroes them at
 * add-time), so it's never shown as ₹0.
 */
export default function CartBar() {
  const [location] = useLocation();
  const items = useCartStore(s => s.items);
  const total = useCartStore(s => s.getTotal());
  const minOrder = useMinOrder();

  if (items.length === 0 || location === "/cart") return null;

  // These are PACKS (selling units). They were labelled "pcs" below, which
  // was simply wrong — a pack is not a piece.
  const qty = items.reduce((s, i) => s + i.packs, 0);
  const allEnquiry = items.every(i => i.priceOnEnquiry);
  const totalLabel = allEnquiry ? "On enquiry" : `₹${total.toLocaleString()}`;

  const showProgress = minOrder.enabled && minOrder.value > 0 && !allEnquiry;
  const met = !showProgress || total >= minOrder.value;
  const progressPct = showProgress
    ? Math.min(100, (total / minOrder.value) * 100)
    : 100;
  const remaining = showProgress ? Math.max(0, minOrder.value - total) : 0;

  const ProgressStrip = showProgress ? (
    <div className="px-4 pt-2 pb-1.5 bg-white">
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${met ? "bg-emerald-500" : "bg-red-600"}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <p
        className={`text-[11px] font-semibold mt-1 ${met ? "text-emerald-600" : "text-red-600"}`}
      >
        {met
          ? "Minimum order met ✓"
          : `Add ₹${remaining.toLocaleString()} more to place your order`}
      </p>
    </div>
  ) : null;

  return (
    <>
      {/* Mobile — full-width bar above the bottom tab nav */}
      <div className="md:hidden fixed bottom-[calc(60px+env(safe-area-inset-bottom))] inset-x-0 z-40 shadow-[0_-4px_18px_rgba(0,0,0,0.08)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
        {ProgressStrip}
        <Link
          href="/cart"
          className="flex items-center justify-between gap-3 px-4 py-3 bg-red-600 text-white"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <ShoppingCart size={19} className="flex-shrink-0" />
            <span className="flex flex-col items-start leading-tight min-w-0">
              <span className="text-[10.5px] font-semibold opacity-85">
                {items.length} item{items.length !== 1 ? "s" : ""} · {qty} units
              </span>
              <span className="text-[15px] font-extrabold tabular-nums">
                {totalLabel}
              </span>
            </span>
          </span>
          <span className="flex items-center gap-1 bg-white text-red-600 px-3.5 py-2 rounded-lg text-[13px] font-bold flex-shrink-0">
            View Cart
            <ArrowRight size={14} />
          </span>
        </Link>
      </div>

      {/* Desktop — bottom-right bar */}
      <div className="hidden md:block fixed bottom-6 right-6 z-40 w-80 bg-white rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.18)] border border-slate-200 overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
        {ProgressStrip}
        <Link
          href="/cart"
          className="flex items-center justify-between gap-3 px-4 py-3.5 bg-red-600 text-white hover:bg-red-700 transition"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <ShoppingCart size={19} className="flex-shrink-0" />
            <span className="flex flex-col items-start leading-tight min-w-0">
              <span className="text-[10.5px] font-semibold opacity-85">
                {items.length} item{items.length !== 1 ? "s" : ""} · {qty} units
              </span>
              <span className="text-[15px] font-extrabold tabular-nums">
                {totalLabel}
              </span>
            </span>
          </span>
          <span className="flex items-center gap-1 bg-white text-red-600 px-3.5 py-2 rounded-lg text-[13px] font-bold flex-shrink-0">
            View Cart
            <ArrowRight size={14} />
          </span>
        </Link>
      </div>
    </>
  );
}
