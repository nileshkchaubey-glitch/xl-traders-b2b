import { useEffect, useState } from "react";

import HeroSlideshow from "@/components/storefront/HeroSlideshow";
import PromoBanners from "@/components/storefront/PromoBanners";
import BackToTop from "@/components/storefront/BackToTop";
import HomeCategoryGrid from "@/components/home/HomeCategoryGrid";
import HomeSpotlightStrip from "@/components/home/HomeSpotlightStrip";
import MerchandisedRow from "@/components/home/MerchandisedRow";

import { settingsService, FALLBACKS } from "@/lib/settingsService";

// Local hero imagery. Local, not base64 — these are files the browser caches,
// never bytes compiled into the JS bundle.
const HERO_SLIDES = [
  "/images/hero/carry-bags.png",
  "/images/hero/corrugated-boxes.png",
  "/images/hero/food-containers.png",
  "/images/hero/meal-trays.png",
];

export default function Home() {
  const [hero, setHero] = useState(FALLBACKS.hero);

  useEffect(() => {
    settingsService
      .getAllContent()
      .then(c => {
        setHero(c.hero);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <main className="flex-1 pb-24 md:pb-0">
        <HeroSlideshow hero={hero} slides={HERO_SLIDES} />

        {/* Owner-controlled slot. Renders NOTHING when unconfigured. */}
        <PromoBanners position="home_top" className="pt-6" />

        <HomeCategoryGrid />

        <HomeSpotlightStrip />

        <PromoBanners position="home_mid" className="py-2" />

        <MerchandisedRow
          eyebrow="New arrivals"
          title="Just added to the catalogue"
          sort="newest"
          href="/catalog?sort=newest"
          priority
        />

        <MerchandisedRow
          eyebrow="Best sellers"
          title="Popular with Surat kitchens"
          featured
          href="/catalog"
          wide
        />
      </main>

      <BackToTop />
    </>
  );
}
