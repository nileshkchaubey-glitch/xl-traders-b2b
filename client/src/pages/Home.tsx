import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Lock, MapPin, MessageCircle } from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SectionEyebrow from "@/components/SectionEyebrow";
import HeroSlideshow from "@/components/storefront/HeroSlideshow";
import PromoBanners from "@/components/storefront/PromoBanners";
import BackToTop from "@/components/storefront/BackToTop";
import HomeCategoryGrid from "@/components/home/HomeCategoryGrid";
import MerchandisedRow from "@/components/home/MerchandisedRow";

import { useAuthStore } from "@/lib/authStore";
import { settingsService, FALLBACKS } from "@/lib/settingsService";

const WA_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";

// Local hero imagery. Local, not base64 — these are files the browser caches,
// never bytes compiled into the JS bundle.
const HERO_SLIDES = [
  "/images/hero/carry-bags.png",
  "/images/hero/corrugated-boxes.png",
  "/images/hero/food-containers.png",
  "/images/hero/meal-trays.png",
];

export default function Home() {
  const { isAuthenticated } = useAuthStore();

  const [hero, setHero] = useState(FALLBACKS.hero);
  const [trustPoints, setTrustPoints] = useState(FALLBACKS.trust_points);
  const [trustStats, setTrustStats] = useState(FALLBACKS.trust_stats);
  const [serviceAreas, setServiceAreas] = useState(FALLBACKS.service_areas);
  const [faqs, setFaqs] = useState(FALLBACKS.faqs);
  const [bulkBanner, setBulkBanner] = useState(FALLBACKS.bulk_banner);
  const [openFaq, setOpenFaq] = useState(-1);

  useEffect(() => {
    settingsService
      .getAllContent()
      .then(c => {
        setHero(c.hero);
        setTrustPoints(c.trust_points);
        setTrustStats(c.trust_stats);
        setServiceAreas(c.service_areas);
        setFaqs(c.faqs);
        setBulkBanner(c.bulk_banner);
      })
      .catch(() => {});
  }, []);

  const bulkQuoteHref = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    "Hi XL Traders, I need a bulk / custom order quote."
  )}`;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Header />

      <main className="flex-1 pb-24 md:pb-0">
        <HeroSlideshow hero={hero} slides={HERO_SLIDES} />

        {/* Owner-controlled slot. Renders NOTHING when unconfigured. */}
        <PromoBanners position="home_top" className="pt-6" />

        <HomeCategoryGrid />

        <MerchandisedRow
          eyebrow="New arrivals"
          title="Just added to the catalogue"
          sort="newest"
          href="/catalog?sort=newest"
          priority
        />

        <PromoBanners position="home_mid" className="py-2" />

        <MerchandisedRow
          eyebrow="Best sellers"
          title="Popular with Surat kitchens"
          featured
          href="/catalog"
        />

        {/* Sign-in hook — anonymous only. */}
        {!isAuthenticated && (
          <section className="container py-8">
            <div className="flex flex-col items-start gap-4 rounded-2xl bg-slate-900 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Lock size={20} className="mt-0.5 flex-shrink-0 text-white/70" />
                <div>
                  <div className="text-body-md font-bold text-white">
                    Sign in for your wholesale rates
                  </div>
                  <div className="text-body-sm text-slate-400">
                    See per-piece rates on every product and order on WhatsApp.
                  </div>
                </div>
              </div>
              <Link
                href="/auth"
                className="flex-shrink-0 rounded-xl px-5 py-3 text-body-sm font-bold text-white"
                style={{ background: "var(--xl-accent)" }}
              >
                Sign in
              </Link>
            </div>
          </section>
        )}

        {/* Why XL Traders — the single place trust content appears. */}
        <section className="container py-8 md:py-12">
          <SectionEyebrow>Why XL Traders</SectionEyebrow>
          <h2 className="mb-5 text-xl font-extrabold tracking-tight md:text-2xl">
            Built for businesses that reorder
          </h2>

          <div className="mb-5 grid divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            {trustStats.map(s => (
              <div key={s.label} className="p-5 text-center">
                <div
                  className="text-2xl font-extrabold tracking-tight"
                  style={{ color: "var(--xl-accent)" }}
                >
                  {s.value}
                </div>
                <div className="mt-0.5 text-body-sm font-semibold">{s.label}</div>
                <div className="mt-0.5 text-xs text-slate-500">{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {trustPoints.map(p => (
              <div
                key={p.title}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div
                  className="mb-2 grid h-8 w-8 place-items-center rounded-lg text-body-sm font-extrabold"
                  style={{
                    background: "var(--xl-accent-soft)",
                    color: "var(--xl-accent)",
                  }}
                >
                  {p.glyph}
                </div>
                <div className="text-body-sm font-bold">{p.title}</div>
                <div className="mt-1 text-body-sm text-slate-600">{p.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Bulk quote */}
        <section className="container pb-8 md:pb-12">
          <div className="flex flex-col items-start gap-4 rounded-2xl bg-slate-900 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <SectionEyebrow tone="dark">{bulkBanner.eyebrow}</SectionEyebrow>
              <div className="text-lg font-extrabold text-white">
                {bulkBanner.title}
              </div>
              <p className="mt-1 max-w-xl text-body-sm text-slate-400">
                {bulkBanner.body}
              </p>
            </div>
            <a
              href={bulkQuoteHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-body-sm font-bold text-white transition hover:bg-emerald-700"
            >
              <MessageCircle size={15} />
              Get a quote
            </a>
          </div>
        </section>

        {/* Service areas + FAQ */}
        <section className="container grid gap-6 pb-10 md:pb-16 lg:grid-cols-[320px_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <SectionEyebrow>Where we deliver</SectionEyebrow>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {serviceAreas.map(a => (
                <span
                  key={a}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-caption font-semibold text-slate-600"
                >
                  <MapPin size={10} />
                  {a}
                </span>
              ))}
            </div>
          </div>

          <div>
            <SectionEyebrow>FAQ</SectionEyebrow>
            <h2 className="mb-3 text-xl font-extrabold tracking-tight">
              Questions we get asked
            </h2>
            <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {faqs.map((f, i) => (
                <div key={f.q}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                    aria-expanded={openFaq === i}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-body-sm font-bold"
                  >
                    {f.q}
                    <span className="flex-shrink-0 text-slate-400">
                      {openFaq === i ? "−" : "+"}
                    </span>
                  </button>
                  {openFaq === i && (
                    <p className="px-4 pb-3 text-body-sm text-slate-600">{f.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <BackToTop />
      <Footer />
    </div>
  );
}
