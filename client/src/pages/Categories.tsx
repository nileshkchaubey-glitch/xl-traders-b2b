import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Package } from "lucide-react";

import BackToTop from "@/components/storefront/BackToTop";
import SectionEyebrow from "@/components/SectionEyebrow";
import { categoryService, type CategoryGroup } from "@/lib/productService";
import { normalizeImageUrl } from "@/lib/imageUtils";

/**
 * The full category index — the destination for the "Categories" tab.
 *
 * Grouped by `group_name`, and every count comes from
 * `getCategoriesGroupedByGroup`, which is built on `getLiveCategories`. So a
 * category with no published products cannot appear here any more than it can
 * on the home grid — one rule, one source, no per-page guard.
 */
export default function Categories() {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [flat, setFlat] = useState<
    Awaited<ReturnType<typeof categoryService.getLiveCategories>>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      categoryService.getCategoriesGroupedByGroup(),
      categoryService.getLiveCategories(),
    ])
      .then(([g, f]) => {
        if (cancelled) return;
        setGroups(g);
        setFlat(f);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Groups are preferred; the flat list is the fallback for a catalogue whose
  // categories have no group_name yet.
  const sections: { title: string | null; items: typeof flat }[] = groups.length
    ? groups.map(g => ({
        title: g.group_name,
        items: flat.filter(c => g.categories.some(gc => gc.id === c.id)),
      }))
    : [{ title: null, items: flat }];

  return (
    <>
      <main className="flex-1 pb-24 md:pb-10">
        <div className="xl-shell py-6">
          <h1 className="mb-1 text-2xl font-extrabold tracking-tight">
            All categories
          </h1>
          <p className="mb-6 text-body-sm text-slate-500">
            Everything we currently stock, grouped by department.
          </p>

          {loading ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square rounded-xl bg-slate-100" />
                  <div className="mx-auto mt-1.5 h-2.5 w-3/4 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : sections.every(s => s.items.length === 0) ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <div className="text-base font-bold">
                No categories to show yet
              </div>
            </div>
          ) : (
            sections
              .filter(s => s.items.length > 0)
              .map(section => (
                <section key={section.title ?? "all"} className="mb-8">
                  {section.title && (
                    <SectionEyebrow>{section.title}</SectionEyebrow>
                  )}
                  <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                    {section.items.map(c => (
                      <Link
                        key={c.id}
                        href={`/catalog?category=${c.id}`}
                        className="group block"
                      >
                        <div className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          <div className="absolute inset-0 grid place-items-center">
                            <Package
                              className="h-6 w-6 text-slate-300"
                              aria-hidden
                            />
                          </div>
                          {c.image_url && (
                            <img
                              src={normalizeImageUrl(c.image_url, 240)}
                              alt=""
                              aria-hidden
                              loading="lazy"
                              decoding="async"
                              className="relative h-full w-full object-cover motion-safe:transition-transform motion-safe:group-hover:scale-105"
                              onError={e => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          )}
                        </div>
                        <div className="mt-1.5 text-center">
                          <div className="truncate text-[11.5px] font-bold leading-tight">
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
              ))
          )}
        </div>
      </main>
      <BackToTop />
    </>
  );
}
