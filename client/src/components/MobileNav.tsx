import { Link, useLocation } from "wouter";
import { Home, LayoutGrid, ShoppingCart, User } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";

/**
 * Bottom tab bar — the one piece of chrome that genuinely differs on mobile,
 * so it is the one piece that stays a separate component (docs/DESIGN_SYSTEM.md
 * §3.5). Everything else on the storefront is one tree with `md:` breakpoints.
 *
 * Four tabs: Home · Categories · Cart · Account. The fourth used to be a
 * WhatsApp shortcut; the locked design gives that slot to Account, and
 * WhatsApp keeps its own place in the page footer and on the Account screen.
 *
 * Pages reserve room for this with `pb-28 md:pb-0` — it and CartBar are fixed.
 */
export default function MobileNav() {
  const [location] = useLocation();
  const cartCount = useCartStore(s =>
    s.items.reduce((n, i) => n + i.quantity, 0)
  );

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
    {
      href: "/account",
      label: "Account",
      icon: User,
      active: location.startsWith("/account") || location === "/auth",
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-rule flex pb-[env(safe-area-inset-bottom)]">
      {tabs.map(t => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`flex-1 min-h-[56px] flex flex-col items-center justify-center gap-[3px] pt-[9px] pb-3.5 relative ${
            t.active ? "text-red-600" : "text-ink-faint"
          }`}
        >
          <t.icon size={20} />
          <span className="text-meta font-semibold">{t.label}</span>
          {t.badge != null && t.badge > 0 && (
            <span className="absolute top-1 right-[calc(50%-22px)] bg-red-600 text-white font-mono text-[9px] font-bold min-w-4 h-4 flex items-center justify-center px-1 tabular-nums">
              {t.badge > 99 ? "99+" : t.badge}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
