import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  ChevronDown,
  Loader2,
  MessageCircle,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { useCategoryImages } from "@/hooks/useCategoryImages";
import {
  categoryService,
  productService,
  CategoryGroup,
  PublicProductFilters,
  PublicProductSort,
} from "@/lib/productService";
import { Category, Product } from "@/lib/supabase";

// Products fetched per page. A common multiple of the grid columns (2 / 4) so
// pages fill evenly across breakpoints.
const PAGE_SIZE = 24;

const SORT_OPTIONS: [PublicProductSort, string][] = [
  ["newest", "Newest"],
  ["name", "Name A–Z"],
  ["price-low", "Price: Low"],
  ["price-high", "Price: High"],
];

/**
 * Catalog — the same rate-card system as Home, at full length
 * (docs/DESIGN_SYSTEM.md §3.8).
 *
 * The grid/list view toggle is gone: the locked design defines exactly one
 * product form (the de-carded rate-card item), and a list variant would mean
 * inventing a second one. Sort, category, group and brand filtering are all
 * unchanged, as is the server-side pagination.
 */
export default function Catalog() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const params = new URLSearchParams(searchParams);
  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [brands, setBrands] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState<PublicProductSort>("newest");
  const [sheetOpen, setSheetOpen] = useState(false);
  const categoryImages = useCategoryImages();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    params.get("category") || null
  );
  const [selectedGroup, setSelectedGroup] = useState<string | null>(
    params.get("group") || null
  );
  const [selectedBrand, setSelectedBrand] = useState<string | null>(
    params.get("brand") || null
  );
  const [searchQuery, setSearchQuery] = useState(params.get("search") || "");

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [cats, brnds, groups] = await Promise.all([
          categoryService.getAll(),
          productService.getBrands(),
          categoryService.getCategoriesGroupedByGroup(),
        ]);
        setCategories(cats);
        setBrands(brnds);
        setCategoryGroups(groups);
      } catch (error) {
        console.error("Error loading categories/brands:", error);
      }
    };
    loadMeta();
  }, []);

  // Resolve the active UI selection into the server-side filter getAll/
  // countPublished understand. Sorting + pagination are applied on top of this;
  // this is only the "which products" part so the list and its count agree.
  const buildFilters = useCallback((): PublicProductFilters => {
    if (searchQuery) return { search: searchQuery };
    if (selectedBrand) return { brand: selectedBrand };
    if (selectedGroup) {
      const ids = categories
        .filter(c => c.group_name === selectedGroup)
        .map(c => c.id);
      return ids.length ? { categoryIds: ids } : {};
    }
    if (selectedCategory) {
      const cat = categories.find(c => c.slug === selectedCategory);
      return cat ? { categoryId: cat.id } : {};
    }
    return {};
  }, [searchQuery, selectedBrand, selectedGroup, selectedCategory, categories]);

  useEffect(() => {
    // A category/group filter needs the categories list to resolve its id/slug —
    // wait for it rather than briefly showing every product.
    if ((selectedCategory || selectedGroup) && categories.length === 0) return;

    let cancelled = false;
    const loadFirstPage = async () => {
      setIsLoading(true);
      setPage(1);
      const filters = buildFilters();
      try {
        const [rows, count] = await Promise.all([
          productService.getAll({
            ...filters,
            sort: sortBy,
            page: 1,
            pageSize: PAGE_SIZE,
          }),
          productService.countPublished(filters),
        ]);
        if (cancelled) return;
        setProducts(rows);
        setTotalCount(count);
      } catch (error) {
        if (cancelled) return;
        console.error("Error loading products:", error);
        setProducts([]);
        setTotalCount(0);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadFirstPage();
    return () => {
      cancelled = true;
    };
  }, [buildFilters, sortBy, selectedCategory, selectedGroup, categories]);

  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    const nextPage = page + 1;
    setIsLoadingMore(true);
    try {
      const rows = await productService.getAll({
        ...buildFilters(),
        sort: sortBy,
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

  const hasMore = products.length < totalCount;

  const handleCategoryChange = (slug: string | null) => {
    setSelectedCategory(slug);
    setSelectedGroup(null);
    setSelectedBrand(null);
    setSearchQuery("");
    setLocation(slug ? `/catalog?category=${slug}` : "/catalog");
  };

  const handleGroupChange = (groupName: string | null) => {
    setSelectedGroup(groupName);
    setSelectedCategory(null);
    setSelectedBrand(null);
    setSearchQuery("");
    setLocation(
      groupName ? `/catalog?group=${encodeURIComponent(groupName)}` : "/catalog"
    );
  };

  const handleBrandChange = (brand: string | null) => {
    setSelectedBrand(brand);
    setSelectedCategory(null);
    setSelectedGroup(null);
    setSearchQuery("");
    setLocation(
      brand ? `/catalog?brand=${encodeURIComponent(brand)}` : "/catalog"
    );
  };

  const isNothingSelected =
    !selectedCategory && !selectedGroup && !selectedBrand && !searchQuery;

  const activeFilterLabel =
    selectedGroup ||
    categories.find(c => c.slug === selectedCategory)?.name ||
    selectedBrand ||
    (searchQuery ? `“${searchQuery}”` : null);

  // One chip style, used by the sheet and the mobile group rail alike.
  const chip = (active: boolean) =>
    `flex-none h-9 px-3.5 text-body-sm font-medium border transition-colors duration-150 ${
      active
        ? "bg-ink text-white border-ink"
        : "bg-white text-ink-muted border-rule hover:border-ink"
    }`;

  const productGrid = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-[18px] gap-y-[26px] lg:gap-x-[30px] lg:gap-y-10">
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          categoryImageUrl={categoryImages[product.category_id]}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-white flex flex-col text-ink">
      <Header productCount={totalCount || undefined} />

      <main className="flex-1 pb-28 md:pb-24">
        <div className="shell pt-6 md:pt-8">
          {/* Breadcrumb */}
          <nav className="font-mono text-caption text-ink-faint">
            <Link
              href="/"
              className="hover:text-ink transition-colors duration-150"
            >
              Home
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-ink">
              {activeFilterLabel || "All products"}
            </span>
          </nav>

          {/* Title + count, on the same 2px rule the rate card uses */}
          <div className="flex items-baseline justify-between gap-4 border-t-2 border-ink mt-3 pt-[18px] md:pt-[26px]">
            <h1 className="font-display text-display md:text-display-lg font-bold tracking-[-0.03em]">
              {activeFilterLabel || "All products"}
            </h1>
            <span className="font-mono text-micro md:text-body-sm font-medium text-ink-faint whitespace-nowrap tabular-nums">
              {totalCount.toLocaleString("en-IN")} SKUs
            </span>
          </div>

          <div className="mt-5 md:mt-7 grid lg:grid-cols-[210px_1fr] lg:gap-x-[46px]">
            {/* ── Desktop sidebar — rules, no panel ── */}
            <aside className="hidden lg:block self-start sticky top-6">
              <div className="font-mono text-meta font-medium uppercase tracking-[0.16em] text-ink-faint">
                Categories
              </div>
              <div className="mt-3 flex flex-col">
                <button
                  onClick={() => handleCategoryChange(null)}
                  className={`text-left border-t border-rule py-2.5 text-body-sm transition-colors duration-150 ${
                    isNothingSelected
                      ? "text-red-600 font-semibold"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  All products
                </button>

                {categoryGroups.length > 0
                  ? categoryGroups.map(group => (
                      <div key={group.group_name} className="mt-3.5">
                        <button
                          onClick={() => handleGroupChange(group.group_name)}
                          className={`w-full text-left font-mono text-meta font-medium uppercase tracking-[0.14em] pb-1.5 transition-colors duration-150 ${
                            selectedGroup === group.group_name
                              ? "text-red-600"
                              : "text-ink-faint hover:text-ink"
                          }`}
                        >
                          {group.group_name}
                        </button>
                        {group.categories.map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => handleCategoryChange(cat.slug)}
                            className={`w-full text-left border-t border-rule py-2.5 text-body-sm transition-colors duration-150 ${
                              selectedCategory === cat.slug
                                ? "text-red-600 font-semibold"
                                : "text-ink-muted hover:text-ink"
                            }`}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    ))
                  : categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategoryChange(cat.slug)}
                        className={`text-left border-t border-rule py-2.5 text-body-sm transition-colors duration-150 ${
                          selectedCategory === cat.slug
                            ? "text-red-600 font-semibold"
                            : "text-ink-muted hover:text-ink"
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
              </div>

              {brands.length > 0 && (
                <>
                  <div className="font-mono text-meta font-medium uppercase tracking-[0.16em] text-ink-faint mt-7">
                    Brands
                  </div>
                  <div className="mt-3 flex flex-col">
                    {brands.map(brand => (
                      <button
                        key={brand}
                        onClick={() =>
                          handleBrandChange(
                            selectedBrand === brand ? null : brand
                          )
                        }
                        className={`text-left border-t border-rule py-2.5 text-body-sm transition-colors duration-150 ${
                          selectedBrand === brand
                            ? "text-red-600 font-semibold"
                            : "text-ink-muted hover:text-ink"
                        }`}
                      >
                        {brand}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </aside>

            <div className="min-w-0">
              {/* Desktop sort */}
              <div className="hidden lg:flex items-center justify-end mb-5">
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={e =>
                      setSortBy(e.target.value as PublicProductSort)
                    }
                    aria-label="Sort products"
                    className="appearance-none h-9 pl-3 pr-9 border border-rule text-body-sm font-medium bg-white outline-none focus:border-ink transition-colors duration-150"
                  >
                    {SORT_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        Sort: {label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={15}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-faint"
                  />
                </div>
              </div>

              {/* Mobile: Filters + group rail. Sticky so filtering stays
                  reachable while scrolling a long list. */}
              <div className="lg:hidden sticky top-0 z-20 bg-white flex gap-2 overflow-x-auto scrollbar-hide py-2 mb-3">
                <button
                  onClick={() => setSheetOpen(true)}
                  className={`${chip(!!activeFilterLabel)} flex items-center gap-1.5`}
                >
                  <SlidersHorizontal size={13} />
                  Filters{activeFilterLabel ? " · 1" : ""}
                </button>
                <button
                  onClick={() => handleGroupChange(null)}
                  className={chip(isNothingSelected)}
                >
                  All
                </button>
                {categoryGroups.map(group => (
                  <button
                    key={group.group_name}
                    onClick={() => handleGroupChange(group.group_name)}
                    className={`${chip(selectedGroup === group.group_name)} whitespace-nowrap`}
                  >
                    {group.group_name}
                  </button>
                ))}
              </div>

              {isLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-[18px] gap-y-[26px] lg:gap-x-[30px] lg:gap-y-10">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-9 md:h-12 bg-sunken" />
                      <div className="h-3 bg-sunken mt-3 w-3/4" />
                      <div className="h-0.5 bg-rule mt-3" />
                      <div className="h-6 bg-sunken mt-3 w-1/2" />
                      <div className="h-[38px] md:h-[46px] bg-sunken mt-4" />
                    </div>
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="border-t-2 border-ink pt-5">
                  <p className="text-body-md font-semibold">
                    No products found
                  </p>
                  <p className="text-body-sm text-ink-muted mt-1.5 mb-4 max-w-md">
                    Try a different filter — or we probably stock it and just
                    haven't listed it yet.
                  </p>
                  <a
                    href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                      searchQuery
                        ? `Hi XL Traders, do you stock "${searchQuery}"?`
                        : "Hi XL Traders, I couldn't find what I'm looking for on the site — can you help?"
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-wa text-white px-4 py-2.5 text-body-sm font-semibold"
                  >
                    <MessageCircle size={14} />
                    Ask on WhatsApp
                  </a>
                </div>
              ) : (
                <>
                  {productGrid}

                  <div className="border-t-2 border-ink mt-9 md:mt-11 pt-4 flex items-center justify-between gap-4">
                    <p className="font-mono text-caption md:text-micro text-ink-faint tabular-nums">
                      Showing {products.length.toLocaleString("en-IN")} of{" "}
                      {totalCount.toLocaleString("en-IN")}
                    </p>
                    {hasMore && (
                      <button
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                        className="inline-flex items-center gap-2 bg-ink text-white px-5 py-2.5 text-body-sm font-semibold hover:bg-red-600 transition-colors duration-150 disabled:opacity-60"
                      >
                        {isLoadingMore ? (
                          <>
                            <Loader2 size={15} className="animate-spin" />
                            Loading…
                          </>
                        ) : (
                          "Load more"
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

      {/* ── Mobile filter & sort sheet ── */}
      {sheetOpen && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 bg-ink/45 z-50"
            onClick={() => setSheetOpen(false)}
          />
          <div className="fixed bottom-0 inset-x-0 z-50 bg-white max-h-[80vh] overflow-auto border-t-2 border-ink animate-in slide-in-from-bottom duration-200">
            <div className="sticky top-0 bg-white px-[18px] py-3.5 border-b border-rule flex items-center justify-between">
              <span className="font-display text-body-md font-bold">
                Filters &amp; sort
              </span>
              <button
                onClick={() => setSheetOpen(false)}
                aria-label="Close filters"
                className="text-ink-faint"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-[18px] py-4 pb-24">
              <div className="font-mono text-meta font-medium uppercase tracking-[0.16em] text-ink-faint mb-2.5">
                Sort
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                {SORT_OPTIONS.map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setSortBy(value)}
                    className={chip(sortBy === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="font-mono text-meta font-medium uppercase tracking-[0.16em] text-ink-faint mb-2.5">
                Category
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => handleCategoryChange(null)}
                  className={chip(isNothingSelected)}
                >
                  All
                </button>
                {(selectedGroup && categoryGroups.length > 0
                  ? (categoryGroups.find(g => g.group_name === selectedGroup)
                      ?.categories ?? categories)
                  : categories
                ).map(cat => (
                  <button
                    key={cat.id}
                    onClick={() =>
                      handleCategoryChange(
                        selectedCategory === cat.slug ? null : cat.slug
                      )
                    }
                    className={chip(selectedCategory === cat.slug)}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {brands.length > 0 && (
                <>
                  <div className="font-mono text-meta font-medium uppercase tracking-[0.16em] text-ink-faint mb-2.5">
                    Brand
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {brands.map(brand => (
                      <button
                        key={brand}
                        onClick={() =>
                          handleBrandChange(
                            selectedBrand === brand ? null : brand
                          )
                        }
                        className={chip(selectedBrand === brand)}
                      >
                        {brand}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t-2 border-ink px-[18px] py-3">
              <button
                onClick={() => setSheetOpen(false)}
                className="w-full h-[46px] bg-red-600 text-white text-body-md font-semibold hover:bg-red-700 transition-colors duration-150"
              >
                Show {totalCount.toLocaleString("en-IN")} products
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
