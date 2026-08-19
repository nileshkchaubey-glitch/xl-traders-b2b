import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Search,
  Menu,
  X,
  LogOut,
  LogIn,
  ShoppingCart,
  ChevronDown,
  Package,
  Phone,
  MessageCircle,
  Truck,
  ShieldCheck,
  Clock,
  User,
} from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { useCartStore } from "@/stores/cartStore";
import MobileNav from "@/components/MobileNav";
import CartBar from "@/components/cart/CartBar";
import InstallPrompt from "@/components/InstallPrompt";
import {
  categoryService,
  productService,
  CategoryGroup,
} from "@/lib/productService";
import { Product } from "@/lib/supabase";
import { normalizeImageUrl } from "@/lib/imageUtils";
import { isPriceOnEnquiry } from "@/lib/priceUtils";
import { settingsService, FALLBACKS } from "@/lib/settingsService";
import SectionEyebrow from "@/components/SectionEyebrow";

const RECENTS_KEY = "xl-recent-searches";
const POPULAR_SEARCHES = [
  "500ml container",
  "paper cups",
  "carry bags",
  "aluminium foil",
];

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
  } catch {
    return [];
  }
}

function saveRecent(term: string) {
  const next = [term, ...loadRecents().filter(r => r !== term)].slice(0, 4);
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* storage full/blocked — recents are a nicety */
  }
  return next;
}

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [announcement, setAnnouncement] = useState(FALLBACKS.announcement);
  const { isAuthenticated, isAdmin, user, signOut } = useAuthStore();
  const cartCount = useCartStore(s => s.getLineCount());
  const [, setLocation] = useLocation();
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";
  const phone1 = import.meta.env.VITE_PHONE_1 || "9773239442";

  useEffect(() => {
    setRecents(loadRecents());
    categoryService
      .getCategoriesGroupedByGroup()
      .then(setCategoryGroups)
      .catch(() => {});
    settingsService
      .getContent("announcement")
      .then(setAnnouncement)
      .catch(() => {});
  }, []);

  // Live search suggestions, debounced so we don't hit the DB on every keystroke.
  useEffect(() => {
    clearTimeout(searchDebounce.current);
    const q = searchQuery.trim();
    if (!q) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchDebounce.current = setTimeout(async () => {
      try {
        const results = await productService.search(q, 5);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(searchDebounce.current);
  }, [searchQuery]);

  const closeOverlays = () => {
    setSearchOpen(false);
    setCatOpen(false);
  };

  const goSearch = (term: string) => {
    const q = term.trim();
    if (!q) return;
    setRecents(saveRecent(q));
    closeOverlays();
    setSearchQuery("");
    setLocation(`/catalog?search=${encodeURIComponent(q)}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    goSearch(searchQuery);
  };

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  const overlayOpen = searchOpen || catOpen;

  // Shared between the desktop dropdown and the mobile panel.
  const searchPanelBody = searchQuery.trim() ? (
    suggestions.length > 0 ? (
      <div className="flex flex-col gap-0.5">
        {suggestions.map(p => (
          <Link
            key={p.id}
            href={`/product/${p.id}`}
            onClick={() => {
              setRecents(saveRecent(p.name));
              closeOverlays();
              setSearchQuery("");
            }}
            className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-slate-50 transition"
          >
            <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
              {p.image_url ? (
                <img
                  src={normalizeImageUrl(p.image_url, 100) ?? ""}
                  alt=""
                  className="w-full h-full object-contain"
                />
              ) : (
                <Package size={16} className="text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-body-sm font-semibold text-slate-900 truncate">
                {p.name}
              </div>
              <div className="text-caption text-slate-500 truncate">
                {[p.brand, p.moq ? `MOQ ${p.moq}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            {isAuthenticated && !isPriceOnEnquiry(p.price) && (
              <div className="text-body-sm font-bold text-red-600">
                ₹{p.price!.toLocaleString()}
              </div>
            )}
          </Link>
        ))}
        <button
          onClick={() => goSearch(searchQuery)}
          className="text-left px-2.5 py-2 text-body-sm font-semibold text-red-600 hover:underline"
        >
          See all results for "{searchQuery.trim()}" →
        </button>
      </div>
    ) : searching ? (
      <div className="py-4 text-center text-sm text-slate-400">Searching…</div>
    ) : (
      <div className="py-3.5 px-2.5 text-center">
        <div className="text-body-sm font-semibold text-slate-900 mb-1">
          No matches for "{searchQuery.trim()}"
        </div>
        <div className="text-body-sm text-slate-500 mb-3">
          The catalogue is still being listed — ask us directly and we'll check.
        </div>
        <a
          href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hi XL Traders, do you stock "${searchQuery.trim()}"?`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-body-sm font-semibold hover:bg-emerald-700 transition"
        >
          <MessageCircle size={14} />
          Ask on WhatsApp
        </a>
      </div>
    )
  ) : (
    <div>
      {recents.length > 0 && (
        <>
          <div className="text-caption font-bold tracking-widest uppercase text-slate-400 mb-2">
            Recent searches
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {recents.map(r => (
              <button
                key={r}
                onClick={() => goSearch(r)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-body-sm font-medium text-slate-700 hover:border-red-600 hover:text-red-600 transition"
              >
                <Clock size={12} />
                {r}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="text-caption font-bold tracking-widest uppercase text-slate-400 mb-2">
        Popular right now
      </div>
      <div className="flex flex-wrap gap-2">
        {POPULAR_SEARCHES.map(t => (
          <button
            key={t}
            onClick={() => goSearch(t)}
            className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-body-sm font-semibold text-red-700 hover:bg-red-100 transition"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* PWA install banner — dismissible, shown at most once (see InstallPrompt) */}
      <InstallPrompt />

      {/* Utility bar */}
      <div className="bg-slate-900 text-slate-300 text-xs hidden md:block">
        <div className="xl-shell py-1.5 flex items-center gap-5">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-emerald-400" />
            {announcement.gstLine}
          </span>
          <span className="flex items-center gap-1.5">
            <Truck size={13} />
            {announcement.deliveryLine}
          </span>
          <span className="flex items-center gap-1.5 ml-auto">
            <Clock size={13} />
            {announcement.hours}
          </span>
          <a
            href={`tel:${phone1}`}
            className="flex items-center gap-1.5 hover:text-white transition"
          >
            <Phone size={13} />
            +91 {phone1.replace(/^91/, "")}
          </a>
        </div>
      </div>

      {/* Main header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="xl-shell py-3 flex items-center gap-3 lg:gap-5">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-red-600 rounded-lg flex items-center justify-center text-white font-extrabold text-lg tracking-tight">
              XL
            </div>
            <div className="leading-tight">
              <div className="font-extrabold text-slate-900 text-base tracking-[0.08em]">
                TRADERS
              </div>
              <div className="text-caption text-slate-500 tracking-wide hidden sm:block">
                Wholesale Packaging · Surat
              </div>
            </div>
          </Link>

          {/* Categories mega-menu (desktop) */}
          <div className="relative hidden lg:block">
            <button
              onClick={() => {
                setCatOpen(!catOpen);
                setSearchOpen(false);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 transition ${
                catOpen ? "bg-slate-100" : "bg-white hover:bg-slate-50"
              }`}
            >
              <Package size={16} />
              Categories
              <ChevronDown size={14} />
            </button>
            {catOpen && categoryGroups.length > 0 && (
              <div className="absolute top-[52px] left-0 w-[720px] bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 grid grid-cols-3 gap-6 z-50">
                {categoryGroups.slice(0, 6).map(group => (
                  <div key={group.group_name}>
                    <SectionEyebrow className="mb-2.5">
                      {group.group_name}
                    </SectionEyebrow>
                    <div className="flex flex-col gap-0.5">
                      {group.categories.slice(0, 8).map(cat => (
                        <Link
                          key={cat.id}
                          href={`/catalog?category=${cat.slug}`}
                          onClick={closeOverlays}
                          className="px-2.5 py-1.5 -mx-2.5 rounded-lg text-body-sm font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 transition"
                        >
                          {cat.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
                <Link
                  href="/catalog"
                  onClick={closeOverlays}
                  className="col-span-3 text-center text-sm font-semibold text-red-600 pt-2 border-t border-slate-100 hover:underline"
                >
                  View all categories →
                </Link>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="flex-1 relative hidden md:block">
            <form onSubmit={handleSearch}>
              <div
                className={`flex items-center gap-2 bg-slate-100 border-[1.5px] rounded-xl pl-3.5 pr-2 h-11 transition ${
                  searchOpen ? "border-red-600 bg-white" : "border-transparent"
                }`}
              >
                <Search size={17} className="text-slate-500 flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => {
                    setSearchOpen(true);
                    setCatOpen(false);
                  }}
                  placeholder='Search products — try "500ml container" or a SKU'
                  className="flex-1 bg-transparent outline-none text-sm text-slate-900 h-full"
                />
              </div>
            </form>

            {searchOpen && (
              <div className="absolute top-[52px] left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 z-50">
                {searchPanelBody}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 md:gap-2 ml-auto md:ml-0 min-w-0">
            <a
              href={`tel:${phone1}`}
              className="hidden md:flex items-center gap-1.5 h-11 px-3.5 bg-white text-slate-900 border border-slate-200 rounded-xl text-body-sm font-semibold hover:border-slate-400 transition motion-reduce:transition-none"
            >
              <Phone size={16} />
              Call
            </a>

            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 h-11 px-3.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-body-sm font-semibold hover:bg-emerald-100 transition motion-reduce:transition-none"
            >
              <MessageCircle size={16} />
              WhatsApp
            </a>

            {isAuthenticated ? (
              <div className="hidden md:flex items-center gap-2">
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="h-11 px-3.5 flex items-center bg-white text-slate-900 border border-slate-200 rounded-xl text-body-sm font-semibold hover:border-slate-400 transition"
                  >
                    Admin
                  </Link>
                )}
                <button
                  onClick={handleSignOut}
                  title={user?.email || "Sign out"}
                  className="flex items-center gap-1.5 h-11 px-3.5 bg-white text-slate-900 border border-slate-200 rounded-xl text-body-sm font-semibold hover:border-slate-400 transition"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/auth"
                className="hidden md:flex items-center gap-1.5 h-11 px-3.5 bg-white text-slate-900 border border-slate-200 rounded-xl text-body-sm font-semibold hover:border-slate-400 transition"
              >
                <User size={16} />
                Sign In
              </Link>
            )}

            {/* Same-day delivery — icon-only on mobile so it sits alongside the
                new Call/WhatsApp icons without crowding or truncating (full text
                still on the desktop utility bar). */}
            <span
              className="md:hidden flex items-center justify-center w-8 h-8 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex-shrink-0"
              title={announcement.mobilePill}
            >
              <Truck size={14} aria-hidden="true" />
              <span className="sr-only">{announcement.mobilePill}</span>
            </span>

            {/* Compact Call + WhatsApp icons — mobile header only. Lives in the
                top bar so it never competes with the fixed-bottom CartBar. */}
            <a
              href={`tel:${phone1}`}
              aria-label="Call us"
              className="md:hidden flex items-center justify-center w-8 h-8 bg-slate-100 text-slate-700 rounded-full hover:bg-slate-200 transition motion-reduce:transition-none flex-shrink-0"
            >
              <Phone size={14} />
            </a>
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat on WhatsApp"
              className="md:hidden flex items-center justify-center w-8 h-8 bg-emerald-50 text-emerald-700 rounded-full hover:bg-emerald-100 transition motion-reduce:transition-none flex-shrink-0"
            >
              <MessageCircle size={14} />
            </a>

            <Link
              href="/cart"
              className="relative hidden md:flex items-center gap-2 h-11 px-4 bg-red-600 text-white rounded-xl text-body-sm font-bold hover:bg-red-700 transition shadow-[0_4px_14px_rgba(220,38,38,0.25)]"
            >
              <ShoppingCart size={17} />
              <span>Cart</span>
              {cartCount > 0 && (
                <span className="bg-white text-red-600 text-caption font-extrabold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 hover:bg-slate-100 rounded-lg transition"
              aria-label="Menu"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile search — shares the live-suggestion panel with desktop */}
        <div className="md:hidden relative">
          <form onSubmit={handleSearch} className="px-4 pb-3">
            <div
              className={`flex items-center gap-2 bg-slate-100 border-[1.5px] rounded-xl px-3.5 h-11 transition ${
                searchOpen ? "border-red-600 bg-white" : "border-transparent"
              }`}
            >
              <Search size={16} className="text-slate-500" />
              <input
                type="text"
                placeholder="Search products, brands, sizes…"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                className="flex-1 min-w-0 bg-transparent outline-none text-sm"
              />
            </div>
          </form>
          {searchOpen && (
            <div className="absolute top-full left-0 right-0 bg-white border-b border-slate-200 shadow-2xl px-4 py-3.5 z-50">
              {searchPanelBody}
              <button
                onClick={closeOverlays}
                className="mt-3.5 w-full h-10 bg-slate-100 rounded-lg text-body-sm font-semibold text-slate-500"
              >
                Close
              </button>
            </div>
          )}
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-slate-50">
            <div className="px-4 py-4 space-y-1">
              <Link
                href="/catalog"
                onClick={() => setIsMenuOpen(false)}
                className="block px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                Product Catalogue
              </Link>
              <Link
                href="/cart"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <ShoppingCart size={16} />
                Cart
                {cartCount > 0 && (
                  <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {cartCount}
                  </span>
                )}
              </Link>
              <a
                href={`tel:${phone1}`}
                className="block px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                📞 Call: {phone1}
              </a>
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                💬 WhatsApp
              </a>
              {isAuthenticated ? (
                <>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setIsMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
                    >
                      Admin Panel
                    </Link>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
                  >
                    <LogOut size={16} className="inline mr-2" />
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  href="/auth"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  <LogIn size={16} className="inline mr-2" />
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Click-away backdrop for menus */}
      {overlayOpen && (
        <div className="fixed inset-0 z-30" onClick={closeOverlays} />
      )}

      {/* Mobile bottom nav */}
      <MobileNav />

      {/* Floating cart bar — mobile (above bottom nav) + desktop (bottom-right) */}
      <CartBar />
    </>
  );
}
