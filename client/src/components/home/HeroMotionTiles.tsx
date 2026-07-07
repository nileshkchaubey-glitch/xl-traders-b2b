import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";

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

export default function HeroMotionTiles() {
  // One global step; tile i shows SLIDES[(step + i) % 6], so the four tiles
  // are always showing four different images while the set "conveys" along.
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setStep(s => (s + 1) % SLIDES.length),
      ROTATE_MS
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="grid grid-cols-2 gap-3.5">
      {Array.from({ length: TILE_COUNT }, (_, i) => {
        const active = (step + i) % SLIDES.length;
        const slide = SLIDES[active];
        return (
          <Link
            key={i}
            href={`/catalog?search=${encodeURIComponent(slide.search)}`}
            className="group relative rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition aspect-[4/3]"
          >
            {/* Stacked layers — the active one fades in and slowly zooms */}
            {SLIDES.map((s, idx) => (
              <img
                key={s.src}
                src={s.src}
                alt={idx === active ? s.label : ""}
                loading={i === 0 && idx === active ? "eager" : "lazy"}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 group-hover:scale-105 ${
                  idx === active ? "opacity-100 xl-kenburns" : "opacity-0"
                }`}
                style={{ transitionDelay: `${i * 90}ms` }}
              />
            ))}

            {/* Caption */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent pt-8 pb-2.5 px-3">
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-white text-[13px] font-bold leading-tight truncate">
                    {slide.label}
                  </div>
                  <div className="text-white/70 text-[11px] truncate">
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
