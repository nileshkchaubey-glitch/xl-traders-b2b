import { Link, useLocation } from "wouter";
import { ShoppingCart, ArrowRight } from "lucide-react";
import { useCartStore, cartTotals } from "@/stores/cartStore";
import { useMinOrder } from "@/hooks/useMinOrder";

const money = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * The persistent cart bar, shown storefront-wide whenever the cart has a line.
 *
 *   ₹6,587.00 · 2 Items · 2,200 quantities · View cart
 *
 * Three deliberate details:
 *  * "Items" is DISTINCT PRODUCTS and "quantities" is PIECES. The previous
 *    version showed a pack count labelled "pcs", which was simply wrong.
 *  * Every figure comes from `cartTotals` — the same function the cart page and
 *    the WhatsApp fulfilment message use, so the bar cannot quote a total the
 *    cart then contradicts.
 *  * On mobile it sits ABOVE the bottom nav (60px + safe area), matching the
 *    PDP action bar, and pages carry bottom padding so nothing hides behind it.
 */
export default function CartBar() {
  const [location] = useLocation();
  const items = useCartStore(s => s.items);
  const minOrder = useMinOrder();

  const t = cartTotals(items);

  if (items.length === 0 || location === "/cart") return null;

  const totalLabel = t.allEnquiry ? "On enquiry" : `₹${money(t.total)}`;

  const showProgress = minOrder.enabled && minOrder.value > 0 && !t.allEnquiry;
  const met = !showProgress || t.total >= minOrder.value;
  const progressPct = showProgress
    ? Math.min(100, (t.total / minOrder.value) * 100)
    : 100;
  const remaining = showProgress ? Math.max(0, minOrder.value - t.total) : 0;

  const progress = showProgress ? (
    <div className="bg-white px-4 pb-1.5 pt-2">
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${met ? "bg-emerald-500" : "bg-red-600"}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <p
        className={`mt-1 text-[11px] font-semibold ${met ? "text-emerald-600" : "text-red-600"}`}
      >
        {met
          ? "Minimum order met ✓"
          : `Add ₹${money(remaining)} more to place your order`}
      </p>
    </div>
  ) : null;

  const summary = (
    <span className="flex min-w-0 items-center gap-2.5">
      <ShoppingCart size={19} className="flex-shrink-0" />
      <span className="flex min-w-0 flex-col items-start leading-tight">
        <span className="text-[15px] font-extrabold tabular-nums">
          {totalLabel}
        </span>
        <span className="truncate text-[10.5px] font-semibold opacity-85 tabular-nums">
          {t.lines} Item{t.lines !== 1 ? "s" : ""} ·{" "}
          {t.pieces.toLocaleString("en-IN")} quantities
        </span>
      </span>
    </span>
  );

  const cta = (
    <span className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-white px-3.5 py-2 text-[13px] font-bold text-red-600">
      View cart
      <ArrowRight size={14} />
    </span>
  );

  return (
    <>
      {/* Mobile — docked above the bottom tab nav. */}
      <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-40 shadow-[0_-4px_18px_rgba(0,0,0,0.08)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 md:hidden">
        {progress}
        <Link
          href="/cart"
          className="flex items-center justify-between gap-3 bg-red-600 px-4 py-3 text-white"
        >
          {summary}
          {cta}
        </Link>
      </div>

      {/* Desktop — bottom-right. */}
      <div className="fixed bottom-6 right-6 z-40 hidden w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 md:block">
        {progress}
        <Link
          href="/cart"
          className="flex items-center justify-between gap-3 bg-red-600 px-4 py-3.5 text-white transition hover:bg-red-700"
        >
          {summary}
          {cta}
        </Link>
      </div>
    </>
  );
}
