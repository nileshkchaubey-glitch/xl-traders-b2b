import { useEffect, useState } from "react";
import { Link } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HomeCategoryGrid from "@/components/home/HomeCategoryGrid";
import HomeDailySuggestion from "@/components/home/HomeDailySuggestion";
import ProductCard from "@/components/ProductCard";
import SeriesCard from "@/components/SeriesCard";
import { productService } from "@/lib/productService";
import { masterService } from "@/lib/masterService";
import { useAuthStore } from "@/lib/authStore";
import {
  collapseSeries,
  takeEntries,
  type ListingEntry,
} from "@/lib/seriesModel";
import { useCategoryImages } from "@/hooks/useCategoryImages";

/**
 * Home — Direction B, "Rate Card" (docs/DESIGN_SYSTEM.md §2).
 *
 * There is NO hero. The structure is:
 *
 *   logo + search  →  categories  →  the rate card  →  footer
 *
 * The delivery promise is one small factual line under the search field (in
 * Header), not a headline. No countdown, no stat counters, no big claim, no
 * trust strip, no marquee, no FAQ accordion, no bulk banner, no sign-in nag.
 * A wholesale buyer arrives knowing what they want; the fastest thing this
 * page can do is show them prices.
 *
 * The rate card is a taster of the real catalogue, fed by the same paginated
 * `productService.getAll` call /catalog uses — 12 entries, which is also the
 * count that decides whether the watermark fallback works at 390px.
 *
 * Entries, not products: variants of one series collapse into a single card
 * (lib/seriesModel.ts). The "Hinged box" series alone has ten live variants,
 * which used to fill this entire first screen with the same name and the same
 * photo ten times over.
 */

const RATE_CARD_SIZE = 12;

// Collapsing only ever reduces the count, so to end up with 12 entries we have
// to ask for more than 12 products. 48 covers a series far larger than any that
// exists (the biggest today is 11) without fetching the whole catalogue.
const FETCH_SIZE = 48;

export default function Home() {
  const isDev = import.meta.env.DEV;
  const { isAuthenticated } = useAuthStore();
  const [entries, setEntries] = useState<ListingEntry[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const categoryImages = useCategoryImages();

  useEffect(() => {
    let alive = true;

    Promise.all([
      productService.getAll({ page: 1, pageSize: FETCH_SIZE, sort: "newest" }),
      masterService.getPublicMasters(),
    ])
      .then(([products, masters]) => {
        if (!alive) return;
        setEntries(
          takeEntries(
            collapseSeries(products, masters, isAuthenticated),
            RATE_CARD_SIZE
          )
        );
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));

    productService
      .countPublished()
      .then(n => alive && setTotal(n))
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-white flex flex-col text-ink">
      <Header productCount={total ?? undefined} />

      {/* pb clears the fixed bottom nav + cart bar on mobile. */}
      <main className="flex-1 pb-28 md:pb-24">
        <HomeCategoryGrid />

        {/* ── THE RATE CARD ── */}
        <section className="shell pt-7 md:pt-11">
          <div className="flex items-baseline justify-between gap-4 border-t-2 border-ink pt-[18px] md:pt-[26px]">
            <h2 className="font-display text-display md:text-display-lg font-bold text-ink tracking-[-0.03em] whitespace-nowrap">
              The rate card
            </h2>
            {total != null && (
              <span className="font-mono text-micro md:text-body-sm font-medium text-ink-faint whitespace-nowrap tabular-nums">
                {total.toLocaleString("en-IN")} SKUs
              </span>
            )}
          </div>

          {loading ? (
            // Placeholder rows match the item's own rhythm (figure, name, rule)
            // so the page doesn't reflow when the real products land.
            <div className="mt-4 md:mt-5 grid grid-cols-2 lg:grid-cols-4 gap-x-[18px] gap-y-[26px] lg:gap-x-[30px] lg:gap-y-10">
              {Array.from({ length: RATE_CARD_SIZE }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-9 md:h-12 bg-sunken" />
                  <div className="h-3 bg-sunken mt-3 w-3/4" />
                  <div className="h-0.5 bg-rule mt-3" />
                  <div className="h-6 bg-sunken mt-3 w-1/2" />
                  <div className="h-[38px] md:h-[46px] bg-sunken mt-4" />
                </div>
              ))}
            </div>
          ) : entries.length > 0 ? (
            <div className="mt-4 md:mt-5 grid grid-cols-2 lg:grid-cols-4 gap-x-[18px] gap-y-[26px] lg:gap-x-[30px] lg:gap-y-10">
              {entries.map(entry =>
                entry.kind === "series" ? (
                  <SeriesCard
                    key={entry.id}
                    entry={entry}
                    categoryImageUrl={
                      categoryImages[entry.leadVariant.category_id]
                    }
                  />
                ) : (
                  <ProductCard
                    key={entry.id}
                    product={entry.product}
                    categoryImageUrl={categoryImages[entry.product.category_id]}
                  />
                )
              )}
            </div>
          ) : (
            <p className="mt-5 text-body-sm text-ink-muted">
              No products are published yet.
            </p>
          )}

          <Link
            href="/catalog"
            className="block border-t-2 border-ink mt-[26px] md:mt-11 pt-3.5 md:pt-[18px] text-body-md md:text-[17px] font-semibold text-ink hover:text-red-600 transition-colors duration-150"
          >
            See all {total != null ? total.toLocaleString("en-IN") : ""}{" "}
            products →
          </Link>
        </section>

        {/* Daily improvement suggestions — dev mode only */}
        {isDev && <HomeDailySuggestion />}
      </main>

      <Footer />
    </div>
  );
}
