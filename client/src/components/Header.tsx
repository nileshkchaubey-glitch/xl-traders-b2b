import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, Menu, X, LogOut, LogIn } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { Button } from "@/components/ui/button";
import { WHATSAPP_NUMBER, PHONE_1 } from "@/lib/contactConfig";

interface HeaderProps {
  variant?: "default" | "home";
}

export default function Header({ variant = "default" }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { isAuthenticated, isAdmin, user, signOut } = useAuthStore();
  const [location, setLocation] = useLocation();
  const isHome = variant === "home" || location === "/";

  const whatsappNumber = WHATSAPP_NUMBER;
  const phone1 = PHONE_1;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/catalog?search=${encodeURIComponent(searchQuery)}`);
      setSearchQuery("");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  return (
    <>
      {/* Top Info Bar — hidden on homepage (hero has delivery + search) */}
      {!isHome && (
        <div className="bg-slate-900 text-slate-300 text-xs py-1.5">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-6">
              <a
                href={`tel:${phone1}`}
                className="flex items-center gap-2 hover:text-red-500 transition"
              >
                <span className="inline-block w-1 h-1 bg-green-500 rounded-full"></span>
                📞 {phone1}
              </a>
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-red-500 transition"
              >
                <span className="inline-block w-1 h-1 bg-green-500 rounded-full"></span>
                💬 WhatsApp
              </a>
            </div>
            <span className="text-slate-400">Same-day Delivery in Surat</span>
          </div>
        </div>
      )}

      {/* Main Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 flex-shrink-0">
              <div className="text-2xl font-bold text-slate-900">
                <span className="text-red-600">XL</span> Traders
              </div>
              <div className="text-xs text-slate-500 border-l border-slate-200 pl-3">
                <div className="font-semibold">Packaging</div>
                <div>Surat, India</div>
              </div>
            </Link>

            {/* Search Box - Desktop */}
            <form
              onSubmit={handleSearch}
              className="hidden md:flex flex-1 max-w-sm mx-6"
            >
              <div className="flex w-full border border-slate-300 rounded-md overflow-hidden focus-within:border-red-600 focus-within:ring-2 focus-within:ring-red-100 transition">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-transparent outline-none"
                />
                <button
                  type="submit"
                  className="bg-red-600 text-white px-4 py-2 hover:bg-red-700 transition flex items-center gap-1"
                >
                  <Search size={16} />
                </button>
              </div>
            </form>

            {/* Right Actions */}
            <div className="flex items-center gap-2 md:gap-3">
              {/* Contact Buttons - Desktop (hidden on home — hero has CTAs) */}
              {!isHome && (
                <div className="hidden md:flex gap-2">
                  <a
                    href={`tel:${phone1}`}
                    className="px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200 transition"
                  >
                    📞 Call
                  </a>
                  <a
                    href={`https://wa.me/${whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 text-sm font-semibold text-white bg-green-600 rounded hover:bg-green-700 transition"
                  >
                    💬 WhatsApp
                  </a>
                </div>
              )}

              {/* Auth Buttons */}
              {isAuthenticated ? (
                <div className="hidden md:flex items-center gap-2">
                  {isAdmin && (
                    <Link href="/admin">
                      <Button variant="outline" size="sm">
                        Admin
                      </Button>
                    </Link>
                  )}
                  <span className="text-sm text-slate-600">{user?.email}</span>
                  <button
                    onClick={handleSignOut}
                    className="px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded hover:bg-slate-200 transition flex items-center gap-1"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link href="/auth" className="hidden md:block">
                  <Button variant="outline" size="sm">
                    <LogIn size={16} />
                    Sign In
                  </Button>
                </Link>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 hover:bg-slate-100 rounded transition"
              >
                {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          {/* Mobile Search */}
          <form onSubmit={handleSearch} className="md:hidden mt-3">
            <div className="flex border border-slate-300 rounded overflow-hidden focus-within:border-red-600">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-transparent outline-none"
              />
              <button
                type="submit"
                className="bg-red-600 text-white px-3 py-2 hover:bg-red-700 transition"
              >
                <Search size={16} />
              </button>
            </div>
          </form>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-slate-50">
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-3">
              <Link
                href="/catalog"
                className="block px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded transition"
              >
                Product Catalog
              </Link>
              <a
                href={`tel:${phone1}`}
                className="block px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded transition"
              >
                📞 Call: {phone1}
              </a>
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded transition"
              >
                💬 WhatsApp
              </a>
              {isAuthenticated ? (
                <>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="block px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded transition"
                    >
                      Admin Panel
                    </Link>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded transition"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  href="/auth"
                  className="block px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded transition"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Category Navigation */}
      <nav className="bg-white border-b border-slate-200 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 flex gap-6 overflow-x-auto">
          <Link
            href="/catalog"
            className="px-4 py-3 text-sm font-semibold text-slate-600 border-b-2 border-transparent hover:border-red-600 hover:text-red-600 transition whitespace-nowrap"
          >
            All Products
          </Link>
          <Link
            href="/catalog?category=round-container"
            className="px-4 py-3 text-sm font-semibold text-slate-600 border-b-2 border-transparent hover:border-red-600 hover:text-red-600 transition whitespace-nowrap"
          >
            🥤 Round Containers
          </Link>
          <Link
            href="/catalog?category=rectangle-container"
            className="px-4 py-3 text-sm font-semibold text-slate-600 border-b-2 border-transparent hover:border-red-600 hover:text-red-600 transition whitespace-nowrap"
          >
            📦 Rectangle Containers
          </Link>
          <Link
            href="/catalog?category=hinged-container"
            className="px-4 py-3 text-sm font-semibold text-slate-600 border-b-2 border-transparent hover:border-red-600 hover:text-red-600 transition whitespace-nowrap"
          >
            🔗 Hinged Containers
          </Link>
          <Link
            href="/catalog?category=aluminum-containers"
            className="px-4 py-3 text-sm font-semibold text-slate-600 border-b-2 border-transparent hover:border-red-600 hover:text-red-600 transition whitespace-nowrap"
          >
            🥫 Aluminum Containers
          </Link>
        </div>
      </nav>
    </>
  );
}
