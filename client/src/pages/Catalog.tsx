import { useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Grid3x3, List, ChevronDown } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { categoryService, productService } from '@/lib/productService';
import { Category, Product } from '@/lib/supabase';

export default function Catalog() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const params = new URLSearchParams(searchParams);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    params.get('category') || null
  );
  const [selectedBrand, setSelectedBrand] = useState<string | null>(
    params.get('brand') || null
  );
  const [searchQuery, setSearchQuery] = useState(params.get('search') || '');

  // Load categories + brands
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [cats, brnds] = await Promise.all([
          categoryService.getAll(),
          productService.getBrands(),
        ]);
        setCategories(cats);
        setBrands(brnds);
      } catch (error) {
        console.error('Error loading categories/brands:', error);
      }
    };
    loadMeta();
  }, []);

  // Load products based on filters
  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      try {
        let products: Product[] = [];

        if (searchQuery) {
          products = await productService.search(searchQuery);
        } else if (selectedBrand) {
          products = await productService.getAll({ brand: selectedBrand });
        } else if (selectedCategory) {
          const category = categories.find((c) => c.slug === selectedCategory);
          if (category) {
            products = await productService.getAll({ categoryId: category.id });
          }
        } else {
          products = await productService.getAll();
        }

        // Sort
        switch (sortBy) {
          case 'price-low':
            products.sort((a, b) => a.price - b.price);
            break;
          case 'price-high':
            products.sort((a, b) => b.price - a.price);
            break;
          case 'name':
            products.sort((a, b) => a.name.localeCompare(b.name));
            break;
          case 'newest':
          default:
            products.sort(
              (a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
        }

        setProducts(products);
      } catch (error) {
        console.error('Error loading products:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, [selectedCategory, selectedBrand, searchQuery, sortBy, categories]);

  const handleCategoryChange = (slug: string | null) => {
    setSelectedCategory(slug);
    setSelectedBrand(null);
    setLocation(slug ? `/catalog?category=${slug}` : '/catalog');
  };

  const handleBrandChange = (brand: string | null) => {
    setSelectedBrand(brand);
    setSelectedCategory(null);
    setLocation(brand ? `/catalog?brand=${encodeURIComponent(brand)}` : '/catalog');
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setLocation(query ? `/catalog?search=${encodeURIComponent(query)}` : '/catalog');
  };

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
              {products.length} products available
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar - Desktop */}
            <aside className="hidden lg:block">
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden sticky top-24">
                {/* Search */}
                <div className="p-4 border-b border-slate-200">
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                  />
                </div>

                {/* Categories */}
                <div className="p-4">
                  <h3 className="font-bold text-sm text-slate-900 mb-3">Categories</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => handleCategoryChange(null)}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                        !selectedCategory && !selectedBrand
                          ? 'bg-red-100 text-red-600 font-semibold'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      All Products
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategoryChange(cat.slug)}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                          selectedCategory === cat.slug
                            ? 'bg-red-100 text-red-600 font-semibold'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Brands */}
                {brands.length > 0 && (
                  <div className="p-4 border-t border-slate-200">
                    <h3 className="font-bold text-sm text-slate-900 mb-3">Brands</h3>
                    <div className="space-y-2">
                      {brands.map((brand) => (
                        <button
                          key={brand}
                          onClick={() => handleBrandChange(selectedBrand === brand ? null : brand)}
                          className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                            selectedBrand === brand
                              ? 'bg-red-100 text-red-600 font-semibold'
                              : 'text-slate-600 hover:bg-slate-100'
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

            {/* Main Content */}
            <div className="lg:col-span-3">
              {/* Controls Bar */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded transition ${
                      viewMode === 'grid'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Grid3x3 size={20} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded transition ${
                      viewMode === 'list'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <List size={20} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-slate-600">Sort:</label>
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="appearance-none px-3 py-2 pr-8 border border-slate-300 rounded text-sm bg-white cursor-pointer focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                    >
                      <option value="newest">Newest</option>
                      <option value="name">Name (A-Z)</option>
                      <option value="price-low">Price (Low to High)</option>
                      <option value="price-high">Price (High to Low)</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600" />
                  </div>
                </div>
              </div>

              {/* Mobile Filters */}
              <div className="lg:hidden mb-4 space-y-3">
                {/* Category select */}
                <div className="relative">
                  <select
                    value={selectedCategory || ''}
                    onChange={(e) => handleCategoryChange(e.target.value || null)}
                    className="w-full appearance-none px-4 py-2 pr-8 border border-slate-300 rounded bg-white cursor-pointer focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.slug}>{cat.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600" />
                </div>

                {/* Brand filter chips (mobile) */}
                {brands.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    <button
                      onClick={() => handleBrandChange(null)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                        !selectedBrand
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-red-400'
                      }`}
                    >
                      All Brands
                    </button>
                    {brands.map((brand) => (
                      <button
                        key={brand}
                        onClick={() => handleBrandChange(brand)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                          selectedBrand === brand
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-red-400'
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
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3'
                      : 'space-y-4'
                  }
                >
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      view={viewMode}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
