import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, ArrowRight, Star, TrendingUp, Sparkles } from 'lucide-react';
import { productService } from '@/lib/productService';
import { Product } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';

const TABS = [
  { id: 'bestsellers', label: 'Best Sellers', icon: Star },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'new', label: 'New Arrivals', icon: Sparkles },
] as const;

type TabId = typeof TABS[number]['id'];

interface FeaturedProductCardProps {
  product: Product;
  whatsappNumber: string;
}

function FeaturedProductCard({ product, whatsappNumber }: FeaturedProductCardProps) {
  const { isAuthenticated } = useAuthStore();
  const message = encodeURIComponent(
    `Hi XL Traders, I'm interested in "${product.name}". Can you share bulk pricing?`
  );

  return (
    <article className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-red-200 transition-all duration-300 flex flex-col">
      {/* Product image */}
      <Link href={`/product/${product.id}`}>
        <div className="aspect-[4/3] bg-slate-100 overflow-hidden relative">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.image_alt_text || product.name}
              className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
              <span className="text-4xl opacity-20">📦</span>
            </div>
          )}
          {product.is_featured && (
            <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
              Featured
            </span>
          )}
        </div>
      </Link>

      {/* Card body */}
      <div className="p-4 flex flex-col flex-1">
        <Link href={`/product/${product.id}`}>
          <h3 className="font-bold text-slate-900 text-sm leading-tight line-clamp-2 hover:text-red-600 transition">
            {product.name}
          </h3>
        </Link>

        {/* Price / enquire */}
        <div className="mt-3 flex items-center justify-between">
          {isAuthenticated ? (
            <p className="text-base font-bold text-red-600">
              ₹{product.price?.toLocaleString()}
              <span className="text-xs text-slate-500 font-normal ml-1">/{product.unit_of_measure || 'pcs'}</span>
            </p>
          ) : (
            <Link href="/auth" className="text-xs text-slate-500 hover:text-red-600 transition">
              Sign in for price
            </Link>
          )}
          {product.quantity_in_unit && (
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              Pack of {product.quantity_in_unit}
            </span>
          )}
        </div>

        {/* CTA buttons */}
        <div className="mt-3 flex gap-2">
          <Link
            href={`/product/${product.id}`}
            className="flex-1 text-center text-xs font-semibold py-2 px-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Get Quote
          </Link>
          <a
            href={`https://wa.me/${whatsappNumber}?text=${message}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-9 h-9 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shrink-0"
            aria-label="WhatsApp"
          >
            <MessageCircle size={16} />
          </a>
        </div>
      </div>
    </article>
  );
}

interface HomeFeaturedProductsProps {
  whatsappNumber: string;
}

export default function HomeFeaturedProducts({ whatsappNumber }: HomeFeaturedProductsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('bestsellers');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const all = await productService.getAll();
        setProducts(all);
      } catch (error) {
        console.warn('Failed to load featured products:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Segment products by tab — simple heuristic since we don't have real tags
  const getTabProducts = (tab: TabId): Product[] => {
    if (!products.length) return [];
    const active = products.filter(p => p.is_active);
    if (tab === 'bestsellers') return active.filter(p => p.is_featured).slice(0, 8);
    if (tab === 'trending') return active.slice(0, 8);
    // new arrivals: last 8 by created_at if available, else last 8
    return [...active].reverse().slice(0, 8);
  };

  const shown = getTabProducts(activeTab);

  return (
    <section className="py-12 md:py-16 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-red-600 text-sm font-semibold uppercase tracking-wider mb-1">Our Products</p>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Featured Products</h2>
          </div>
          <Link href="/catalog" className="hidden sm:inline-flex items-center gap-1 text-red-600 font-semibold text-sm hover:text-red-700 transition">
            View full catalog <ArrowRight size={16} />
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                activeTab === id
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* Products grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white border border-slate-200 overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-slate-200" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : shown.length > 0 ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
            >
              {shown.map(product => (
                <FeaturedProductCard key={product.id} product={product} whatsappNumber={whatsappNumber} />
              ))}
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-4">Products loading from catalog...</p>
            <Link href="/catalog" className="inline-flex items-center gap-2 bg-red-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-red-700 transition">
              Browse Full Catalog <ArrowRight size={16} />
            </Link>
          </div>
        )}

        {/* Mobile view all */}
        <div className="text-center mt-8 sm:hidden">
          <Link href="/catalog" className="inline-flex items-center gap-2 text-red-600 font-semibold hover:text-red-700 transition">
            View full catalog <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
