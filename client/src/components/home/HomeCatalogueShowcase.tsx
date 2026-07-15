import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight, MessageCircle } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import SectionEyebrow from "@/components/SectionEyebrow";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryService, productService } from "@/lib/productService";
import { Product } from "@/lib/supabase";

// Home-page catalogue taster (docs/STOREFRONT_DESIGN_PROPOSALS.md §3):
// category filter chips + a small ProductCard grid that swaps on chip tap.
// Deliberately NOT a second catalogue — one paginated fetch per chip
// (productService.getAll, the exact call /catalog uses), capped at
// PRODUCTS_PER_VIEW, always ending in a "View all" link into /catalog.
//
// 10 products = two rows of 5 at the widest catalog breakpoint; mobile
// shows the first 6 (three rows of 2) via CSS so no second query is needed.
const PRODUCTS_PER_VIEW = 10;
const MOBILE_VISIBLE = 6;
// Chips beyond "All": group chips when group_names exist, else the first
// flat categories (a taster doesn't need every category — /catalog does).
const MAX_CHIPS = 8;

interface Chip {
  label: string;
  categoryIds: string[]; // products filter for this chip
  href: string; // where "View all" points while this chip is active
}

export default function HomeCatalogueShowcase({
  whatsappNumber,
}: {
  whatsappNumber: string;
}) {
  const [chips, setChips] = useState<Chip[]>([]);
  // null = "All" — no category filter applied.
  const [activeChip, setActiveChip] = useState<Chip | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  // Group chips when the catalogue has group_names (the live DB does);
  // flat category chips otherwise so the section never renders chipless.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const groups = await categoryService.getCategoriesGroupedByGroup();
        if (cancelled) return;
        if (groups.length > 0) {
          setChips(
            groups.slice(0, MAX_CHIPS).map(g => ({
              label: g.group_name,
              categoryIds: g.categories.map(c => c.id),
              href: `/catalog?group=${encodeURIComponent(g.group_name)}`,
            }))
          );
          return;
        }
        const cats = await categoryService.getAll();
        if (cancelled) return;
        setChips(
          cats.slice(0, MAX_CHIPS).map(c => ({
            label: c.name,
            categoryIds: [c.id],
            href: `/catalog?category=${c.slug}`,
          }))
        );
      } catch {
        /* chips are a nicety — the grid still renders with "All" */
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-fetch on chip change — same server-side paginated call the Catalog
  // page makes (published+active only, price columns gated for guests).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const ids = activeChip?.categoryIds ?? [];
    productService
      .getAll({
        // Empty chip → fall back to all products (mirrors Catalog's
        // buildFilters behaviour for a group with no categories yet).
        ...(ids.length ? { categoryIds: ids } : {}),
        sort: "newest",
        page: 1,
        pageSize: PRODUCTS_PER_VIEW,
      })
      .then(rows => {
        if (!cancelled) setProducts(rows);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeChip]);

  const viewAllHref = activeChip?.href ?? "/catalog";
  const viewAllLabel = activeChip
    ? `View all in ${activeChip.label}`
    : "View full catalogue";

  // Same responsive columns as the Catalog grid so the taster and the real
  // page feel like one system. Items past MOBILE_VISIBLE are hidden below md.
  const gridClass =
    "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4";

  return (
    <section className="py-12 md:py-16 bg-slate-50">
      <div className="container">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
          <div>
            <SectionEyebrow className="mb-1">Our Products</SectionEyebrow>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
              Shop the Catalogue
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Tap a category to preview — fresh stock added weekly
            </p>
          </div>
          <Link
            href="/catalog"
            className="hidden sm:inline-flex items-center gap-1 text-red-600 font-semibold text-sm hover:text-red-700 transition shrink-0"
          >
            View full catalogue <ArrowRight size={15} />
          </Link>
        </div>

        {/* Category chips — horizontal scroll on mobile, same visual language
            as the Catalog page's group chips */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          <button
            onClick={() => setActiveChip(null)}
            className={`flex-shrink-0 h-10 px-3.5 rounded-full text-body-sm font-semibold border-[1.5px] transition ${
              activeChip === null
                ? "bg-red-50 text-red-600 border-red-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-red-300"
            }`}
          >
            All
          </button>
          {chips.map(chip => (
            <button
              key={chip.label}
              onClick={() => setActiveChip(chip)}
              className={`flex-shrink-0 h-10 px-3.5 rounded-full text-body-sm font-semibold border-[1.5px] transition ${
                activeChip?.label === chip.label
                  ? "bg-red-50 text-red-600 border-red-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-red-300"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Product grid — loading / empty / results. The whole ternary lives
            inside ONE always-mounted AnimatePresence keyed by chip, so the
            exit-then-enter crossfade actually plays on chip switches (a
            branch-level AnimatePresence would be unmounted by the loading
            branch before its exit transition could run). */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeChip?.label ?? "all"}
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -8 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.25 }}
          >
            {loading ? (
              <div className={gridClass}>
                {Array.from({ length: PRODUCTS_PER_VIEW }).map((_, i) => (
                  <div
                    key={i}
                    className={i >= MOBILE_VISIBLE ? "hidden md:block" : ""}
                  >
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                      <Skeleton className="aspect-square rounded-none" />
                      <div className="p-3 space-y-2">
                        <Skeleton className="h-3 w-1/3" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-9 w-full rounded-lg" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
                <p className="text-slate-600 font-semibold mb-1">
                  More arriving here soon
                </p>
                <p className="text-slate-500 text-sm mb-4">
                  We probably stock it — ask us directly and we'll add it to
                  your order.
                </p>
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                    activeChip
                      ? `Hi XL Traders, what do you have in ${activeChip.label}?`
                      : "Hi XL Traders, I'm looking for a product — can you help?"
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-body-sm font-semibold hover:bg-emerald-700 transition"
                >
                  <MessageCircle size={14} />
                  Ask on WhatsApp
                </a>
              </div>
            ) : (
              <div className={gridClass}>
                {products.map((product, i) => (
                  <div
                    key={product.id}
                    className={i >= MOBILE_VISIBLE ? "hidden md:block" : ""}
                  >
                    <ProductCard product={product} view="grid" />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Taster guardrail — always route into the real catalogue */}
        <div className="text-center mt-7">
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-2 bg-white border-[1.5px] border-slate-200 text-slate-900 px-5 py-2.5 rounded-xl text-body-sm font-bold hover:border-red-600 hover:text-red-600 transition"
          >
            {viewAllLabel}
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}
