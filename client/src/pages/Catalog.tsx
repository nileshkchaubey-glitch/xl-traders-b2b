import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  SlidersHorizontal,
} from "lucide-react";

import ProductCard from "@/components/ProductCard";
import ActiveFilters from "@/components/catalog/ActiveFilters";
import CatalogFilterSheet from "@/components/catalog/CatalogFilterSheet";
import CatalogCategoryRail from "@/components/catalog/CatalogCategoryRail";
import CatalogSidebar from "@/components/catalog/CatalogSidebar";
import CatalogToolbar, {
  CatalogView,
} from "@/components/catalog/CatalogToolbar";
import ProductGridSkeleton from "@/components/catalog/ProductGridSkeleton";

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
  const [, setLocation] = useLocation();
  const {
    selection,
    // `searchInput`/`setSearchInput` are no longer destructured: the sidebar
    // search box is gone (the header search writes the same `?search=` param)
    // and the filter sheet never had one. The hook keeps them — `clearSearch`
    // uses `setSearchInput`, and the debounce effect no-ops via its
    // `next === selection.search` guard when nothing drives the input.
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
  const filtersButtonRef = useRef<HTMLButtonElement>(null);

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

  // The sheet is opened from an `lg:hidden` button, but it renders in a portal
  // and would survive a resize past that breakpoint — as a bottom sheet on a
  // layout that already shows the sidebar, still holding a focus trap. Close it
  // on the crossing rather than trusting the viewport not to change.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const close = (e: MediaQueryListEvent) => e.matches && setSheetOpen(false);
    mq.addEventListener("change", close);
    return () => mq.removeEventListener("change", close);
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

  /** The prototype's mobile catalogue leads with a back arrow, not a
   *  breadcrumb. Opened from a link or the bottom nav there is nothing to go
   *  back to, so fall through to Home rather than leaving a dead control. */
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else setLocation("/");
  };

  const waHref = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    selection.search
      ? `Hi XL Traders, do you stock "${selection.search}"?`
      : "Hi XL Traders, I couldn't find what I'm looking for on the site — can you help?"
  )}`;

  return (
    <>
      <main className="flex-1 pb-24 md:pb-0">
        <div className="xl-shell py-6">
          {/* Prototype: 11.5px/600 #94a3b8 throughout, current page a shade
              darker. Same crumb as /account, so the two cannot drift. */}
          <nav
            aria-label="Breadcrumb"
            className="mb-3.5 hidden text-product-name font-semibold text-slate-400 lg:block"
          >
            <Link href="/" className="transition-colors hover:text-slate-600">
              Home
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-slate-500">{heading}</span>
          </nav>

          {/* The title bar, measured off the prototype at BOTH breakpoints,
              because they are laid out differently:

                mobile   one full-bleed row under a hairline —
                         ← back · title 15/800 over sub 10/500 · Filter pill
                desktop  no back arrow; title 24/800 on the SAME baseline as
                         the sub (12.5/500), toolbar pushed right

              One tree: the title block is a column that becomes a baseline row
              at lg, and the back arrow / hairline / full-bleed are lg:-reset.

              Type: 15 is exactly `--text-page-title`. Its `-lg` companion is
              22, but the catalogue's desktop title measures 24 — the "page
              title" role carries two desktop values across screens, so rather
              than mint a thirteenth token this uses stock `text-2xl`, which is
              exactly 24. Recorded, not smoothed over. */}
          <div className="-mx-4 mb-3.5 flex items-center gap-2.5 border-b border-slate-100 px-4 pb-2.5 sm:-mx-6 sm:px-6 lg:mx-0 lg:mb-5 lg:flex-wrap lg:items-end lg:justify-between lg:gap-4 lg:border-b-0 lg:px-0 lg:pb-0">
            <button
              type="button"
              onClick={goBack}
              aria-label="Go back"
              className="-ml-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-900 transition-colors hover:bg-slate-100 lg:hidden"
            >
              <ArrowLeft size={19} />
            </button>

            <div className="min-w-0 flex-1 lg:flex-none lg:flex lg:flex-wrap lg:items-baseline lg:gap-x-3 lg:gap-y-1">
              <h1 className="truncate text-page-title font-extrabold tracking-tight text-slate-900 lg:text-2xl">
                {heading}
              </h1>
              <p className="truncate text-meta-lg font-medium text-slate-400 lg:text-product-name-lg lg:text-slate-500">
                {totalCount.toLocaleString()} products
                {!isAuthenticated && " · rates after sign in"}
              </p>
            </div>

            {/* Prototype: a white bordered pill reading "Filter", with a red
                dot when anything is active — not a count. The actual filters
                are spelled out in the ActiveFilters chips right below it, so a
                number here would say less than the chips already do. */}
            <button
              ref={filtersButtonRef}
              onClick={() => setSheetOpen(true)}
              className="flex flex-shrink-0 items-center gap-[5px] rounded-full border border-slate-200 bg-white px-3 py-[7px] text-caption font-bold text-slate-700 transition-colors hover:border-slate-300 lg:hidden"
            >
              <SlidersHorizontal size={13} />
              Filter
              {activeCount > 0 && (
                <span
                  aria-label={`${activeCount} filters active`}
                  className="h-[7px] w-[7px] rounded-full bg-red-600"
                />
              )}
            </button>

            <CatalogToolbar
              className="hidden lg:flex"
              sort={selection.sort}
              onSortChange={setSort}
              view={view}
              onViewChange={setView}
              canSortByPrice={isAuthenticated}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[250px_1fr] lg:items-start">
            <aside className="hidden lg:block">
              <CatalogSidebar
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

            <div className="min-w-0">
              {/* C3: the horizontal group-chip row is GONE, replaced by the
                  vertical CatalogCategoryRail beside the grid (below). The
                  Filters button moves into the title row, where the prototype
                  puts it. Keeping both a chip row and a rail would be two
                  category pickers on one screen. */}

              <ActiveFilters
                selection={selection}
                categories={categories}
                onClearCategory={() => setCategory(null)}
                onClearGroup={() => setGroup(null)}
                onClearBrand={() => setBrand(null)}
                onClearSearch={clearSearch}
                onClearAll={clearAll}
              />

              {/* Rail + grid, side by side on mobile exactly as the prototype
                  lays them out. The negative margins let the rail meet the
                  page edge (it is a full-bleed column in the prototype) while
                  the page keeps its xl-shell padding. */}
              <div className="-mx-4 flex sm:-mx-6 lg:mx-0 lg:block">
                <CatalogCategoryRail
                  categories={categories}
                  selected={selection.category}
                  onSelect={setCategory}
                />
                <div className="min-w-0 flex-1 px-3 pt-2.5 lg:p-0">
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
                            ? "grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4 lg:gap-3.5"
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
          </div>
        </div>
      </main>

      <CatalogFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        triggerRef={filtersButtonRef}
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
    </>
  );
}
