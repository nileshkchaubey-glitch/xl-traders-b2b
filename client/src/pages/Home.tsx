import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Lock, MapPin, MessageCircle } from "lucide-react";

import SectionEyebrow from "@/components/SectionEyebrow";
import HeroSlideshow from "@/components/storefront/HeroSlideshow";
import PromoBanners from "@/components/storefront/PromoBanners";
import BackToTop from "@/components/storefront/BackToTop";
import HomeCategoryGrid from "@/components/home/HomeCategoryGrid";
import HomeSpotlightStrip from "@/components/home/HomeSpotlightStrip";
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
  const [bulkBanner, setBulkBanner] = useState(FALLBACKS.bulk_banner);

  useEffect(() => {
    settingsService
      .getAllContent()
      .then(c => {
        setHero(c.hero);
        setBulkBanner(c.bulk_banner);
      })
      .catch(() => {});
  }, []);

  const bulkQuoteHref = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    "Hi XL Traders, I need a bulk / custom order quote."
  )}`;

  return (
    <>
      <main className="flex-1 pb-24 md:pb-0">
        <HeroSlideshow hero={hero} slides={HERO_SLIDES} />

        {/* Owner-controlled slot. Renders NOTHING when unconfigured. */}
        <PromoBanners position="home_top" className="pt-6" />

        <HomeCategoryGrid />

        <HomeSpotlightStrip />

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
          wide
        />

        {/* Sign-in hook — anonymous only. */}
        {!isAuthenticated && (
          <section className="xl-shell pt-3.5 md:pt-[26px]">
            <div className="flex flex-col items-start gap-4 rounded-2xl bg-slate-900 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Lock
                  size={20}
                  className="mt-0.5 flex-shrink-0 text-white/70"
                />
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

        {/* Bulk quote */}
        <section className="xl-shell pt-3.5 md:pt-[26px]">
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
      </main>

      <BackToTop />
    </>
  );
}
