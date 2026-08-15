import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroMotionTiles from "@/components/home/HeroMotionTiles";
import HomeCategoryGrid from "@/components/home/HomeCategoryGrid";
import HomeCatalogueShowcase from "@/components/home/HomeCatalogueShowcase";
import SectionEyebrow from "@/components/SectionEyebrow";
import {
  MessageCircle,
  ArrowRight,
  Check,
  Lock,
  Plus,
  Minus,
  MapPin,
  Truck,
} from "lucide-react";
import { productService } from "@/lib/productService";
import { useAuthStore } from "@/lib/authStore";
import { settingsService, FALLBACKS } from "@/lib/settingsService";
import { realBrands } from "@/lib/brandUtils";

// Shared scroll-reveal: sections fade up once as they enter the viewport.
// Skips the y-translate (opacity-only) when the visitor prefers reduced
// motion — framer-motion doesn't apply that preference automatically.
function getFadeUp(reduced: boolean) {
  return {
    initial: { opacity: 0, y: reduced ? 0 : 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: reduced ? 0.01 : 0.5, ease: "easeOut" as const },
  };
}

export default function Home() {
  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";
  const { isAuthenticated } = useAuthStore();
  const prefersReducedMotion = useReducedMotion();
  const fadeUp = getFadeUp(!!prefersReducedMotion);
  const [brands, setBrands] = useState<string[]>([]);
  const [openFaq, setOpenFaq] = useState(-1);

  // Editable content — initialised to the in-code fallback so the first paint is
  // identical to the pre-Phase-B site, then overridden from the DB if present.
  const [hero, setHero] = useState(FALLBACKS.hero);
  const [trustStats, setTrustStats] = useState(FALLBACKS.trust_stats);
  const [trustPoints, setTrustPoints] = useState(FALLBACKS.trust_points);
  const [serviceAreas, setServiceAreas] = useState(FALLBACKS.service_areas);
  const [faqs, setFaqs] = useState(FALLBACKS.faqs);
  const [bulkBanner, setBulkBanner] = useState(FALLBACKS.bulk_banner);

  useEffect(() => {
    productService
      // realBrands drops the 'Generic' null-brand placeholder before it can
      // render as a supplier we stock, in the "Brands We Stock" chips
      // (docs/STYLE_REFERENCE.md §2.4 item 4, §4.4). The marquee was the other
      // consumer of this state until PR-1 deleted it (§2.3 REJECT).
      .getBrands()
      .then(b => setBrands(realBrands(b).slice(0, 10)))
      .catch(() => {});

    settingsService
      .getAllContent()
      .then(c => {
        setHero(c.hero);
        setTrustStats(c.trust_stats);
        setTrustPoints(c.trust_points);
        setServiceAreas(c.service_areas);
        setFaqs(c.faqs);
        setBulkBanner(c.bulk_banner);
      })
      .catch(() => {});
  }, []);

  const bulkQuoteHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hi XL Traders, I need a bulk / custom order quote.")}`;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      <Header />

      <main className="flex-1 pb-20 md:pb-0">
        {/* ── HERO — PR-1. The delivery promise is the largest element on the
            page (STYLE_REFERENCE §2.1 A6); it used to be a small ✓ tick in the
            bullet row below. Mobile-first: promise → identity → subline → CTAs
            → tiers, one column that becomes two at lg. ── */}
        <section className="relative overflow-hidden border-b border-slate-100 bg-[radial-gradient(1000px_500px_at_20%_0%,#fef2f2_0%,#ffffff_55%)]">
          <div className="relative container py-8 md:py-14 lg:py-16 grid lg:grid-cols-[1.15fr_1fr] gap-8 lg:gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            >
              {/* One <h1>: the promise leads visually, the category line keeps
                  the heading meaningful to a first-time visitor and to search. */}
              <h1 className="mb-3">
                <span className="flex items-center gap-2 text-caption font-bold uppercase tracking-[0.12em] text-emerald-700 mb-2">
                  <Truck size={14} strokeWidth={2.5} />
                  Surat · wholesale packaging
                </span>
                <span className="block text-4xl md:text-5xl lg:text-display font-extrabold tracking-tight leading-[1.05]">
                  {hero.promiseLead}{" "}
                  <span className="text-red-600">{hero.promiseAccent}</span>
                </span>
                <span className="block text-lg md:text-xl font-bold tracking-tight text-slate-500 mt-2">
                  {hero.titleLead} {hero.titleAccent}
                </span>
              </h1>

              <p className="text-body-md md:text-base text-slate-600 max-w-md mb-5">
                {hero.subline}
              </p>

              <div className="flex flex-col sm:flex-row gap-2.5 mb-5">
                <Link
                  href="/catalog"
                  className="inline-flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-3.5 rounded-xl text-body-md font-bold hover:bg-red-700 transition shadow-[0_6px_20px_rgba(220,38,38,0.28)]"
                >
                  Browse Products
                  <ArrowRight size={16} />
                </Link>
                <a
                  href={bulkQuoteHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-white text-emerald-700 border-[1.5px] border-emerald-200 px-6 py-3.5 rounded-xl text-body-md font-bold hover:bg-emerald-50 transition"
                >
                  <MessageCircle size={16} />
                  Get Quote on WhatsApp
                </a>
              </div>

              {/* Delivery tiers — the substance behind the promise. Stated here
                  and nowhere else; the Service Areas card used to repeat it. */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {hero.promiseTiers.map(t => (
                  <span
                    key={t}
                    className="flex items-center gap-1.5 text-body-sm font-semibold text-slate-700"
                  >
                    <Check
                      size={14}
                      className="text-emerald-600 flex-shrink-0"
                      strokeWidth={3}
                    />
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Hero motion tiles — auto-rotating product imagery. Hidden below
                lg: on a 390px screen this pushed the first product a whole
                extra screen down, and the promise is the point of the hero. */}
            <motion.div
              className="hidden lg:block"
              initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, delay: 0.15, ease: "easeOut" }}
            >
              <HeroMotionTiles />
            </motion.div>
          </div>
        </section>

        {/* ── SIGN-IN HOOK ── */}
        {!isAuthenticated && (
          <motion.section {...fadeUp} className="container pt-7 w-full">
            <div className="bg-slate-900 rounded-2xl px-5 py-5 md:px-6 flex flex-col md:flex-row md:items-center gap-4">
              <div className="w-10 h-10 bg-red-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Lock size={19} className="text-red-400" />
              </div>
              <div className="flex-1">
                <div className="text-white text-body-md font-bold">
                  Sign in for your wholesale rates
                </div>
                <div className="text-slate-400 text-body-sm">
                  See per-piece rates on every product and order on
                  WhatsApp.
                </div>
              </div>
              <Link
                href="/auth"
                className="inline-flex items-center justify-center bg-red-600 text-white px-5 py-3 rounded-xl text-body-sm font-bold hover:bg-red-700 transition flex-shrink-0"
              >
                Sign In
              </Link>
            </div>
          </motion.section>
        )}

        {/* ── CATALOGUE SHOWCASE — chip-filtered product taster.
            Moved ABOVE the category grid in PR-1. STYLE_REFERENCE §5 sets the
            mobile density intent as "the first real price visible within
            roughly one screen of scroll"; measured at 390px, the category grid
            is 1092px on its own and pushed the first product card to 2.63
            screens. Real products now come first and the grid follows.
            (The grid's own layout is untouched — that is PR-3.) ── */}
        <HomeCatalogueShowcase whatsappNumber={whatsappNumber} />

        {/* ── CATEGORIES (existing data-wired grid) ── */}
        <HomeCategoryGrid />

        {/* ── BULK BANNER ── */}
        <motion.section {...fadeUp} className="container py-6 w-full">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl px-6 py-8 md:px-9 flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <SectionEyebrow tone="dark" className="mb-2">
                {bulkBanner.eyebrow}
              </SectionEyebrow>
              <div className="text-white text-xl md:text-2xl font-extrabold tracking-tight mb-1.5">
                {bulkBanner.title}
              </div>
              <div className="text-slate-400 text-sm">{bulkBanner.body}</div>
            </div>
            <a
              href={bulkQuoteHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-3.5 rounded-xl text-body-md font-bold hover:bg-red-700 transition shadow-[0_6px_20px_rgba(220,38,38,0.35)] flex-shrink-0"
            >
              Get Bulk Quote
              <ArrowRight size={16} />
            </a>
          </div>
        </motion.section>

        {/* ── TRUST — the ONE place trust content appears (STYLE_REFERENCE
            §2.4 item 5). It used to be four: this section, a strip under the
            hero, a scrolling marquee (§2.3 REJECT — it repeated the strip
            directly above it) and these cards. The strip and marquee are
            deleted; the numbers and the reasons are stated once, here. ── */}
        <motion.section {...fadeUp} className="container py-12 md:py-16 w-full">
          <div className="text-center mb-6">
            <SectionEyebrow className="mb-1">Why XL Traders</SectionEyebrow>
            <h2 className="text-2xl font-extrabold tracking-tight">
              Built For Repeat Wholesale Buying
            </h2>
          </div>
          {/* Numbers read as one band rather than four separate cards — they
              are a single credibility statement, not four facts to compare. */}
          <div className="bg-white border border-slate-200 rounded-2xl grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100 mb-3.5 overflow-hidden">
            {trustStats.map(s => (
              <div key={s.label} className="p-5 text-center">
                <div className="text-2xl font-extrabold text-red-600 tracking-tight">
                  {s.value}
                </div>
                <div className="text-body-sm font-semibold mt-0.5">
                  {s.label}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-3.5">
            {trustPoints.map(tp => (
              <div
                key={tp.title}
                className="flex gap-3.5 bg-white border border-slate-200 rounded-2xl p-5"
              >
                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0 text-red-600 font-extrabold text-body-md">
                  {tp.glyph}
                </div>
                <div>
                  <div className="text-sm font-bold">{tp.title}</div>
                  <div className="text-body-sm text-slate-500 mt-0.5">
                    {tp.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── SERVICE AREAS + BRANDS ── */}
        <motion.section
          {...fadeUp}
          className="container py-4 w-full grid md:grid-cols-2 gap-3.5"
        >
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-body-md font-bold mb-3">
              <MapPin size={16} className="text-red-600" />
              Service Areas
            </div>
            {/* The delivery tiers that used to sit here now lead the hero
                (§2.1 A6). This card answers "where", not "how fast". */}
            <div className="flex flex-wrap gap-2">
              {serviceAreas.map(a => (
                <span
                  key={a}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs font-medium text-slate-700"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="text-body-md font-bold mb-3">Brands We Stock</div>
            {brands.length > 0 ? (
              <div className="flex flex-wrap gap-2.5">
                {brands.map(b => (
                  <Link
                    key={b}
                    href={`/catalog?brand=${encodeURIComponent(b)}`}
                    className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-body-sm font-bold text-slate-600 hover:border-red-300 hover:text-red-600 transition"
                  >
                    {b}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-body-sm text-slate-500">
                Trusted brands plus our own XL value range at the lowest
                per-piece prices.
              </div>
            )}
          </div>
        </motion.section>

        {/* ── FAQ — sits on a soft brand-toned mesh wash (touch #8: one
            gradient accent within the red/amber palette, kept subtle) ── */}
        <motion.section
          {...fadeUp}
          className="relative py-12 md:py-16 w-full overflow-hidden"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_300px_at_15%_20%,rgb(254_242_242/0.9)_0%,transparent_60%),radial-gradient(500px_280px_at_85%_80%,rgb(255_251_235/0.8)_0%,transparent_60%)]"
          />
          <div className="relative container">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-extrabold tracking-tight text-center mb-5">
                Common Questions
              </h2>
              <div className="flex flex-col gap-2.5">
                {faqs.map((f, i) => (
                  <div
                    key={f.q}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-left"
                    >
                      {f.q}
                      {openFaq === i ? (
                        <Minus
                          size={16}
                          className="text-slate-400 flex-shrink-0"
                        />
                      ) : (
                        <Plus
                          size={16}
                          className="text-slate-400 flex-shrink-0"
                        />
                      )}
                    </button>
                    {openFaq === i && (
                      <div className="px-5 pb-4 text-body-sm text-slate-600">
                        {f.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>
      </main>

      <Footer />
    </div>
  );
}
