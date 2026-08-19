import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Search as SearchIcon, X, Loader2 } from "lucide-react";

import ProductCard from "@/components/ProductCard";
import BackToTop from "@/components/storefront/BackToTop";
import SectionEyebrow from "@/components/SectionEyebrow";
import { Skeleton } from "@/components/ui/skeleton";

import { productService, categoryService } from "@/lib/productService";
import type { Product, Category } from "@/lib/supabase";

const WA_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";
const DEBOUNCE_MS = 250;

/**
 * The search route.
 *
 * A dedicated surface rather than a redirect into /catalog, because the two
 * answer different questions: the catalogue is for browsing a known section,
 * search is for "do you stock X". It keeps its own URL (`/search?q=…`) so a
 * result set is shareable and the back button behaves.
 *
 * Terms go through `productService.search`, which escapes them for PostgREST —
 * a comma used to return HTTP 400 and take the listing down.
 *
 * The empty state is a WhatsApp fallback, not a dead end: on a catalogue this
 * size "no match" usually means we stock it under another name.
 */
export default function Search() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const initial = new URLSearchParams(search).get("q") ?? "";

  const [term, setTerm] = useState(initial);
  const [results, setResults] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    categoryService
      .getLiveCategories()
      .then(c => setCategories(c.slice(0, 8)))
      .catch(() => {});
  }, []);

  // Debounced search. The URL is kept in step so the result set is shareable.
  useEffect(() => {
    const q = term.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await productService.search(q, 40);
        setResults(r);
        setSearched(true);
      } catch {
        setResults([]);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    const q = term.trim();
    const next = q ? `/search?q=${encodeURIComponent(q)}` : "/search";
    // replace, not push — typing must not fill the history stack.
    window.history.replaceState(null, "", next);
  }, [term]);

  const waHref = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    term.trim()
      ? `Hi XL Traders, do you stock: ${term.trim()}?`
      : "Hi XL Traders, I'm looking for a product."
  )}`;

  return (
    <>
      <main className="flex-1 pb-24 md:pb-10">
        <div className="xl-shell py-6">
          <h1 className="mb-4 text-2xl font-extrabold tracking-tight">
            Search
          </h1>

          <div className="relative mb-5">
            <SearchIcon
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={inputRef}
              value={term}
              onChange={e => setTerm(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Escape") setTerm("");
              }}
              placeholder="Search cups, containers, napkins, foil…"
              className="h-13 w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-11 text-body-md outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100"
            />
            {term && (
              <button
                onClick={() => setTerm("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-700"
              >
                <X size={17} />
              </button>
            )}
          </div>

          {/* Nothing typed — offer categories rather than a blank page. */}
          {!term.trim() && (
            <section>
              <SectionEyebrow>Browse instead</SectionEyebrow>
              <div className="mt-2 flex flex-wrap gap-2">
                {categories.map(c => (
                  <Link
                    key={c.id}
                    href={`/catalog?category=${c.id}`}
                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-body-sm font-semibold hover:border-red-300"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {loading && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-2xl border border-slate-200"
                >
                  <Skeleton className="aspect-[4/3] w-full" />
                  <div className="space-y-2 p-3">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-[52px] w-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && searched && results.length > 0 && (
            <>
              <div className="mb-3 text-body-sm text-slate-500">
                {results.length} result{results.length !== 1 ? "s" : ""} for
                <span className="font-bold text-slate-900">
                  {" "}
                  “{term.trim()}”
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                {results.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 4} />
                ))}
              </div>
            </>
          )}

          {!loading && searched && results.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <div className="mb-1.5 text-base font-bold">
                No match for “{term.trim()}”
              </div>
              <p className="mx-auto mb-4 max-w-sm text-body-sm text-slate-500">
                We stock more than the catalogue shows, and the same item often
                goes by another name. Ask and we’ll check.
              </p>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-body-sm font-bold text-white hover:bg-emerald-700"
              >
                Ask on WhatsApp
              </a>
              <div className="mt-3">
                <button
                  onClick={() => setLocation("/catalog")}
                  className="text-body-sm font-bold text-red-600"
                >
                  Browse the full catalogue →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <BackToTop />
    </>
  );
}
