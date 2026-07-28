import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Package2,
  Coffee,
  ShoppingBag,
  Package,
  UtensilsCrossed,
  Layers,
  Wind,
  Utensils,
  Pizza,
  Printer,
} from "lucide-react";
import { categoryService } from "@/lib/productService";
import { Category } from "@/lib/supabase";
import SectionEyebrow from "@/components/SectionEyebrow";

// ─── Visual constants ────────────────────────────────────────────────────────

const FALLBACK_ICONS = [
  Package2,
  Coffee,
  ShoppingBag,
  Package,
  UtensilsCrossed,
  Layers,
  Wind,
  Utensils,
  Pizza,
  Printer,
];

// Curated 4-tone rotation drawn from the brand palette (red / amber /
// emerald / slate — docs/DESIGN_SYSTEM.md §1.3) instead of the old 10
// arbitrary hue pairs, so category tiles read as designed, not randomized.
const GRADIENT_PAIRS = [
  ["from-red-50", "to-orange-50"],
  ["from-amber-50", "to-yellow-50"],
  ["from-emerald-50", "to-teal-50"],
  ["from-slate-100", "to-slate-50"],
];

const ICON_COLORS = [
  "text-red-400",
  "text-amber-500",
  "text-emerald-500",
  "text-slate-400",
];

// Column count is driven by how many tiles a group actually has, so a row
// always fills the container edge-to-edge instead of leaving dead space on the
// right (docs/STYLE_REFERENCE.md §2.4 item 2). Static strings so Tailwind's
// class scanner sees them. pickTop caps a group at 5.
const GROUP_COLS: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pickTop(cats: Category[], max = 5): Category[] {
  const with_ = cats.filter(c => c.image_url);
  const without = cats.filter(c => !c.image_url);
  return [...with_, ...without].slice(0, max);
}

interface CG {
  name: string;
  order: number;
  cats: Category[];
}

function buildGroups(cats: Category[]): CG[] | null {
  const withGroup = cats.filter(c => c.group_name);
  if (!withGroup.length) return null;

  const map = new Map<string, CG>();
  for (const cat of withGroup) {
    const key = cat.group_name!;
    if (!map.has(key))
      map.set(key, { name: key, order: cat.group_order ?? 999, cats: [] });
    map.get(key)!.cats.push(cat);
  }
  return [...map.values()].sort((a, b) => a.order - b.order);
}

// ─── Card components ──────────────────────────────────────────────────────────

interface CardProps {
  category: Category;
  idx: number;
}

function CategoryCard({ category, idx }: CardProps) {
  const Icon = FALLBACK_ICONS[idx % FALLBACK_ICONS.length];
  const [gf, gt] = GRADIENT_PAIRS[idx % GRADIENT_PAIRS.length];
  const ic = ICON_COLORS[idx % ICON_COLORS.length];

  return (
    <Link href={`/catalog?category=${category.slug}`} className="block h-full">
      <article className="group h-full rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-xl hover:border-red-200 transition-all duration-300 cursor-pointer">
        {/* Single image, never a composite (docs/STYLE_REFERENCE.md §3.2).
            A category only ever carries one image_url, so the old 2×2 mosaic
            rendered that same photo four times at 220% zoom — which sliced
            packaging text into nonsense and could never show four distinct
            images. The icon sits underneath as the fallback layer: the image is
            absolutely positioned over it, so if it is absent or fails to load
            the icon simply shows through. No blank grey box, no JS toggling
            (§4.3 fallback chain). */}
        <div
          className={`aspect-[4/3] overflow-hidden bg-gradient-to-br ${gf} ${gt} relative flex items-center justify-center`}
        >
          <Icon className={`w-8 h-8 ${ic} opacity-40`} />
          {category.image_url && (
            <img
              src={category.image_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition duration-500 motion-safe:group-hover:scale-105"
              loading="lazy"
              onError={e => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
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
    <Link
      href={`/catalog?category=${category.slug}`}
      className="snap-start shrink-0"
    >
      <div className="w-20">
        <div
          className={`h-16 w-16 mx-auto rounded-xl overflow-hidden bg-gradient-to-br ${gf} ${gt} relative flex items-center justify-center`}
        >
          {category.image_url && (
            <img
              src={category.image_url}
              alt={category.name}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              onError={e => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
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
        <SectionEyebrow className="mb-1">Our Range</SectionEyebrow>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
          Browse by Category
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          XL Traders wholesale collection
        </p>
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
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    categoryService
      .getAll()
      .then(setCats)
      .catch(() => {});
  }, []);

  const groups = useMemo(() => buildGroups(cats), [cats]);

  if (!cats.length) return null;

  // ── Grouped layout ──────────────────────────────────────────────────────────
  if (groups) {
    let globalIdx = 0;

    return (
      <section className="py-12 md:py-16 bg-white">
        <div className="container">
          <SectionHeader />

          <div className="space-y-10 md:space-y-14">
            {groups.map(group => {
              const shown = pickTop(group.cats);
              const startIdx = globalIdx;
              globalIdx += shown.length;
              const groupHref = `/catalog?group=${encodeURIComponent(group.name)}`;

              return (
                <div key={group.name}>
                  {/* Group heading */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base md:text-lg font-bold text-slate-900">
                      {group.name}
                    </h3>
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
                      <MobileChip
                        key={cat.id}
                        category={cat}
                        idx={startIdx + i}
                      />
                    ))}
                  </div>

                  {/* Desktop: stretching grid. Was a flex row of fixed-width
                      (w-44 xl:w-48) tiles, which left ~192px of dead space to
                      the right of every row at 1440px and clipped the last tile
                      around 1000px. 1fr columns matched to the tile count reach
                      the container edge at any width (STYLE_REFERENCE §2.4 #2;
                      the design-reference prototype uses repeat(N,1fr) too). */}
                  <div
                    className={`hidden md:grid gap-4 ${GROUP_COLS[shown.length] ?? "md:grid-cols-5"}`}
                  >
                    {shown.map((cat, i) => (
                      <motion.div
                        key={cat.id}
                        className="h-full"
                        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: prefersReducedMotion ? 0 : i * 0.05 }}
                      >
                        <CategoryCard category={cat} idx={startIdx + i} />
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
      <div className="container">
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
              className="h-full"
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: prefersReducedMotion ? 0 : i * 0.04 }}
            >
              <CategoryCard category={cat} idx={i} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
