import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Loader2, MessageCircle, SlidersHorizontal } from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import ActiveFilters from "@/components/catalog/ActiveFilters";
import CatalogFilterSheet from "@/components/catalog/CatalogFilterSheet";
import CatalogSidebar from "@/components/catalog/CatalogSidebar";
import CatalogToolbar, {
  CatalogView,
} from "@/components/catalog/CatalogToolbar";
import ProductGridSkeleton from "@/components/catalog/ProductGridSkeleton";
import { chipClass } from "@/components/catalog/chip";

import { useCatalogFilters } from "@/hooks/useCatalogFilters";
import { resolveCatalogQuery } from "@/lib/catalogQuery";
import { useAuthStore } from "@/lib/authStore";
import {
  categoryService,
  productService,
  CategoryGroup,
} from "@/lib/productService";
import { Category, Product } from "@/lib/supabase";

// A common multiple of the grid column counts (2 / 3 / 4 / 5) so pages fill
// evenly across breakpoints.
const PAGE_SIZE = 24;

const WA_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";

export default function Catalog() {
  const { isAuthenticated } = useAuthStore();
  const {
    selection,
    searchInput,
    setSearchInput,
    setCategory,
    setGroup,
    setBrand,
    setSort,
    clearAll,
    clearSearch,
  } = useCatalogFilters();

  const [categories, setCategories] = useState<Category[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [view, setView] = useState<CatalogView>("grid");
  const [sheetOpen, setSheetOpen] = useState(false);

  // ── Facets ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      // LIVE ONLY. categoryService.getAll() returns every ACTIVE category,
      // which is not the same thing: 17 of the 38 active categories have no
      // published+active products (verified live), so the mobile filter sheet
      // was offering 17 chips that each land on "No products found".
      // STOREFRONT_RULES 4.2 — the published-AND-active rule lives in
      // v_category_live_counts, in SQL, once.
      categoryService.getLiveCategories(),
      categoryService.getCategoriesGroupedByGroup(),
      // Already funnels through realBrands(), so 'Generic' — the null-brand
      // placeholder — never reaches this facet.
      productService.getBrands(),
    ])
      .then(([cats, grps, brnds]) => {
        if (cancelled) return;
        setCategories(cats);
        setGroups(grps);
        setBrands(brnds);
      })
      .catch(error => console.error("Error loading catalogue facets:", error))
      .finally(() => {
        if (!cancelled) setCategoriesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── What are we asking the database for? ──────────────────────────────────
  const resolved = resolveCatalogQuery(selection, categories, categoriesLoaded);

  // Key on CONTENT, not object identity. An unfiltered /catalog resolves to the
  // same empty filter set before and after the category list arrives, but a
  // fresh object each time made the product effect refire — a cold load fetched
  // the list and its count TWICE (measured: 5 product requests, of which 2 were
  // exact duplicates). Pre-existing; the old effect had `categories` in its
  // dependency array for the same reason.
  //
  // `filters` is built in a fixed key order by resolveCatalogQuery, so
  // stringifying it is a stable key rather than an accident of insertion order.
  const queryKey =
    resolved.status === "ready"
      ? `ready:${JSON.stringify(resolved.filters)}`
      : resolved.status === "unknown"
        ? `unknown:${resolved.what}`
        : "pending";

  // Deliberately keyed only on queryKey: it is a complete description of
  // `resolved`, so holding the first object for a given key is what makes the
  // identity stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const query = useMemo(() => resolved, [queryKey]);

  // ── Products ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (query.status === "pending") return;
    if (query.status === "unknown") {
      setProducts([]);
      setTotalCount(0);
      setIsLoading(false);
      return;
    }

    const { filters } = query;
    let cancelled = false;
    setIsLoading(true);
    setPage(1);

    Promise.all([
      productService.getAll({
        ...filters,
        sort: selection.sort,
        page: 1,
        pageSize: PAGE_SIZE,
      }),
      productService.countPublished(filters),
    ])
      .then(([rows, count]) => {
        if (cancelled) return;
        setProducts(rows);
        setTotalCount(count);
      })
      .catch(error => {
        if (cancelled) return;
        console.error("Error loading products:", error);
        setProducts([]);
        setTotalCount(0);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, selection.sort]);

  const handleLoadMore = async () => {
    if (isLoadingMore || query.status !== "ready") return;
    const nextPage = page + 1;
    setIsLoadingMore(true);
    try {
      const rows = await productService.getAll({
        ...query.filters,
        sort: selection.sort,
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      setProducts(prev => [...prev, ...rows]);
      setPage(nextPage);
    } catch (error) {
      console.error("Error loading more products:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // An unresolvable slug falls back to the raw URL value rather than through
  // to "All Products" — a heading of "All Products" over an empty list reads
  // as a broken page, and over a full one it would be an outright lie.
  const categoryName = selection.category
    ? (categories.find(c => c.slug === selection.category)?.name ??
      selection.category)
    : null;

  const heading =
    selection.group ||
    categoryName ||
    selection.brand ||
    (selection.search ? `"${selection.search}"` : null) ||
    "All Products";

  const activeCount = [
    selection.category,
    selection.group,
    selection.brand,
    selection.search,
  ].filter(Boolean).length;

  const waHref = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    selection.search
      ? `Hi XL Traders, do you stock "${selection.search}"?`
      : "Hi XL Traders, I couldn't find what I'm looking for on the site — can you help?"
  )}`;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />

      <main className="flex-1 pb-24 md:pb-0">
        <div className="container py-6">
          <div className="mb-3.5 text-body-sm text-slate-500">
            <Link href="/" className="transition hover:text-red-600">
              Home
            </Link>
            <span className="mx-1.5">/</span>
            <span className="font-semibold text-slate-900">{heading}</span>
          </div>

          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                {heading}
              </h1>
              <p className="mt-0.5 text-body-sm text-slate-500">
                {totalCount.toLocaleString()} products
              </p>
            </div>
            <CatalogToolbar
              className="hidden lg:flex"
              sort={selection.sort}
              onSortChange={setSort}
              view={view}
              onViewChange={setView}
              canSortByPrice={isAuthenticated}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            <aside className="hidden lg:block">
              <CatalogSidebar
                search={searchInput}
                onSearchChange={setSearchInput}
                categories={categories}
                groups={groups}
                brands={brands}
                selectedCategory={selection.category}
                selectedGroup={selection.group}
                selectedBrand={selection.brand}
                onCategoryChange={setCategory}
                onGroupChange={setGroup}
                onBrandChange={setBrand}
              />
            </aside>

            <div className="lg:col-span-3">
              {/* Mobile: Filters button + group chips. Sticky below the mobile
                  header (logo row + search = ~116px); z-20 sits under the
                  header (z-40) and above the cards. */}
              <div className="scrollbar-hide sticky top-[116px] z-20 mb-4 flex gap-2 overflow-x-auto bg-slate-50 py-1 lg:hidden">
                <button
                  onClick={() => setSheetOpen(true)}
                  className={`flex h-10 flex-shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-body-sm font-bold transition ${
                    activeCount
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-900"
                  }`}
                >
                  <SlidersHorizontal size={14} />
                  Filters{activeCount ? ` · ${activeCount}` : ""}
                </button>
                <button
                  onClick={() => setGroup(null)}
                  className={chipClass(!selection.category && !selection.group)}
                >
                  All
                </button>
                {groups.map(group => (
                  <button
                    key={group.group_name}
                    onClick={() => setGroup(group.group_name)}
                    className={chipClass(selection.group === group.group_name)}
                  >
                    {group.group_name}
                  </button>
                ))}
              </div>

              <ActiveFilters
                selection={selection}
                categories={categories}
                onClearCategory={() => setCategory(null)}
                onClearGroup={() => setGroup(null)}
                onClearBrand={() => setBrand(null)}
                onClearSearch={clearSearch}
                onClearAll={clearAll}
              />

              {isLoading ? (
                <ProductGridSkeleton />
              ) : products.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
                  <p className="text-lg text-slate-500">
                    {query.status === "unknown"
                      ? "We could not find that category"
                      : "No products found"}
                  </p>
                  <p className="mb-4 mt-2 text-sm text-slate-400">
                    {activeCount > 1
                      ? "Try removing one of the filters above — the catalogue is still being listed, so ask us if it is not here."
                      : "Try adjusting your filters or search query — the catalogue is still being listed, so ask us if it is not here."}
                  </p>
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-body-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    <MessageCircle size={14} />
                    Ask on WhatsApp
                  </a>
                </div>
              ) : (
                <>
                  <div
                    className={
                      view === "grid"
                        ? "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                        : "space-y-4"
                    }
                  >
                    {products.map(product => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        view={view}
                      />
                    ))}
                  </div>

                  <div className="mt-8 flex flex-col items-center gap-3">
                    <p className="text-sm text-slate-500">
                      Showing {products.length.toLocaleString()} of{" "}
                      {totalCount.toLocaleString()}
                    </p>
                    {products.length < totalCount && (
                      <button
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                      >
                        {isLoadingMore ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Loading...
                          </>
                        ) : (
                          "Load More"
                        )}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <CatalogFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        selection={selection}
        categories={categories}
        groups={groups}
        brands={brands}
        canSortByPrice={isAuthenticated}
        view={view}
        onViewChange={setView}
        onSortChange={setSort}
        onCategoryChange={setCategory}
        onBrandChange={setBrand}
        onClearAll={clearAll}
        totalCount={totalCount}
      />

      <Footer />
    </div>
  );
}
