import { Link } from 'wouter';
import { ArrowRight, Check, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import HeroTopBar from './HeroTopBar';
import HeroProductShowcase from './HeroProductShowcase';
import HeroTrustStrip from './HeroTrustStrip';
import HeroCategoryPreview from './HeroCategoryPreview';
import HeroBrandsSlider from './HeroBrandsSlider';
import { TRUST_POINTS } from './heroConfig';

interface HomeHeroProps {
  whatsappNumber: string;
  phone: string;
}

export default function HomeHero({ whatsappNumber, phone }: HomeHeroProps) {
  const catalogMessage = encodeURIComponent(
    'Hi XL Traders, I want to browse your wholesale packaging catalog.'
  );

  return (
    <>
      <HeroTopBar whatsappNumber={whatsappNumber} phone={phone} />

      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-red-50/80 via-white to-white pointer-events-none" />
        <div className="absolute top-20 right-0 h-72 w-72 rounded-full bg-red-500/5 blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 py-10 md:py-14 lg:py-16">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            {/* Left */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <p className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 mb-5">
                B2B Wholesale · Surat
              </p>

              <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold text-slate-900 leading-[1.15] tracking-tight">
                Packaging Solutions For{' '}
                <span className="text-red-600">Growing Businesses</span>
              </h1>

              <p className="mt-5 text-base md:text-lg text-slate-600 leading-relaxed max-w-xl">
                Wholesale food packaging, disposable containers, paper cups, carry bags,
                corrugated boxes and restaurant supplies.
              </p>

              <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {TRUST_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/catalog"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/25 hover:bg-red-700 transition"
                >
                  Browse Products
                  <ArrowRight size={18} />
                </Link>
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${catalogMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-800 hover:border-emerald-500 hover:text-emerald-700 transition"
                >
                  <MessageCircle size={18} className="text-emerald-600" />
                  WhatsApp Us
                </a>
              </div>

              <p className="mt-6 text-xs text-slate-500">
                For restaurants, cafes, cloud kitchens, caterers, bakeries &amp; distributors
              </p>
            </motion.div>

            {/* Right */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              <HeroProductShowcase />
            </motion.div>
          </div>
        </div>
      </section>

      <HeroTrustStrip />
      <HeroCategoryPreview />
      <HeroBrandsSlider />

      {/* Sticky WhatsApp — mobile */}
      <a
        href={`https://wa.me/${whatsappNumber}?text=${catalogMessage}`}
        target="_blank"
        rel="noopener noreferrer"
        className="md:hidden fixed bottom-5 right-4 z-50 flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/40 hover:bg-emerald-700 transition"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle size={20} />
        WhatsApp
      </a>
    </>
  );
}
