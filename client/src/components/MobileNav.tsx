import { Link, useLocation } from "wouter";
import { Home, LayoutGrid, Search, ShoppingCart, User } from "lucide-react";
import { useCartStore, cartTotals } from "@/stores/cartStore";
import { useAuthStore } from "@/lib/authStore";

/**
 * Mobile bottom navigation — five tabs.
 *
 * Home · Categories · Search · Cart · Account
 *
 * Two details that are rules rather than styling:
 *  * The active tab uses `--xl-accent`, so festival theming reaches it without
 *    the component ever reading the theme value.
 *  * The cart badge is DISTINCT PRODUCTS (`cartTotals().lines`), not summed
 *    packs or pieces. A B2B cart of two SKUs reads "2", not "6,500" — and the
 *    figure comes from the same `cartTotals` the cart page and the WhatsApp
 *    message use, so it cannot disagree with either.
 *
 * The sticky cart bar sits ABOVE this (`bottom-[calc(60px+safe-area)]`), and
 * pages carry bottom padding so nothing hides behind either bar.
 */
export default function MobileNav() {
  const [location] = useLocation();
  const items = useCartStore(s => s.items);
  const { isAuthenticated } = useAuthStore();

  const cartCount = cartTotals(items).lines;

  const tabs = [
    { href: "/", label: "Home", icon: Home, active: location === "/" },
    {
      href: "/categories",
      label: "Categories",
      icon: LayoutGrid,
      active:
        location.startsWith("/categories") || location.startsWith("/catalog"),
    },
    {
      href: "/search",
      label: "Search",
      icon: Search,
      active: location.startsWith("/search"),
    },
    {
      href: "/cart",
      label: "Cart",
      icon: ShoppingCart,
      active: location === "/cart",
      badge: cartCount,
    },
    {
      href: isAuthenticated ? "/account" : "/auth",
      label: "Account",
      icon: User,
      active: location.startsWith("/account") || location.startsWith("/auth"),
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white pb-[max(4px,env(safe-area-inset-bottom))] md:hidden">
      {tabs.map(t => (
        <Link
          key={t.href}
          href={t.href}
          className="relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1"
          style={{ color: t.active ? "var(--xl-accent)" : undefined }}
          aria-current={t.active ? "page" : undefined}
        >
          <t.icon size={20} className={t.active ? "" : "text-slate-500"} />
          <span
            className={`text-[10px] font-bold ${t.active ? "" : "text-slate-500"}`}
          >
            {t.label}
          </span>
          {t.badge != null && t.badge > 0 && (
            <span
              className="absolute top-1.5 right-[calc(50%-20px)] flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-extrabold text-white"
              style={{ background: "var(--xl-accent)" }}
            >
              {t.badge > 99 ? "99+" : t.badge}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
