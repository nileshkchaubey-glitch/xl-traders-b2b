import { motion } from 'framer-motion';
import { BRAND_NAMES } from './heroConfig';

export default function HeroBrandsSlider() {
  const items = [...BRAND_NAMES, ...BRAND_NAMES];

  return (
    <section className="py-10 md:py-12 bg-slate-50 border-t border-slate-100 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 mb-6">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Trusted Brands
        </p>
        <h2 className="text-center text-lg md:text-xl font-bold text-slate-900 mt-1">
          Businesses that rely on quality packaging
        </h2>
      </div>

      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-r from-slate-50 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-l from-slate-50 to-transparent z-10 pointer-events-none" />

        <motion.div
          className="flex gap-8 md:gap-12 w-max"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
        >
          {items.map((name, i) => (
            <div
              key={`${name}-${i}`}
              className="flex h-14 md:h-16 min-w-[140px] md:min-w-[160px] items-center justify-center rounded-xl border border-slate-200/80 bg-white px-6 shadow-sm"
            >
              <span className="text-sm md:text-base font-bold text-slate-400 whitespace-nowrap">
                {name}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
