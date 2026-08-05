import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Box,
  Coffee,
  Gift,
  Layers,
  type LucideIcon,
  Package,
  Package2,
  Printer,
  ShoppingBag,
  Sparkles,
  Utensils,
  Wind,
} from "lucide-react";
import { categoryService } from "@/lib/productService";
import { Category } from "@/lib/supabase";

/**
 * "Shop by category" — the first section of the page, since there is no hero
 * (docs/DESIGN_SYSTEM.md §3.3).
 *
 * A tile is a hairline rule, an icon and a name. That is the whole tile.
 *
 * No image: a category carries at most ONE image_url, and the previous design
 * composited it into a fake 2×2 mosaic that rendered the same photo four times
 * at 220% zoom. Rather than fix the mosaic, the locked design drops category
 * imagery from this section entirely — the icons identify an aisle faster than
 * a zoomed crop of a black container does, and they cannot break.
 *
 * (Category images are NOT unused: they are tier 2 of the product image
 * fallback chain — see ProductImageSlot.)
 */

// Keyword → icon, so "Cups & Glasses" gets a cup rather than whatever the
// rotation happened to land on. First match wins; unmatched categories fall
// back to a stable per-index icon so the set never looks random on reload.
const ICON_KEYWORDS: [RegExp, LucideIcon][] = [
  [/cup|glass|mug|beverage/i, Coffee],
  [/tray|box|carton|corrugat/i, Box],
  [/container|jar|bowl|wati/i, Package2],
  [/foil|wrap|film|cling|roll/i, Layers],
  [/tissue|napkin|glove|cap|hygien/i, Wind],
  [/party|decor|balloon|gift/i, Gift],
  [/clean|detergent|soap|wash/i, Sparkles],
  [/bag|pouch|carry|kirana/i, ShoppingBag],
  [/cutler|spoon|fork|plate|catering/i, Utensils],
  [/paper|print|label/i, Printer],
];

const FALLBACK_ICONS: LucideIcon[] = [
  Package2,
  Box,
  Package,
  Layers,
  ShoppingBag,
  Coffee,
];

function iconFor(name: string, index: number): LucideIcon {
  for (const [pattern, Icon] of ICON_KEYWORDS) {
    if (pattern.test(name)) return Icon;
  }
  return FALLBACK_ICONS[index % FALLBACK_ICONS.length];
}

// The homepage section is a taster, not the index — /catalog is the index.
// 6 tiles on mobile keeps the rate card within reach of the first scroll;
// desktop shows 12 because a 6-up row of 6 leaves an empty second row.
const MOBILE_TILES = 6;
const DESKTOP_TILES = 12;

export default function HomeCategoryGrid() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    // getAll() already filters to is_active and sorts by display_order, which
    // is the owner's own ordering — the honest signal for "which first".
    categoryService
      .getAll()
      .then(c => setCategories(c.slice(0, DESKTOP_TILES)))
      .catch(() => {});
  }, []);

  if (categories.length === 0) return null;

  return (
    <section className="shell pt-7 md:pt-11">
      <h2 className="font-display text-display md:text-display-lg font-bold text-ink tracking-[-0.03em]">
        Shop by category
      </h2>

      <div className="mt-5 md:mt-[18px] grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-[18px] gap-y-[22px] lg:gap-x-[22px] lg:gap-y-7">
        {categories.map((cat, i) => {
          const Icon = iconFor(cat.name, i);
          return (
            <Link
              key={cat.id}
              href={`/catalog?category=${cat.slug}`}
              className={`group flex flex-col gap-3 lg:gap-[15px] border-t border-rule pt-3.5 lg:pt-4 ${
                // Tiles past the 6th exist only from md up — at 390 they would
                // push the first product price another screen down.
                i >= MOBILE_TILES ? "hidden md:flex" : ""
              }`}
            >
              <Icon
                size={20}
                className="text-red-600 flex-none lg:w-6 lg:h-6"
                strokeWidth={1.75}
              />
              <span className="text-body-sm lg:text-base font-medium text-ink group-hover:text-red-600 transition-colors duration-150">
                {cat.name}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
