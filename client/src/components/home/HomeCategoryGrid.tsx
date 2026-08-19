import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Package } from "lucide-react";
import { categoryService } from "@/lib/productService";
import type { Category } from "@/lib/supabase";
import { normalizeImageUrl } from "@/lib/imageUtils";
import SectionEyebrow from "@/components/SectionEyebrow";

type LiveCategory = Category & { liveCount: number };

/**
 * Shop-by-category grid — 4 across on mobile, more on wider screens.
 *
 * ── The counting rule ────────────────────────────────────────────────────
 * Counts come from `categoryService.getLiveCategories`, which reads the
 * `v_category_live_counts` view. The rule (published AND active) lives in SQL,
 * in one place, and the service already drops zero-count categories — so this
 * component has no count logic and no zero guard of its own, and cannot
 * disagree with any other surface that shows a count.
 *
 * That filtering is not cosmetic: 17 of 38 active categories currently have no
 * live products, and one of them ("Burger & Sandwich Box") has two DRAFT
 * products, so a naive count over `products` would advertise "2 items" and
 * lead to an empty page.
 *
 * Images: real category images with a lucide icon layered UNDERNEATH, so a
 * missing or failed image reveals the icon with no JS toggling and no blank
 * tile.
 */
export default function HomeCategoryGrid() {
  const [categories, setCategories] = useState<LiveCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    categoryService
      .getLiveCategories()
      .then(c => !cancelled && setCategories(c))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing live to browse — render nothing rather than an empty section.
  if (!loading && categories.length === 0) return null;

  return (
    <section className="xl-shell py-8 md:py-12">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <SectionEyebrow>Shop by category</SectionEyebrow>
          <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">
            What are you stocking up on?
          </h2>
        </div>
        <Link
          href="/catalog"
          className="flex-shrink-0 text-body-sm font-bold"
          style={{ color: "var(--xl-accent)" }}
        >
          View all →
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-3 md:grid-cols-6 lg:grid-cols-8">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square rounded-xl bg-slate-100" />
                <div className="mx-auto mt-1.5 h-2.5 w-3/4 rounded bg-slate-100" />
              </div>
            ))
          : categories.map(c => (
              <Link
                key={c.id}
                href={`/catalog?category=${c.id}`}
                className="group block"
              >
                <div className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <div className="absolute inset-0 grid place-items-center">
                    <Package className="h-6 w-6 text-slate-300" aria-hidden />
                  </div>
                  {c.image_url && (
                    <img
                      src={normalizeImageUrl(c.image_url, 200)}
                      alt=""
                      aria-hidden
                      loading="lazy"
                      decoding="async"
                      className="relative h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
                      onError={e => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                </div>
                <div className="mt-1.5 text-center">
                  <div className="truncate text-[11px] font-bold leading-tight text-slate-800">
                    {c.name}
                  </div>
                  <div className="text-[10px] text-slate-500 tabular-nums">
                    {c.liveCount} item{c.liveCount !== 1 ? "s" : ""}
                  </div>
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
}
