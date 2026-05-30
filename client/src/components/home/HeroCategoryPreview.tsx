import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { POPULAR_CATEGORIES } from './heroConfig';
import { supabase } from '@/lib/supabase';

export default function HeroCategoryPreview() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadCounts = async () => {
      if (!import.meta.env.VITE_SUPABASE_URL) return;

      try {
        const { data: products } = await supabase
          .from('products')
          .select('category_id')
          .eq('is_active', true);

        const { data: categories } = await supabase
          .from('categories')
          .select('id, slug')
          .eq('is_active', true);

        if (!products?.length || !categories?.length) return;

        const slugById = Object.fromEntries(categories.map((c: { id: string; slug: string }) => [c.id, c.slug]));
        const tally: Record<string, number> = {};
        for (const p of products as { category_id: string }[]) {
          const slug = slugById[p.category_id];
          if (slug) tally[slug] = (tally[slug] || 0) + 1;
        }
        setCounts(tally);
      } catch {
        // use fallbacks
      }
    };
    loadCounts();
  }, []);

  const getCount = (slug: string, fallback?: number) => {
    const n = counts[slug];
    if (n && n > 0) return n;
    return fallback ?? 0;
  };

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-red-600 text-sm font-semibold uppercase tracking-wider mb-1">Shop by need</p>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Popular Categories</h2>
          </div>
          <Link
            href="/catalog"
            className="inline-flex items-center gap-1 text-red-600 font-semibold text-sm hover:text-red-700 transition"
          >
            View all products <ArrowRight size={16} />
          </Link>
        </div>

        {/* Mobile: horizontal scroll icons above fold style */}
        <div className="flex md:hidden gap-3 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
          {POPULAR_CATEGORIES.map((cat) => (
            <Link key={cat.name} href={`/catalog?category=${cat.slug}`} className="snap-start shrink-0">
              <div className="w-20 text-center">
                <div className="h-16 w-16 mx-auto rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                  <img src={cat.image} alt="" className="h-full w-full object-cover" />
                </div>
                <p className="text-[10px] font-semibold text-slate-700 mt-1.5 line-clamp-2 leading-tight">{cat.name}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {POPULAR_CATEGORIES.map((cat, index) => (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
            >
              <Link href={`/catalog?category=${cat.slug}`}>
                <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg hover:border-red-200 transition-all duration-300">
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src={cat.image}
                      alt={cat.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/10 to-transparent" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
                    <h3 className="font-bold text-white text-sm md:text-base leading-tight">{cat.name}</h3>
                    <p className="text-xs text-slate-200 mt-0.5">
                      {getCount(cat.slug, cat.fallbackCount)}+ products
                    </p>
                  </div>
                  <span className="absolute top-3 right-3 rounded-full bg-white/90 p-1.5 opacity-0 group-hover:opacity-100 transition shadow">
                    <ArrowRight size={14} className="text-red-600" />
                  </span>
                </article>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
