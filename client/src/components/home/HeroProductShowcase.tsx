import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HERO_FLOATING_PRODUCTS } from './heroConfig';

export default function HeroProductShowcase() {
  const [mobileIndex, setMobileIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setMobileIndex((i) => (i + 1) % HERO_FLOATING_PRODUCTS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const active = HERO_FLOATING_PRODUCTS[mobileIndex];

  return (
    <div className="relative w-full max-w-lg mx-auto lg:max-w-none lg:mx-0">
      {/* Ambient glow */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-red-500/15 via-transparent to-slate-200/40 blur-2xl" />

      {/* Desktop: floating cards */}
      <div className="hidden md:block relative aspect-[4/5] min-h-[420px] lg:min-h-[480px]">
        <div className="absolute inset-4 rounded-3xl border border-white/60 bg-gradient-to-b from-white/40 to-slate-100/30 shadow-inner" />

        {HERO_FLOATING_PRODUCTS.map((product) => (
          <motion.div
            key={product.title}
            className="absolute w-[42%] max-w-[200px]"
            style={product.position}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: [0, -8, 0] }}
            transition={{
              opacity: { duration: 0.5, delay: product.delay },
              y: { duration: 4 + product.delay, repeat: Infinity, ease: 'easeInOut' },
            }}
            whileHover={{ scale: 1.05, zIndex: 20 }}
          >
            <Link href={`/catalog?category=${product.slug}`}>
              <article className="group overflow-hidden rounded-2xl border border-white/70 bg-white/55 backdrop-blur-xl shadow-lg shadow-slate-900/10 transition hover:shadow-xl hover:shadow-red-500/10">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-emerald-600/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    {product.stock}
                  </span>
                </div>
                <div className="px-3 py-2.5">
                  <h3 className="text-xs font-bold text-slate-900 leading-tight">{product.title}</h3>
                </div>
              </article>
            </Link>
          </motion.div>
        ))}

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-white/80 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-600 backdrop-blur-md shadow-sm">
          Wholesale packaging showcase
        </div>
      </div>

      {/* Mobile: swipeable slider */}
      <div className="md:hidden relative">
        <motion.div
          key={active.title}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.35 }}
        >
          <Link href={`/catalog?category=${active.slug}`}>
            <article className="overflow-hidden rounded-2xl border border-white/70 bg-white/60 backdrop-blur-xl shadow-xl">
              <div className="relative aspect-[16/10]">
                <img src={active.image} alt={active.title} className="h-full w-full object-cover" />
                <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">
                  {active.stock}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <h3 className="font-bold text-slate-900">{active.title}</h3>
                <span className="text-xs text-slate-500">
                  {mobileIndex + 1}/{HERO_FLOATING_PRODUCTS.length}
                </span>
              </div>
            </article>
          </Link>
        </motion.div>

        <div className="flex justify-center gap-4 mt-4">
          <button
            type="button"
            onClick={() =>
              setMobileIndex((i) => (i - 1 + HERO_FLOATING_PRODUCTS.length) % HERO_FLOATING_PRODUCTS.length)
            }
            className="rounded-full border border-slate-200 bg-white p-2 shadow-sm"
            aria-label="Previous product"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-1.5">
            {HERO_FLOATING_PRODUCTS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setMobileIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  i === mobileIndex ? 'w-6 bg-red-600' : 'w-2 bg-slate-300'
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMobileIndex((i) => (i + 1) % HERO_FLOATING_PRODUCTS.length)}
            className="rounded-full border border-slate-200 bg-white p-2 shadow-sm"
            aria-label="Next product"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
