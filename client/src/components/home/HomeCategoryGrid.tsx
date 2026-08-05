import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Box,
  Coffee,
  type LucideIcon,
  Package2,
  PartyPopper,
  Shapes,
  SprayCan,
} from "lucide-react";
import { categoryService } from "@/lib/productService";
import { displayName } from "@/lib/displayName";

/**
 * "Shop by department" — the first section of the page, since there is no hero
 * (docs/DESIGN_SYSTEM.md §3.3).
 *
 * Renders DEPARTMENTS (`categories.group_name`), not categories. It previously
 * rendered categories, which put "Round Container", "Rectangle Container",
 * "Rice Bowl" and "Premium Container" on the homepage as four separate
 * top-level choices — four ways of saying "containers" — while the department
 * they all belong to was never shown. Departments are the level a buyer
 * actually navigates by, and there are five of them rather than thirty-eight.
 *
 * (`group_name` is a text column repeated on every category row, which is why
 * this groups client-side. A real hierarchy table is proposed separately.)
 *
 * A tile is a hairline rule, an icon, a name and a live product count. No
 * image: a category carries at most one, and the old design composited it into
 * a fake 2×2 mosaic that showed the same photo four times.
 * (Category images ARE still used — as tier 2 of the product image fallback.)
 */

// One icon per department. This is a small, closed list — unlike the previous
// keyword matcher, which collapsed "Round Container", "Rice Bowl" and
// "Premium Container" all onto the same box glyph because they genuinely all
// match /container|bowl/. Departments are distinct by construction, so their
// icons can be too.
const DEPARTMENT_ICONS: [RegExp, LucideIcon][] = [
  [/container/i, Package2],
  [/tableware|takeaway|cup|glass/i, Coffee],
  [/packaging|presentation|box|wrap|foil/i, Box],
  [/hygiene|clean|facility|care/i, SprayCan],
  [/decor|party|balloon/i, PartyPopper],
];

function iconFor(name: string): LucideIcon {
  for (const [pattern, Icon] of DEPARTMENT_ICONS) {
    if (pattern.test(name)) return Icon;
  }
  return Shapes;
}

interface Department {
  name: string;
  order: number;
  liveProducts: number;
}

export default function HomeCategoryGrid() {
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    let alive = true;

    Promise.all([categoryService.getAll(), categoryService.getPublicCounts()])
      .then(([cats, counts]) => {
        if (!alive) return;

        const byName = new Map<string, Department>();
        for (const c of cats) {
          const key = c.group_name?.trim();
          // A category with no group can't be placed under a department. It is
          // skipped rather than invented into an "Other" bucket — that is the
          // data gap the hierarchy proposal exists to close.
          if (!key) continue;
          const dept =
            byName.get(key) ??
            byName
              .set(key, {
                name: key,
                order: c.group_order ?? 999,
                liveProducts: 0,
              })
              .get(key)!;
          dept.liveProducts += counts[c.id] ?? 0;
          dept.order = Math.min(dept.order, c.group_order ?? 999);
        }

        setDepartments(
          [...byName.values()]
            // Never render a department that opens onto an empty page.
            // "Decoration & Party" has 34 categories and 1 live product;
            // most of its categories have none at all.
            .filter(d => d.liveProducts > 0)
            .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
        );
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  if (departments.length === 0) return null;

  return (
    <section className="shell pt-7 md:pt-11">
      <h2 className="font-display text-display md:text-display-lg font-bold text-ink tracking-[-0.03em]">
        Shop by department
      </h2>

      <div className="mt-5 md:mt-[18px] grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-[18px] gap-y-[22px] lg:gap-x-[22px] lg:gap-y-7">
        {departments.map(dept => {
          const Icon = iconFor(dept.name);
          return (
            <Link
              key={dept.name}
              href={`/catalog?group=${encodeURIComponent(dept.name)}`}
              className="group flex flex-col gap-3 lg:gap-[15px] border-t border-rule pt-3.5 lg:pt-4"
            >
              <Icon
                size={20}
                className="text-red-600 flex-none lg:w-6 lg:h-6"
                strokeWidth={1.75}
              />
              <div>
                <span className="block text-body-sm lg:text-base font-medium text-ink group-hover:text-red-600 transition-colors duration-150">
                  {displayName(dept.name)}
                </span>
                <span className="block font-mono text-meta text-ink-faint mt-1 tabular-nums">
                  {dept.liveProducts}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
