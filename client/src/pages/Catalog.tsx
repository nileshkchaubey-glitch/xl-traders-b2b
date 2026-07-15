import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  Grid3x3,
  List,
  ChevronDown,
  Package,
  Loader2,
  SlidersHorizontal,
  MessageCircle,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  categoryService,
  productService,
  CategoryGroup,
  PublicProductFilters,
  PublicProductSort,
} from "@/lib/productService";
import { Category, Product } from "@/lib/supabase";

// Products fetched per page. Chosen as a common multiple of the grid columns
// (2 / 3 / 4 / 5) so pages fill evenly across breakpoints.
const PAGE_SIZE = 24;

// Icon shown next to each category in the 2-level sidebar
function CategoryIcon({ cat }: { cat: Category }) {
  if (cat.image_url) {
    return (
      <img
        src={cat.image_url}
        alt={cat.name}
        className="h-5 w-5 rounded object-cover flex-shrink-0"
      />
    );
  }
  if (cat.icon_emoji) {
    return (
      <span className="text-base leading-none flex-shrink-0">
        {cat.icon_emoji}
      </span>
    );
  }
  return <Package size={14} className="flex-shrink-0 text-slate-400" />;
}

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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<PublicProductSort>("newest");
  const [sheetOpen, setSheetOpen] = useState(false);

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

  // Load categories, groups, brands
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
      // No categories in the group yet → fall back to all products (old behaviour).
      return ids.length ? { categoryIds: ids } : {};
    }
    if (selectedCategory) {
      const cat = categories.find(c => c.slug === selectedCategory);
      return cat ? { categoryId: cat.id } : {};
    }
    return {};
  }, [searchQuery, selectedBrand, selectedGroup, selectedCategory, categories]);

  // Load (or reload) the first page whenever the filters or sort change. Fetches
  // one page + the matching total in parallel; sort/pagination happen server-side
  // so the browser never pulls the whole catalogue.
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

  // "Load More" — append the next page to the already-loaded list.
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
    setLocation(slug ? `/catalog?category=${slug}` : "/catalog");
  };

  const handleGroupChange = (groupName: string | null) => {
    setSelectedGroup(groupName);
    setSelectedCategory(null);
    setSelectedBrand(null);
    setLocation(
      groupName ? `/catalog?group=${encodeURIComponent(groupName)}` : "/catalog"
    );
  };

  const handleBrandChange = (brand: string | null) => {
    setSelectedBrand(brand);
    setSelectedCategory(null);
    setSelectedGroup(null);
    setLocation(
      brand ? `/catalog?brand=${encodeURIComponent(brand)}` : "/catalog"
    );
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setLocation(
      query ? `/catalog?search=${encodeURIComponent(query)}` : "/catalog"
    );
  };

  const isNothingSelected =
    !selectedCategory && !selectedGroup && !selectedBrand && !searchQuery;

  // Readable label for the active filter
  const activeFilterLabel =
    selectedGroup ||
    categories.find(c => c.slug === selectedCategory)?.name ||
    selectedBrand ||
    null;

  // Mobile: categories filtered by selected group (or all)
  const mobileCategoryOptions =
    selectedGroup && categoryGroups.length > 0
      ? (categoryGroups.find(g => g.group_name === selectedGroup)?.categories ??
        categories)
      : categories;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 pb-24 md:pb-0">
        <div className="container py-6">
          {/* Breadcrumb */}
          <div className="text-body-sm text-slate-500 mb-3.5">
            <Link href="/" className="hover:text-red-600 transition">
              Home
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-slate-900 font-semibold">
              {activeFilterLabel || "All Products"}
            </span>
          </div>

          {/* Title + controls */}
          <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                {activeFilterLabel || "All Products"}
              </h1>
              <p className="text-body-sm text-slate-500 mt-0.5">
                {totalCount.toLocaleString()} products
              </p>
            </div>
            <div className="hidden lg:flex items-center gap-2.5">
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as PublicProductSort)}
                  className="appearance-none h-10 pl-3 pr-8 border border-slate-200 rounded-lg text-body-sm font-semibold bg-white cursor-pointer outline-none"
                >
                  <option value="newest">Sort: Newest</option>
                  <option value="name">Name (A–Z)</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>
                <ChevronDown
                  size={15}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"
                />
              </div>
              <div className="flex border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                  className={`w-10 h-10 flex items-center justify-center transition ${
                    viewMode === "grid"
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Grid3x3 size={16} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                  className={`w-10 h-10 flex items-center justify-center transition ${
                    viewMode === "list"
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* ── Desktop Sidebar ── */}
            <aside className="hidden lg:block">
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden sticky top-24">
                {/* Search */}
                <div className="p-4 border-b border-slate-200">
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                  />
                </div>

                {/* Categories — 2-level grouped or flat fallback */}
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                  <h3 className="font-bold text-sm text-slate-900 mb-3">
                    Categories
                  </h3>
                  <div className="space-y-0.5">
                    {/* All Products */}
                    <button
                      onClick={() => handleCategoryChange(null)}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                        isNothingSelected
                          ? "bg-red-100 text-red-600 font-semibold"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      All Products
                    </button>

                    {categoryGroups.length > 0
                      ? // ── 2-level grouped view ──
                        categoryGroups.map(group => {
                          const isGroupActive =
                            selectedGroup === group.group_name;
                          const hasActiveCatInGroup = group.categories.some(
                            c => c.slug === selectedCategory
                          );
                          return (
                            <div key={group.group_name} className="mt-3">
                              {/* Group header */}
                              <button
                                onClick={() =>
                                  handleGroupChange(group.group_name)
                                }
                                className={`w-full text-left px-3 py-2 rounded text-xs font-bold uppercase tracking-wider transition ${
                                  isGroupActive
                                    ? "bg-red-600 text-white"
                                    : hasActiveCatInGroup
                                      ? "text-red-600"
                                      : "text-slate-500 hover:bg-slate-100"
                                }`}
                              >
                                {group.group_name}
                              </button>
                              {/* Category items */}
                              <div className="ml-1 mt-0.5 space-y-0.5">
                                {group.categories.map(cat => (
                                  <button
                                    key={cat.id}
                                    onClick={() =>
                                      handleCategoryChange(cat.slug)
                                    }
                                    className={`w-full text-left px-3 py-1.5 rounded text-sm transition flex items-center gap-2 ${
                                      selectedCategory === cat.slug
                                        ? "bg-red-100 text-red-600 font-semibold"
                                        : "text-slate-600 hover:bg-slate-100"
                                    }`}
                                  >
                                    <CategoryIcon cat={cat} />
                                    <span className="truncate">{cat.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      : // ── Flat fallback (no groups yet) ──
                        categories.map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => handleCategoryChange(cat.slug)}
                            className={`w-full text-left px-3 py-2 rounded text-sm transition flex items-center gap-2 ${
                              selectedCategory === cat.slug
                                ? "bg-red-100 text-red-600 font-semibold"
                                : "text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            <CategoryIcon cat={cat} />
                            <span>{cat.name}</span>
                          </button>
                        ))}
                  </div>
                </div>

                {/* Brands */}
                {brands.length > 0 && (
                  <div className="p-4 border-t border-slate-200">
                    <h3 className="font-bold text-sm text-slate-900 mb-3">
                      Brands
                    </h3>
                    <div className="space-y-0.5">
                      {brands.map(brand => (
                        <button
                          key={brand}
                          onClick={() =>
                            handleBrandChange(
                              selectedBrand === brand ? null : brand
                            )
                          }
                          className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                            selectedBrand === brand
                              ? "bg-red-100 text-red-600 font-semibold"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {brand}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* ── Main Content ── */}
            <div className="lg:col-span-3">
              {/* Controls Bar — mobile/tablet only; desktop controls sit in the title row */}
              <div className="lg:hidden bg-white border border-slate-200 rounded-lg p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode("grid")}
                    aria-label="Grid view"
                    className={`p-2 rounded transition ${
                      viewMode === "grid"
                        ? "bg-red-100 text-red-600"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Grid3x3 size={20} />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    aria-label="List view"
                    className={`p-2 rounded transition ${
                      viewMode === "list"
                        ? "bg-red-100 text-red-600"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <List size={20} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-slate-600">
                    Sort:
                  </label>
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={e =>
                        setSortBy(e.target.value as PublicProductSort)
                      }
                      className="appearance-none px-3 py-2 pr-8 border border-slate-300 rounded text-sm bg-white cursor-pointer focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                    >
                      <option value="newest">Newest</option>
                      <option value="name">Name (A-Z)</option>
                      <option value="price-low">Price (Low to High)</option>
                      <option value="price-high">Price (High to Low)</option>
                    </select>
                    <ChevronDown
                      size={16}
                      className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600"
                    />
                  </div>
                </div>
              </div>

              {/* ── Mobile: Filters button + quick group chips (bottom sheet holds
                  the rest). Sticky below the mobile header (logo row + search =
                  ~116px) so filtering stays reachable while scrolling a long
                  list; z-20 sits under the header (z-40) and above the cards. ── */}
              <div className="lg:hidden mb-4 flex gap-2 overflow-x-auto py-1 scrollbar-hide sticky top-[116px] z-20 bg-slate-50">
                <button
                  onClick={() => setSheetOpen(true)}
                  className={`flex-shrink-0 flex items-center gap-1.5 h-10 px-3.5 rounded-full text-body-sm font-bold border-[1.5px] transition ${
                    activeFilterLabel
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-900 border-slate-200"
                  }`}
                >
                  <SlidersHorizontal size={14} />
                  Filters{activeFilterLabel ? " · 1" : ""}
                </button>
                <button
                  onClick={() => handleGroupChange(null)}
                  className={`flex-shrink-0 h-10 px-3.5 rounded-full text-body-sm font-semibold border-[1.5px] transition ${
                    isNothingSelected
                      ? "bg-red-50 text-red-600 border-red-600"
                      : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  All
                </button>
                {categoryGroups.map(group => (
                  <button
                    key={group.group_name}
                    onClick={() => handleGroupChange(group.group_name)}
                    className={`flex-shrink-0 h-10 px-3.5 rounded-full text-body-sm font-semibold border-[1.5px] transition ${
                      selectedGroup === group.group_name
                        ? "bg-red-50 text-red-600 border-red-600"
                        : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    {group.group_name}
                  </button>
                ))}
              </div>

              {/* Products Grid/List */}
              {isLoading ? (
                // Skeleton grid matching the ProductCard footprint (image +
                // brand line + name + price + button) so the page doesn't
                // jump when real cards replace it.
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
                    >
                      <Skeleton className="aspect-square rounded-none" />
                      <div className="p-3 space-y-2">
                        <Skeleton className="h-3 w-1/3" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-9 w-full rounded-lg" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
                  <p className="text-slate-500 text-lg">No products found</p>
                  <p className="text-slate-400 text-sm mt-2 mb-4">
                    Try adjusting your filters or search query — or we
                    probably stock it and just haven't listed it yet.
                  </p>
                  <a
                    href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                      searchQuery
                        ? `Hi XL Traders, do you stock "${searchQuery}"?`
                        : "Hi XL Traders, I couldn't find what I'm looking for on the site — can you help?"
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-body-sm font-semibold hover:bg-emerald-700 transition"
                  >
                    <MessageCircle size={14} />
                    Ask on WhatsApp
                  </a>
                </div>
              ) : (
                <>
                  <div
                    className={
                      viewMode === "grid"
                        ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4"
                        : "space-y-4"
                    }
                  >
                    {products.map(product => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        view={viewMode}
                      />
                    ))}
                  </div>

                  {/* Load More / end-of-list */}
                  <div className="mt-8 flex flex-col items-center gap-3">
                    <p className="text-sm text-slate-500">
                      Showing {products.length.toLocaleString()} of{" "}
                      {totalCount.toLocaleString()}
                    </p>
                    {hasMore && (
                      <button
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition disabled:opacity-60"
                      >
                        {isLoadingMore ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Loading…
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

      {/* ── Mobile filter & sort bottom sheet (prototype) ── */}
      {sheetOpen && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/45 z-50"
            onClick={() => setSheetOpen(false)}
          />
          <div className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-[20px] max-h-[75vh] overflow-auto animate-in slide-in-from-bottom duration-300">
            <div className="sticky top-0 bg-white px-5 pt-3.5 pb-2.5 border-b border-slate-100 flex items-center justify-between">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-9 h-1 bg-slate-200 rounded-full" />
              <span className="text-body-md font-extrabold mt-1.5">
                Filters &amp; Sort
              </span>
              <button
                onClick={() => {
                  handleCategoryChange(null);
                  setSortBy("newest");
                }}
                className="text-body-sm font-bold text-red-600 mt-1.5"
              >
                Clear all
              </button>
            </div>

            <div className="px-5 py-4 pb-24">
              {/* Sort */}
              <div className="text-caption font-bold tracking-widest uppercase text-slate-400 mb-2.5">
                Sort
              </div>
              <div className="flex flex-wrap gap-2 mb-5">
                {(
                  [
                    ["newest", "Newest"],
                    ["name", "Name A–Z"],
                    ["price-low", "Price: Low"],
                    ["price-high", "Price: High"],
                  ] as [PublicProductSort, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setSortBy(value)}
                    className={`h-10 px-3.5 rounded-full text-body-sm font-semibold border-[1.5px] transition ${
                      sortBy === value
                        ? "bg-red-50 text-red-600 border-red-600"
                        : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Categories */}
              <div className="text-caption font-bold tracking-widest uppercase text-slate-400 mb-2.5">
                Category
              </div>
              <div className="flex flex-wrap gap-2 mb-5">
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
                    className={`h-10 px-3.5 rounded-full text-body-sm font-semibold border-[1.5px] transition ${
                      selectedCategory === cat.slug
                        ? "bg-red-50 text-red-600 border-red-600"
                        : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Brands */}
              {brands.length > 0 && (
                <>
                  <div className="text-caption font-bold tracking-widest uppercase text-slate-400 mb-2.5">
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
                        className={`h-10 px-3.5 rounded-full text-body-sm font-semibold border-[1.5px] transition ${
                          selectedBrand === brand
                            ? "bg-red-50 text-red-600 border-red-600"
                            : "bg-white text-slate-600 border-slate-200"
                        }`}
                      >
                        {brand}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3">
              <button
                onClick={() => setSheetOpen(false)}
                className="w-full h-[50px] bg-red-600 text-white rounded-xl text-body-md font-extrabold hover:bg-red-700 transition"
              >
                Show {totalCount.toLocaleString()} products
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
