import { useCallback, useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Grid3x3, List, ChevronDown, Package, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
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

      <main className="flex-1">
        {/* Page Header */}
        <div className="bg-white border-b border-slate-200 py-8">
          <div className="max-w-7xl mx-auto px-4">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Product Catalog
            </h1>
            <p className="text-slate-600">
              {totalCount.toLocaleString()} products
              {activeFilterLabel ? ` in ${activeFilterLabel}` : " available"}
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* ── Desktop Sidebar ── */}
            <aside className="hidden lg:block">
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden sticky top-24">
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
              {/* Controls Bar */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
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

              {/* ── Mobile Filters ── */}
              <div className="lg:hidden mb-4 space-y-3">
                {categoryGroups.length > 0 ? (
                  <>
                    {/* Group chips */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      <button
                        onClick={() => handleGroupChange(null)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                          !selectedGroup && !selectedCategory
                            ? "bg-red-600 text-white border-red-600"
                            : "bg-white text-slate-600 border-slate-300 hover:border-red-400"
                        }`}
                      >
                        All
                      </button>
                      {categoryGroups.map(group => (
                        <button
                          key={group.group_name}
                          onClick={() => handleGroupChange(group.group_name)}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                            selectedGroup === group.group_name
                              ? "bg-red-600 text-white border-red-600"
                              : "bg-white text-slate-600 border-slate-300 hover:border-red-400"
                          }`}
                        >
                          {group.group_name}
                        </button>
                      ))}
                    </div>
                    {/* Category dropdown (filtered by selected group) */}
                    <div className="relative">
                      <select
                        value={selectedCategory || ""}
                        onChange={e =>
                          handleCategoryChange(e.target.value || null)
                        }
                        className="w-full appearance-none px-4 py-2 pr-8 border border-slate-300 rounded bg-white cursor-pointer focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                      >
                        <option value="">All Categories</option>
                        {mobileCategoryOptions.map(cat => (
                          <option key={cat.id} value={cat.slug}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={16}
                        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600"
                      />
                    </div>
                  </>
                ) : (
                  // Flat fallback
                  <div className="relative">
                    <select
                      value={selectedCategory || ""}
                      onChange={e =>
                        handleCategoryChange(e.target.value || null)
                      }
                      className="w-full appearance-none px-4 py-2 pr-8 border border-slate-300 rounded bg-white cursor-pointer focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                    >
                      <option value="">All Categories</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.slug}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600"
                    />
                  </div>
                )}

                {/* Brand chips */}
                {brands.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    <button
                      onClick={() => handleBrandChange(null)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                        !selectedBrand
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-white text-slate-600 border-slate-300 hover:border-red-400"
                      }`}
                    >
                      All Brands
                    </button>
                    {brands.map(brand => (
                      <button
                        key={brand}
                        onClick={() => handleBrandChange(brand)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                          selectedBrand === brand
                            ? "bg-red-600 text-white border-red-600"
                            : "bg-white text-slate-600 border-slate-300 hover:border-red-400"
                        }`}
                      >
                        {brand}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Products Grid/List */}
              {isLoading ? (
                <div className="text-center py-12">
                  <p className="text-slate-500">Loading products...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
                  <p className="text-slate-500 text-lg">No products found</p>
                  <p className="text-slate-400 text-sm mt-2">
                    Try adjusting your filters or search query
                  </p>
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

      <Footer />
    </div>
  );
}
