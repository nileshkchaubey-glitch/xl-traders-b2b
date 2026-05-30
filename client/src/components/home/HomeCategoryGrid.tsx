import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowRight, Package2, Coffee, ShoppingBag, Package, UtensilsCrossed, Layers, Wind, Utensils, Pizza, Printer } from 'lucide-react';
import { CATEGORY_CARDS } from './heroConfig';

// Fallback icon per category index
const FALLBACK_ICONS = [Package2, Coffee, ShoppingBag, Package, UtensilsCrossed, Layers, Wind, Utensils, Pizza, Printer];

// The 2×2 grid shows the same cover image at 4 different crop positions
// giving a "multiple product" look without needing 4 separate URLs.
const CROP_POSITIONS = ['object-left-top', 'object-right-top', 'object-left-bottom', 'object-right-bottom'] as const;

export default function HomeCategoryGrid() {
  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-red-600 text-sm font-semibold uppercase tracking-wider mb-1">Shop by Category</p>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Popular Categories</h2>
            <p className="text-slate-500 text-sm mt-1">Browse our wide range of wholesale packaging solutions</p>
          </div>
          <Link
            href="/catalog"
            className="inline-flex items-center gap-1 text-red-600 font-semibold text-sm hover:text-red-700 transition shrink-0"
          >
            View all products <ArrowRight size={16} />
          </Link>
        </div>

        {/* Mobile horizontal scroll */}
        <div className="flex md:hidden gap-3 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
          {CATEGORY_CARDS.map((cat, index) => {
            const Icon = FALLBACK_ICONS[index % FALLBACK_ICONS.length];
            return (
              <Link key={cat.slug} href={`/catalog?category=${cat.slug}`} className="snap-start shrink-0">
                <div className="w-24">
                  <div className={`h-20 w-20 mx-auto rounded-2xl overflow-hidden bg-gradient-to-br ${cat.gradientFrom} ${cat.gradientTo} relative flex items-center justify-center`}>
                    <img
                      src={cat.coverImage}
                      alt={cat.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                    <Icon className={`relative z-10 w-8 h-8 ${cat.iconColor} opacity-40`} />
                  </div>
                  <p className="text-[11px] font-semibold text-slate-700 mt-2 text-center leading-tight line-clamp-2">{cat.name}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Desktop grid - 5 cols on large, 4 on medium */}
        <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
          {CATEGORY_CARDS.map((cat, index) => {
            const Icon = FALLBACK_ICONS[index % FALLBACK_ICONS.length];
            return (
              <motion.div
                key={cat.slug}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.04 }}
              >
                <Link href={`/catalog?category=${cat.slug}`}>
                  <article className="group rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-xl hover:border-red-200 transition-all duration-300 cursor-pointer">
                    {/* 2×2 product thumbnail grid */}
                    <div className="grid grid-cols-2 gap-0.5 bg-slate-100 p-0.5 rounded-t-2xl overflow-hidden">
                      {CROP_POSITIONS.map((pos, qi) => (
                        <div
                          key={qi}
                          className={`aspect-square overflow-hidden bg-gradient-to-br ${cat.gradientFrom} ${cat.gradientTo} relative flex items-center justify-center`}
                        >
                          <img
                            src={cat.coverImage}
                            alt=""
                            className={`absolute inset-0 w-full h-full object-cover scale-[2.2] ${pos} transition duration-500 group-hover:scale-[2.4]`}
                            loading="lazy"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                          <Icon className={`relative z-10 w-5 h-5 ${cat.iconColor} opacity-25`} />
                        </div>
                      ))}
                    </div>

                    {/* Card footer */}
                    <div className="p-3 bg-white">
                      <h3 className="font-bold text-slate-900 text-sm leading-tight group-hover:text-red-600 transition line-clamp-1">
                        {cat.name}
                      </h3>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-slate-500">{cat.count}+ products</p>
                        <span className="text-red-600 opacity-0 group-hover:opacity-100 transition">
                          <ArrowRight size={14} />
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
