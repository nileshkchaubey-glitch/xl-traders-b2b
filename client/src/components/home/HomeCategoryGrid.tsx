import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowRight, Package2, Coffee, ShoppingBag, Package, UtensilsCrossed, Layers, Wind, Utensils, Pizza, Printer } from 'lucide-react';
import { categoryService } from '@/lib/productService';
import { Category } from '@/lib/supabase';

const FALLBACK_ICONS = [Package2, Coffee, ShoppingBag, Package, UtensilsCrossed, Layers, Wind, Utensils, Pizza, Printer];

const GRADIENT_PAIRS = [
  ['from-red-50', 'to-orange-50'],
  ['from-blue-50', 'to-cyan-50'],
  ['from-green-50', 'to-emerald-50'],
  ['from-purple-50', 'to-pink-50'],
  ['from-amber-50', 'to-yellow-50'],
  ['from-teal-50', 'to-green-50'],
  ['from-indigo-50', 'to-blue-50'],
  ['from-rose-50', 'to-red-50'],
  ['from-sky-50', 'to-indigo-50'],
  ['from-lime-50', 'to-teal-50'],
];

const ICON_COLORS = [
  'text-red-400', 'text-blue-400', 'text-green-400', 'text-purple-400',
  'text-amber-400', 'text-teal-400', 'text-indigo-400', 'text-rose-400',
];

const CROP_POSITIONS = ['object-left-top', 'object-right-top', 'object-left-bottom', 'object-right-bottom'] as const;

interface CategoryCardProps {
  category: Category;
  index: number;
}

function CategoryCard({ category, index }: CategoryCardProps) {
  const Icon = FALLBACK_ICONS[index % FALLBACK_ICONS.length];
  const [gradFrom, gradTo] = GRADIENT_PAIRS[index % GRADIENT_PAIRS.length];
  const iconColor = ICON_COLORS[index % ICON_COLORS.length];
  const href = `/catalog?category=${category.slug}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.04 }}
    >
      <Link href={href}>
        <article className="group rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-xl hover:border-red-200 transition-all duration-300 cursor-pointer">
          {/* 2×2 thumbnail grid using the category image at 4 crop positions */}
          <div className="grid grid-cols-2 gap-0.5 bg-slate-100 p-0.5 rounded-t-2xl overflow-hidden">
            {CROP_POSITIONS.map((pos, qi) => (
              <div
                key={qi}
                className={`aspect-square overflow-hidden bg-gradient-to-br ${gradFrom} ${gradTo} relative flex items-center justify-center`}
              >
                {category.image_url && (
                  <img
                    src={category.image_url}
                    alt=""
                    className={`absolute inset-0 w-full h-full object-cover scale-[2.2] ${pos} transition duration-500 group-hover:scale-[2.4]`}
                    loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <Icon className={`relative z-10 w-5 h-5 ${iconColor} opacity-25`} />
              </div>
            ))}
          </div>

          {/* Card footer */}
          <div className="p-3 bg-white">
            <h3 className="font-bold text-slate-900 text-sm leading-tight group-hover:text-red-600 transition line-clamp-1">
              {category.name}
            </h3>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-slate-500">{category.group_name || 'Browse'}</p>
              <span className="text-red-600 opacity-0 group-hover:opacity-100 transition">
                <ArrowRight size={14} />
              </span>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}

function MobileCategoryCard({ category, index }: CategoryCardProps) {
  const Icon = FALLBACK_ICONS[index % FALLBACK_ICONS.length];
  const [gradFrom, gradTo] = GRADIENT_PAIRS[index % GRADIENT_PAIRS.length];
  const iconColor = ICON_COLORS[index % ICON_COLORS.length];

  return (
    <Link key={category.slug} href={`/catalog?category=${category.slug}`} className="snap-start shrink-0">
      <div className="w-24">
        <div className={`h-20 w-20 mx-auto rounded-2xl overflow-hidden bg-gradient-to-br ${gradFrom} ${gradTo} relative flex items-center justify-center`}>
          {category.image_url && (
            <img
              src={category.image_url}
              alt={category.name}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <Icon className={`relative z-10 w-8 h-8 ${iconColor} opacity-40`} />
        </div>
        <p className="text-[11px] font-semibold text-slate-700 mt-2 text-center leading-tight line-clamp-2">{category.name}</p>
      </div>
    </Link>
  );
}

export default function HomeCategoryGrid() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    categoryService.getAll().then(setCategories).catch(() => {});
  }, []);

  if (categories.length === 0) return null;

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
          {categories.map((cat, index) => (
            <MobileCategoryCard key={cat.id} category={cat} index={index} />
          ))}
        </div>

        {/* Desktop grid */}
        <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
          {categories.map((cat, index) => (
            <CategoryCard key={cat.id} category={cat} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
