import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { categoryService, productService } from "@/lib/productService";

// Local hero showcase images (client/public/images/hero). Each tile cycles
// through this list with a crossfade + slow Ken Burns zoom so the hero is
// always gently in motion.
const SLIDES = [
  {
    src: "/images/hero/food-containers.png",
    label: "Food Containers",
    meta: "250ml – 1000ml · with lids",
    search: "container",
  },
  {
    src: "/images/hero/paper-cups.png",
    label: "Paper Cups",
    meta: "150ml – 350ml · plain & printed",
    search: "paper cup",
  },
  {
    src: "/images/hero/carry-bags.png",
    label: "Carry Bags",
    meta: "printed · non-woven · kirana",
    search: "carry bag",
  },
  {
    src: "/images/hero/corrugated-boxes.png",
    label: "Corrugated Boxes",
    meta: "3 & 5 ply · all sizes",
    search: "box",
  },
  {
    src: "/images/hero/meal-trays.png",
    label: "Meal Trays",
    meta: "3-CP / 4-CP · with lids",
    search: "meal tray",
  },
  {
    src: "/images/hero/packaging-films.png",
    label: "Packaging Films",
    meta: "cling · shrink · foil",
    search: "film",
  },
];

const TILE_COUNT = 4;
const ROTATE_MS = 4000;
// The last tile swaps to a live catalogue-stats card once per full rotation
// cycle (Concept C's "data-driven beat" — docs/STOREFRONT_DESIGN_PROPOSALS.md
// §2C). Desktop only: on mobile the 2×2 grid stays purely photographic.
const WILDCARD_TILE = TILE_COUNT - 1;
const WILDCARD_EVERY = 5;

export default function HeroMotionTiles() {
  // One global step; tile i shows SLIDES[(step + i) % 6], so the four tiles
  // are always showing four different images while the set "conveys" along.
  const [step, setStep] = useState(0);
  const [stats, setStats] = useState<{
    products: number;
    categories: number;
  } | null>(null);

  useEffect(() => {
    const id = setInterval(
      () => setStep(s => (s + 1) % (SLIDES.length * WILDCARD_EVERY)),
      ROTATE_MS
    );
    return () => clearInterval(id);
  }, []);

  // Live counts for the wildcard tile — the same public calls the rest of
  // the storefront makes. If either fails, the tile simply never appears.
  useEffect(() => {
    Promise.all([productService.countPublished(), categoryService.getAll()])
      .then(([products, cats]) => {
        if (products > 0 && cats.length > 0) {
          setStats({ products, categories: cats.length });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="grid grid-cols-2 gap-3.5">
      {Array.from({ length: TILE_COUNT }, (_, i) => {
        const active = (step + i) % SLIDES.length;
        const slide = SLIDES[active];
        // Wildcard beat: once per WILDCARD_EVERY rotations, the last tile
        // shows the stats card instead of a photo (md+ only, via CSS).
        const wildcardOn =
          stats !== null &&
          i === WILDCARD_TILE &&
          step % WILDCARD_EVERY === WILDCARD_EVERY - 1;
        return (
          <Link
            key={i}
            href={
              wildcardOn
                ? "/catalog"
                : `/catalog?search=${encodeURIComponent(slide.search)}`
            }
            className="group relative rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-xl motion-safe:hover:-translate-y-0.5 hover:ring-1 hover:ring-white/40 transition aspect-[4/3]"
          >
            {/* Stacked layers — the active one fades in and slowly zooms */}
            {SLIDES.map((s, idx) => (
              <img
                key={s.src}
                src={s.src}
                alt={idx === active ? s.label : ""}
                loading={i === 0 && idx === active ? "eager" : "lazy"}
                className={`xl-hero-crossfade absolute inset-0 h-full w-full object-cover transition-opacity duration-700 motion-safe:group-hover:scale-105 ${
                  idx === active ? "opacity-100 xl-kenburns" : "opacity-0"
                }`}
                style={{ transitionDelay: `${i * 90}ms` }}
              />
            ))}

            {/* Wildcard stats card — overlays the photo on its beat (md+) */}
            <div
              aria-hidden={!wildcardOn}
              className={`xl-hero-crossfade absolute inset-0 hidden md:flex flex-col items-start justify-end gap-1 bg-slate-900/85 p-4 transition-opacity duration-700 ${
                wildcardOn ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <div className="text-white text-2xl font-extrabold tracking-tight tabular-nums">
                {stats ? `${stats.products}+` : ""}
              </div>
              <div className="text-white/80 text-body-sm font-semibold leading-tight">
                products across {stats?.categories ?? ""} categories
              </div>
              <div className="flex items-center gap-1 text-red-400 text-caption font-bold uppercase tracking-wide mt-1">
                Browse the catalogue
                <ArrowRight size={11} />
              </div>
            </div>

            {/* Caption */}
            <div
              className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent pt-8 pb-2.5 px-3 transition-opacity duration-500 ${
                wildcardOn ? "md:opacity-0" : ""
              }`}
            >
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-white text-body-sm font-bold leading-tight truncate">
                    {slide.label}
                  </div>
                  <div className="text-white/70 text-caption truncate">
                    {slide.meta}
                  </div>
                </div>
                <span className="w-6 h-6 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
                  <ArrowUpRight size={13} className="text-white" />
                </span>
              </div>
            </div>

            {/* Progress dots */}
            <div className="absolute top-2.5 right-2.5 flex gap-1">
              {SLIDES.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1 rounded-full transition-all duration-500 ${
                    idx === active ? "w-3.5 bg-white" : "w-1 bg-white/40"
                  }`}
                />
              ))}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
