import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import {
  ArrowRight, Package2, Coffee, ShoppingBag, Package,
  UtensilsCrossed, Layers, Wind, Utensils, Pizza, Printer,
} from 'lucide-react';
import { categoryService, CategoryGroup } from '@/lib/productService';
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

// Prioritise categories that have an image, then fill up to 5.
function pickTop(cats: Category[], max = 5): Category[] {
  const withImg = cats.filter(c => c.image_url);
  const rest = cats.filter(c => !c.image_url);
  return [...withImg, ...rest].slice(0, max);
}

interface CardProps { category: Category; globalIndex: number; }

function DesktopCard({ category, globalIndex }: CardProps) {
  const Icon = FALLBACK_ICONS[globalIndex % FALLBACK_ICONS.length];
  const [gf, gt] = GRADIENT_PAIRS[globalIndex % GRADIENT_PAIRS.length];
  const ic = ICON_COLORS[globalIndex % ICON_COLORS.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: (globalIndex % 5) * 0.05 }}
      className="flex-shrink-0 w-44 xl:w-48"
    >
      <Link href={`/catalog?category=${category.slug}`}>
        <article className="group rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-xl hover:border-red-200 transition-all duration-300 cursor-pointer">
          {/* 2×2 thumbnail mosaic */}
          <div className="grid grid-cols-2 gap-0.5 bg-slate-100 p-0.5 rounded-t-2xl overflow-hidden">
            {CROP_POSITIONS.map((pos, qi) => (
              <div
                key={qi}
                className={`aspect-square overflow-hidden bg-gradient-to-br ${gf} ${gt} relative flex items-center justify-center`}
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
                <Icon className={`relative z-10 w-5 h-5 ${ic} opacity-25`} />
              </div>
            ))}
          </div>
          <div className="p-3 bg-white">
            <h4 className="font-bold text-slate-900 text-sm leading-tight group-hover:text-red-600 transition line-clamp-2">
              {category.name}
            </h4>
            <span className="text-red-600 opacity-0 group-hover:opacity-100 transition block mt-1">
              <ArrowRight size={13} />
            </span>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}

function MobileCard({ category, globalIndex }: CardProps) {
  const Icon = FALLBACK_ICONS[globalIndex % FALLBACK_ICONS.length];
  const [gf, gt] = GRADIENT_PAIRS[globalIndex % GRADIENT_PAIRS.length];
  const ic = ICON_COLORS[globalIndex % ICON_COLORS.length];

  return (
    <Link href={`/catalog?category=${category.slug}`} className="snap-start shrink-0">
      <div className="w-20">
        <div className={`h-16 w-16 mx-auto rounded-xl overflow-hidden bg-gradient-to-br ${gf} ${gt} relative flex items-center justify-center`}>
          {category.image_url && (
            <img
              src={category.image_url}
              alt={category.name}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <Icon className={`relative z-10 w-7 h-7 ${ic} opacity-40`} />
        </div>
        <p className="text-[10px] font-semibold text-slate-700 mt-1.5 text-center leading-tight line-clamp-2">{category.name}</p>
      </div>
    </Link>
  );
}

export default function HomeCategoryGrid() {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);

  useEffect(() => {
    categoryService
      .getCategoriesGroupedByGroup()
      .then(gs => setGroups(gs.filter(g => g.group_name !== 'Other')))
      .catch(() => {});
  }, []);

  if (groups.length === 0) return null;

  // Running index across all groups for stable gradient / icon assignment
  let globalIdx = 0;

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4">

        {/* Section header */}
        <div className="mb-10">
          <p className="text-red-600 text-xs font-bold uppercase tracking-widest mb-1">Our Range</p>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Browse by Category</h2>
          <p className="text-slate-500 text-sm mt-1">XL Traders wholesale collection</p>
        </div>

        {/* One section per group */}
        <div className="space-y-10 md:space-y-14">
          {groups.map((group) => {
            const cats = pickTop(group.categories);
            const groupHref = `/catalog?group=${encodeURIComponent(group.group_name)}`;
            const startIdx = globalIdx;
            globalIdx += cats.length;

            return (
              <div key={group.group_name}>
                {/* Group heading */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base md:text-lg font-bold text-slate-900">{group.group_name}</h3>
                  <Link
                    href={groupHref}
                    className="inline-flex items-center gap-1 text-red-600 text-xs font-semibold hover:text-red-700 transition shrink-0"
                  >
                    View all <ArrowRight size={13} />
                  </Link>
                </div>

                {/* Mobile: horizontal scroll strip */}
                <div className="flex md:hidden gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
                  {cats.map((cat, i) => (
                    <MobileCard key={cat.id} category={cat} globalIndex={startIdx + i} />
                  ))}
                </div>

                {/* Desktop: horizontal row (max 5, overflow scrollable on narrower viewports) */}
                <div className="hidden md:flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
                  {cats.map((cat, i) => (
                    <DesktopCard key={cat.id} category={cat} globalIndex={startIdx + i} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer link */}
        <div className="mt-10 text-center">
          <Link
            href="/catalog"
            className="inline-flex items-center gap-1.5 text-red-600 font-semibold text-sm hover:text-red-700 transition"
          >
            View entire catalog <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}
