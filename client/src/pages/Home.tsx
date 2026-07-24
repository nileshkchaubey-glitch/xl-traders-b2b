import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroMotionTiles from "@/components/home/HeroMotionTiles";
import HomeCategoryGrid from "@/components/home/HomeCategoryGrid";
import HomeCatalogueShowcase from "@/components/home/HomeCatalogueShowcase";
import HomeDailySuggestion from "@/components/home/HomeDailySuggestion";
import SectionEyebrow from "@/components/SectionEyebrow";
import {
  MessageCircle,
  ArrowRight,
  Star,
  Check,
  Lock,
  Plus,
  Minus,
  MapPin,
  Building2,
  Calendar,
} from "lucide-react";
import { productService } from "@/lib/productService";
import { useAuthStore } from "@/lib/authStore";
import { settingsService, FALLBACKS } from "@/lib/settingsService";

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
  const isDev = import.meta.env.DEV;
  const { isAuthenticated } = useAuthStore();
  const prefersReducedMotion = useReducedMotion();
  const fadeUp = getFadeUp(!!prefersReducedMotion);
  const [brands, setBrands] = useState<string[]>([]);
  const [openFaq, setOpenFaq] = useState(-1);

  // Editable content — initialised to the in-code fallback so the first paint is
  // identical to the pre-Phase-B site, then overridden from the DB if present.
  const [hero, setHero] = useState(FALLBACKS.hero);
  const [trustBadge, setTrustBadge] = useState(FALLBACKS.trust_badge);
  const [trustStats, setTrustStats] = useState(FALLBACKS.trust_stats);
  const [trustPoints, setTrustPoints] = useState(FALLBACKS.trust_points);
  const [serviceAreas, setServiceAreas] = useState(FALLBACKS.service_areas);
  const [faqs, setFaqs] = useState(FALLBACKS.faqs);
  const [bulkBanner, setBulkBanner] = useState(FALLBACKS.bulk_banner);

  useEffect(() => {
    productService
      .getBrands()
      .then(b => setBrands(b.slice(0, 10)))
      .catch(() => {});

    settingsService
      .getAllContent()
      .then(c => {
        setHero(c.hero);
        setTrustBadge(c.trust_badge);
        setTrustStats(c.trust_stats);
        setTrustPoints(c.trust_points);
        setServiceAreas(c.service_areas);
        setFaqs(c.faqs);
        setBulkBanner(c.bulk_banner);
      })
      .catch(() => {});
  }, []);

  const bulkQuoteHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hi XL Traders, I need a bulk / custom order quote.")}`;

  // Slim trust strip below the hero — condensed from the same admin-managed
  // trust_badge/trust_stats content as the full Trust section further down
  // (Site Content → Trust); no separate admin control needed.
  const yearsStat = trustStats.find(s => /year/i.test(s.label));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      <Header />

      <main className="flex-1 pb-20 md:pb-0">
        {/* ── HERO — Concept C: quiet wash, no blob glows, tiles are the focal
            point (docs/STOREFRONT_DESIGN_PROPOSALS.md §2C) ── */}
        <section className="relative overflow-hidden border-b border-slate-100 bg-[radial-gradient(1000px_500px_at_20%_0%,#fef2f2_0%,#ffffff_55%)]">
          <div className="relative container py-14 md:py-20 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            >
              <h1 className="text-4xl lg:text-display font-extrabold tracking-tight mb-4">
                {hero.titleLead}{" "}
                <span className="text-red-600">{hero.titleAccent}</span>
              </h1>
              <p className="text-base text-slate-600 max-w-md mb-6">
                {hero.subline}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-7">
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
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-body-sm font-medium text-slate-700">
                {hero.bullets.map(t => (
                  <span key={t} className="flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-600" strokeWidth={3} />
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Hero motion tiles — auto-rotating product imagery */}
            <motion.div
              initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, delay: 0.15, ease: "easeOut" }}
            >
              <HeroMotionTiles />
            </motion.div>
          </div>
        </section>

        {/* ── TRUST STRIP — slim, below the hero ── */}
        <section className="bg-white border-b border-slate-100">
          <div className="container py-2.5 flex flex-wrap items-center justify-center gap-x-6 gap-y-1.5 text-body-sm font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
              <Star size={13} className="fill-amber-500 text-amber-500" />
              {trustBadge.rating}
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 size={13} className="text-red-600" />
              {trustBadge.businesses}
            </span>
            {yearsStat && (
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-red-600" />
                {yearsStat.value} {yearsStat.label}
              </span>
            )}
          </div>
        </section>

        {/* ── MARQUEE STRIP — brands when we have enough, value props otherwise ── */}
        <section className="bg-white border-b border-slate-100 py-3.5 overflow-hidden">
          <div
            className="relative"
            style={{
              maskImage:
                "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            }}
          >
            <div className="xl-marquee flex w-max items-center gap-10">
              {(() => {
                const entries =
                  brands.length >= 4
                    ? brands.map(b => ({
                        label: b,
                        href: `/catalog?brand=${encodeURIComponent(b)}`,
                      }))
                    : [
                        "Same-day delivery in Surat",
                        "GST invoice on every order",
                        "500+ businesses served",
                        "Bulk slab pricing",
                        "24h dispatch pan-India",
                        "Food-grade materials",
                        ...brands.map(b => b),
                      ].map(label => ({ label, href: "/catalog" }));
                return [...entries, ...entries].map((e, i) => (
                  <Link
                    key={`${e.label}-${i}`}
                    href={e.href}
                    className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-caption font-bold tracking-wide text-slate-500 hover:border-red-300 hover:text-red-600 transition whitespace-nowrap uppercase"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-300 flex-shrink-0" />
                    {e.label}
                  </Link>
                ));
              })()}
            </div>
          </div>
        </section>

        {/* ── SIGN-IN HOOK ── */}
        {!isAuthenticated && (
          <motion.section
            {...fadeUp}
            className="container pt-7 w-full"
          >
            <div className="bg-slate-900 rounded-2xl px-5 py-5 md:px-6 flex flex-col md:flex-row md:items-center gap-4">
              <div className="w-10 h-10 bg-red-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Lock size={19} className="text-red-400" />
              </div>
              <div className="flex-1">
                <div className="text-white text-body-md font-bold">
                  Unlock exact wholesale prices in 10 seconds
                </div>
                <div className="text-slate-400 text-body-sm">
                  Sign in to see exact prices and order with one tap on
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

        {/* ── CATEGORIES (existing data-wired grid) ── */}
        <HomeCategoryGrid />

        {/* ── CATALOGUE SHOWCASE — chip-filtered product taster ── */}
        <HomeCatalogueShowcase whatsappNumber={whatsappNumber} />

        {/* ── BULK BANNER ── */}
        <motion.section
          {...fadeUp}
          className="container py-6 w-full"
        >
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

        {/* ── TRUST ── */}
        <motion.section
          {...fadeUp}
          className="container py-12 md:py-16 w-full"
        >
          <div className="text-center mb-6">
            <SectionEyebrow className="mb-1">
              Why XL Traders
            </SectionEyebrow>
            <h2 className="text-2xl font-extrabold tracking-tight">
              Built For Repeat Wholesale Buying
            </h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-3.5">
            {trustStats.map(s => (
              <div
                key={s.label}
                className="bg-white border border-slate-200 rounded-2xl p-5 text-center"
              >
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
            <div className="text-body-sm text-slate-600 mb-3">
              <strong className="text-emerald-700">Same-day:</strong> Surat
              city · <strong>Next-day:</strong> South Gujarat ·{" "}
              <strong>2–4 days:</strong> Pan-India
            </div>
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

        {/* Daily improvement suggestions — dev mode only */}
        {isDev && <HomeDailySuggestion />}
      </main>

      <Footer />
    </div>
  );
}
