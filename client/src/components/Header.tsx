import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, MessageCircle, X } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import MobileNav from "@/components/MobileNav";
import CartBar from "@/components/cart/CartBar";
import InstallPrompt from "@/components/InstallPrompt";
import { productService } from "@/lib/productService";
import { Product } from "@/lib/supabase";
import { toCardModel } from "@/lib/cardModel";
import { formatRupees } from "@/lib/priceUtils";
import { settingsService, FALLBACKS } from "@/lib/settingsService";

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

interface HeaderProps {
  /**
   * Total published SKUs, shown in the search placeholder ("Search 143
   * products"). Passed in by the page that already counted them so the header
   * doesn't fire a second query; omitted elsewhere and the placeholder falls
   * back to generic copy.
   */
  productCount?: number;
}

/**
 * The storefront header (docs/DESIGN_SYSTEM.md §3.4).
 *
 * There is no hero on this site, so this IS the top of the page: logo, search,
 * and one small factual delivery line. The old dark utility bar, the Categories
 * mega-menu, the Call/WhatsApp/Cart button cluster and the hamburger are all
 * gone — categories are the first section of the page itself, and the bottom
 * nav owns navigation on mobile.
 *
 * Search is an underlined field (2px ink rule), not a filled pill: the same
 * rule vocabulary the rate card uses.
 */
export default function Header({ productCount }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState(FALLBACKS.announcement);
  const { isAuthenticated, profile, user } = useAuthStore();
  const [, setLocation] = useLocation();
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";

  useEffect(() => {
    setRecents(loadRecents());
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
        setSuggestions(await productService.search(q, 5));
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(searchDebounce.current);
  }, [searchQuery]);

  const goSearch = (term: string) => {
    const q = term.trim();
    if (!q) return;
    setRecents(saveRecent(q));
    setSearchOpen(false);
    setSearchQuery("");
    setLocation(`/catalog?search=${encodeURIComponent(q)}`);
  };

  // The account label is the only personal thing in the header — a name when
  // we have one, otherwise the plain invitation. Never a "sign in to see
  // prices" nag; that pattern is out of the design entirely.
  const accountLabel = isAuthenticated
    ? profile?.contact_person?.split(" ")[0] ||
      profile?.company_name ||
      user?.email?.split("@")[0] ||
      "Account"
    : "Sign in";

  const searchPanelBody = searchQuery.trim() ? (
    suggestions.length > 0 ? (
      <div className="flex flex-col">
        {suggestions.map(p => {
          const m = toCardModel(p, isAuthenticated);
          return (
            <Link
              key={p.id}
              href={`/product/${p.id}`}
              onClick={() => {
                setRecents(saveRecent(p.name));
                setSearchOpen(false);
                setSearchQuery("");
              }}
              className="flex items-center gap-3 py-2.5 border-b border-rule-soft hover:bg-quiet transition-colors duration-150"
            >
              <div className="flex-1 min-w-0">
                <div className="text-body-sm font-medium text-ink truncate">
                  {m.name}
                </div>
                <div className="font-mono text-caption text-ink-faint truncate tabular-nums">
                  {[
                    m.size
                      ? `${m.size}${m.sizeUnit ? ` ${m.sizeUnit}` : ""}`
                      : null,
                    p.quantity_in_unit
                      ? `${p.quantity_in_unit.toLocaleString("en-IN")}/pack`
                      : null,
                    p.sku,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              {!m.price.onEnquiry && (
                <span className="font-mono text-body-sm font-semibold text-ink flex-none tabular-nums">
                  {formatRupees(m.price.packPrice as number)}
                </span>
              )}
            </Link>
          );
        })}
        <button
          onClick={() => goSearch(searchQuery)}
          className="text-left pt-3 text-body-sm font-semibold text-red-600"
        >
          See all results for "{searchQuery.trim()}" →
        </button>
      </div>
    ) : searching ? (
      <div className="py-4 font-mono text-caption text-ink-faint">
        Searching…
      </div>
    ) : (
      <div className="py-3">
        <div className="text-body-sm font-semibold text-ink mb-1">
          No matches for "{searchQuery.trim()}"
        </div>
        <div className="text-micro text-ink-muted mb-3">
          We probably stock it — ask us directly and we'll add it to your order.
        </div>
        <a
          href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hi XL Traders, do you stock "${searchQuery.trim()}"?`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-wa text-white px-4 py-2 text-body-sm font-semibold"
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
          <div className="font-mono text-meta font-medium uppercase tracking-[0.16em] text-ink-faint mb-2">
            Recent
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {recents.map(r => (
              <button
                key={r}
                onClick={() => goSearch(r)}
                className="px-3 py-1.5 border border-rule text-body-sm text-ink hover:border-ink transition-colors duration-150"
              >
                {r}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="font-mono text-meta font-medium uppercase tracking-[0.16em] text-ink-faint mb-2">
        Popular
      </div>
      <div className="flex flex-wrap gap-2">
        {POPULAR_SEARCHES.map(t => (
          <button
            key={t}
            onClick={() => goSearch(t)}
            className="px-3 py-1.5 border border-rule text-body-sm text-ink hover:border-ink transition-colors duration-150"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <InstallPrompt />

      <header className="bg-white">
        <div className="shell pt-4 md:pt-5">
          {/* Logo + account. On desktop the search joins this same row. */}
          <div className="flex items-center gap-4 lg:gap-8">
            <Link href="/" className="flex-none" aria-label="XL Traders — home">
              <img
                src="/images/brand/xl-traders-logo.png"
                alt="XL Traders"
                className="h-7 md:h-[34px] w-auto block"
              />
            </Link>

            {/* Desktop search — inline. Mobile gets its own row below so the
                field keeps full width at 390. */}
            <form
              onSubmit={e => {
                e.preventDefault();
                goSearch(searchQuery);
              }}
              className="hidden md:flex flex-1 items-center gap-2.5 border-b-2 border-ink py-2.5 px-0.5"
            >
              <Search size={18} className="text-ink-faint flex-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder={
                  productCount
                    ? `Search ${productCount} products`
                    : "Search products"
                }
                className="flex-1 bg-transparent outline-none text-body-md text-ink placeholder:text-ink-faint"
              />
            </form>

            <Link
              href="/account"
              className="flex-none font-mono text-caption md:text-body-sm font-medium text-ink-muted hover:text-ink whitespace-nowrap transition-colors duration-150"
            >
              {accountLabel}
            </Link>
          </div>

          {/* Mobile search row */}
          <form
            onSubmit={e => {
              e.preventDefault();
              goSearch(searchQuery);
            }}
            className="md:hidden flex items-center gap-2.5 border-b-2 border-ink py-2.5 px-0.5 mt-4"
          >
            <Search size={17} className="text-ink-faint flex-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder={
                productCount
                  ? `Search ${productCount} products`
                  : "Search products"
              }
              className="flex-1 min-w-0 bg-transparent outline-none text-body-md text-ink placeholder:text-ink-faint"
            />
            {searchOpen && (
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery("");
                }}
                aria-label="Close search"
                className="flex-none text-ink-faint"
              >
                <X size={17} />
              </button>
            )}
          </form>

          {/* The delivery promise — one small factual line, not a headline.
              No countdown, no stat counters. */}
          <p className="font-mono text-caption md:text-micro font-medium text-ink-faint mt-2.5 md:mt-3.5">
            {announcement.deliveryLine}
          </p>
        </div>

        {searchOpen && (
          <div className="relative z-50">
            <div className="absolute inset-x-0 top-1 bg-white border-y border-rule shadow-[0_12px_24px_rgba(27,30,30,0.08)]">
              <div className="shell py-4">{searchPanelBody}</div>
            </div>
          </div>
        )}
      </header>

      {/* Click-away for the search panel */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setSearchOpen(false)}
          aria-hidden
        />
      )}

      <MobileNav />
      <CartBar />
    </>
  );
}
