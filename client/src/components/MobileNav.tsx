import { Link, useLocation } from "wouter";
import { Home, LayoutGrid, ShoppingCart, MessageCircle } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";

const WA_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";

/**
 * Mobile-only chrome from the mobile prototype: a fixed bottom tab bar.
 * Rendered by Header so every storefront page gets it. The floating cart
 * summary (count/total/View Cart + min-order progress) lives in CartBar,
 * rendered alongside this by Header. Pages add `pb-24 md:pb-0` so content
 * never hides behind the bar(s).
 */
export default function MobileNav() {
  const [location] = useLocation();
  const items = useCartStore(s => s.items);
  // Distinct products, not summed packs — a B2B cart of 2 SKUs reads as "2".
  const cartCount = items.length;

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
