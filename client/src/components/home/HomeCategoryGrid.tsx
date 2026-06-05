import { useState, useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import {
  ArrowRight, Package2, Coffee, ShoppingBag, Package,
  UtensilsCrossed, Layers, Wind, Utensils, Pizza, Printer,
} from 'lucide-react';
import { categoryService } from '@/lib/productService';
import { Category } from '@/lib/supabase';

// ─── Visual constants ────────────────────────────────────────────────────────

const FALLBACK_ICONS = [
  Package2, Coffee, ShoppingBag, Package,
  UtensilsCrossed, Layers, Wind, Utensils, Pizza, Printer,
];

const GRADIENT_PAIRS = [
  ['from-red-50',    'to-orange-50'],
  ['from-blue-50',   'to-cyan-50'],
  ['from-green-50',  'to-emerald-50'],
  ['from-purple-50', 'to-pink-50'],
  ['from-amber-50',  'to-yellow-50'],
  ['from-teal-50',   'to-green-50'],
  ['from-indigo-50', 'to-blue-50'],
  ['from-rose-50',   'to-red-50'],
  ['from-sky-50',    'to-indigo-50'],
  ['from-lime-50',   'to-teal-50'],
];

const ICON_COLORS = [
  'text-red-400', 'text-blue-400', 'text-green-400', 'text-purple-400',
  'text-amber-400', 'text-teal-400', 'text-indigo-400', 'text-rose-400',
];

const CROP = ['object-left-top', 'object-right-top', 'object-left-bottom', 'object-right-bottom'] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pickTop(cats: Category[], max = 5): Category[] {
  const with_ = cats.filter(c => c.image_url);
  const without = cats.filter(c => !c.image_url);
  return [...with_, ...without].slice(0, max);
}

interface CG { name: string; order: number; cats: Category[] }

function buildGroups(cats: Category[]): CG[] | null {
  const withGroup = cats.filter(c => c.group_name);
  if (!withGroup.length) return null;

  const map = new Map<string, CG>();
  for (const cat of withGroup) {
    const key = cat.group_name!;
    if (!map.has(key)) map.set(key, { name: key, order: cat.group_order ?? 999, cats: [] });
    map.get(key)!.cats.push(cat);
  }
  return [...map.values()].sort((a, b) => a.order - b.order);
}

// ─── Card components ──────────────────────────────────────────────────────────

interface CardProps { category: Category; idx: number }

function MosaicCard({ category, idx }: CardProps) {
  const Icon = FALLBACK_ICONS[idx % FALLBACK_ICONS.length];
  const [gf, gt] = GRADIENT_PAIRS[idx % GRADIENT_PAIRS.length];
  const ic = ICON_COLORS[idx % ICON_COLORS.length];

  return (
    <Link href={`/catalog?category=${category.slug}`}>
      <article className="group rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-xl hover:border-red-200 transition-all duration-300 cursor-pointer">
        {/* 2×2 mosaic */}
        <div className="grid grid-cols-2 gap-0.5 bg-slate-100 p-0.5 rounded-t-2xl overflow-hidden">
          {CROP.map((pos, qi) => (
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
  );
}

function MobileChip({ category, idx }: CardProps) {
  const Icon = FALLBACK_ICONS[idx % FALLBACK_ICONS.length];
  const [gf, gt] = GRADIENT_PAIRS[idx % GRADIENT_PAIRS.length];
  const ic = ICON_COLORS[idx % ICON_COLORS.length];

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
        <p className="text-[10px] font-semibold text-slate-700 mt-1.5 text-center leading-tight line-clamp-2">
          {category.name}
        </p>
      </div>
    </Link>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
      <div>
        <p className="text-red-600 text-xs font-bold uppercase tracking-widest mb-1">Our Range</p>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Browse by Category</h2>
        <p className="text-slate-500 text-sm mt-1">XL Traders wholesale collection</p>
      </div>
      <Link
        href="/catalog"
        className="inline-flex items-center gap-1 text-red-600 font-semibold text-sm hover:text-red-700 transition shrink-0"
      >
        View all products <ArrowRight size={15} />
      </Link>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function HomeCategoryGrid() {
  const [cats, setCats] = useState<Category[]>([]);

  useEffect(() => {
    categoryService.getAll().then(setCats).catch((err) => {
      console.warn('Failed to load categories for homepage grid:', err);
    });
  }, []);

  const groups = useMemo(() => buildGroups(cats), [cats]);

  if (!cats.length) return null;

  // ── Grouped layout ──────────────────────────────────────────────────────────
  if (groups) {
    let globalIdx = 0;

    return (
      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <SectionHeader />

          <div className="space-y-10 md:space-y-14">
            {groups.map((group) => {
              const shown = pickTop(group.cats);
              const startIdx = globalIdx;
              globalIdx += shown.length;
              const groupHref = `/catalog?group=${encodeURIComponent(group.name)}`;

              return (
                <div key={group.name}>
                  {/* Group heading */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base md:text-lg font-bold text-slate-900">{group.name}</h3>
                    <Link
                      href={groupHref}
                      className="inline-flex items-center gap-1 text-red-600 text-xs font-semibold hover:text-red-700 transition"
                    >
                      View all <ArrowRight size={13} />
                    </Link>
                  </div>

                  {/* Mobile: scroll strip */}
                  <div className="flex md:hidden gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
                    {shown.map((cat, i) => (
                      <MobileChip key={cat.id} category={cat} idx={startIdx + i} />
                    ))}
                  </div>

                  {/* Desktop: horizontal row */}
                  <div className="hidden md:flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
                    {shown.map((cat, i) => (
                      <motion.div
                        key={cat.id}
                        className="flex-shrink-0 w-44 xl:w-48"
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <MosaicCard category={cat} idx={startIdx + i} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  // ── Flat fallback (no group_name set on any category yet) ───────────────────
  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <SectionHeader />

        {/* Mobile scroll */}
        <div className="flex md:hidden gap-3 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
          {cats.map((cat, i) => (
            <MobileChip key={cat.id} category={cat} idx={i} />
          ))}
        </div>

        {/* Desktop grid */}
        <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
          {cats.map((cat, i) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
            >
              <MosaicCard category={cat} idx={i} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
