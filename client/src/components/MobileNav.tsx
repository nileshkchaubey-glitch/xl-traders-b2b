import { Link, useLocation } from "wouter";
import {
  Home,
  LayoutGrid,
  ShoppingCart,
  MessageCircle,
  ArrowRight,
} from "lucide-react";
import { useCartStore } from "@/stores/cartStore";

const WA_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";

/**
 * Mobile-only chrome from the mobile prototype: a fixed bottom tab bar plus a
 * floating cart FAB (count + running total) on browsing screens. Rendered by
 * Header so every storefront page gets both. Pages add `pb-24 md:pb-0` so
 * content never hides behind the bar.
 */
export default function MobileNav() {
  const [location] = useLocation();
  const items = useCartStore(s => s.items);
  const cartCount = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const allEnquiry = items.length > 0 && items.every(i => i.priceOnEnquiry);

  const tabs = [
    { href: "/", label: "Home", icon: Home, active: location === "/" },
    {
      href: "/catalog",
      label: "Categories",
      icon: LayoutGrid,
      active: location.startsWith("/catalog"),
    },
    {
      href: "/cart",
      label: "Cart",
      icon: ShoppingCart,
      active: location === "/cart",
      badge: cartCount,
    },
  ];

  return (
    <>
      {/* Floating cart FAB — browsing screens only, above the tab bar */}
      {cartCount > 0 && location !== "/cart" && (
        <Link
          href="/cart"
          aria-label="View cart"
          className="md:hidden fixed bottom-20 right-3.5 z-40 flex items-center gap-2.5 h-14 pl-4 pr-3 bg-red-600 text-white rounded-full shadow-[0_10px_26px_rgba(220,38,38,0.42)] animate-in fade-in slide-in-from-bottom-2"
        >
          <span className="relative flex">
            <ShoppingCart size={21} />
            <span className="absolute -top-2 -right-2.5 bg-white text-red-600 border-[1.5px] border-red-600 min-w-[19px] h-[19px] rounded-full flex items-center justify-center text-[10.5px] font-extrabold px-1">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          </span>
          <span className="flex flex-col items-start leading-tight pr-1">
            <span className="text-[10px] font-semibold opacity-85">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </span>
            <span className="text-[15px] font-extrabold tabular-nums flex items-center gap-1.5">
              {allEnquiry ? "On enquiry" : `₹${total.toLocaleString()}`}
              <ArrowRight size={14} />
            </span>
          </span>
        </Link>
      )}

      {/* Bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex pb-[max(4px,env(safe-area-inset-bottom))]">
        {tabs.map(t => (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 min-h-[60px] flex flex-col items-center justify-center gap-1 relative ${
              t.active ? "text-red-600" : "text-slate-500"
            }`}
          >
            <t.icon size={21} />
            <span className="text-[10px] font-bold">{t.label}</span>
            {t.badge != null && t.badge > 0 && (
              <span className="absolute top-1.5 right-[calc(50%-22px)] bg-red-600 text-white text-[9px] font-extrabold min-w-4 h-4 rounded-full flex items-center justify-center px-1">
                {t.badge > 99 ? "99+" : t.badge}
              </span>
            )}
          </Link>
        ))}
        <a
          href={`https://wa.me/${WA_NUMBER}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-h-[60px] flex flex-col items-center justify-center gap-1 text-emerald-600"
        >
          <MessageCircle size={21} />
          <span className="text-[10px] font-bold">WhatsApp</span>
        </a>
      </nav>
    </>
  );
}
