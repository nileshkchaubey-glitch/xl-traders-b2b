import { useEffect, useState } from "react";
import { Link } from "wouter";
import { MapPin, Menu } from "lucide-react";

import { settingsService, FALLBACKS } from "@/lib/settingsService";

/**
 * The desktop category nav bar — the red row under the header.
 *
 * Ported from `design-reference/xl-traders-storefront.source.dc.html` (desktop
 * shell, "category nav"). This was MISSING from the structural diff entirely:
 * it only surfaced once the standalone prototype was rendered in a browser and
 * compared against our page, rather than read as markup. Reading found the
 * grids; rendering found the whole missing row.
 *
 * Prototype values:
 *   bar          bg #dc2626 · padding 0 28px · gap 26px
 *   "All ..."    bg #b91c1c · padding 12px 16px · 12.5px / 800 · gap 9px
 *   nav items    #fff · 12.5px / 600 · padding 12px 0
 *   deliver-to   margin-left auto · 11.5px / 600 · white 90%
 *
 * The deliver-to line makes this the DESKTOP counterpart of the mobile
 * LocationBar, reading the same `announcement` row, so the two breakpoints
 * cannot state different things.
 *
 * "Offers zone" is in the prototype's nav and is NOT here. It points at a
 * surface this site does not have, and a nav entry that leads nowhere is the
 * dead-link defect that dropping "Why XL Traders" just created in the footer.
 * It goes in when an offers surface exists.
 *
 * Token note: the nav's 12.5px and the deliver-to's 11.5px are carried by
 * `text-product-name-lg` and `text-product-name`. The VALUES are exact; the
 * NAMES read oddly on a nav, because the role scale derived in #170 has no
 * nav/control role — the prototype sizes nav text the same as a product name.
 * Recorded rather than minting a token for one component, same call as the
 * guest price prompt and the spotlight tile.
 */
export default function DesktopCategoryNav() {
  const [announcement, setAnnouncement] = useState(FALLBACKS.announcement);

  useEffect(() => {
    settingsService
      .getContent("announcement")
      .then(setAnnouncement)
      .catch(() => {});
  }, []);

  const items = [
    { label: "Home", href: "/" },
    { label: "Best sellers", href: "/catalog" },
    { label: "New arrivals", href: "/catalog?sort=newest" },
    { label: "My account", href: "/account" },
  ];

  return (
    <div className="relative z-[55] hidden items-center gap-[26px] bg-red-600 px-7 lg:flex">
      <Link
        href="/categories"
        className="-mr-[20px] flex items-center gap-[9px] bg-red-700 px-4 py-3 text-product-name-lg font-extrabold text-white"
      >
        <Menu size={15} strokeWidth={2.4} />
        All categories
      </Link>

      {items.map(i => (
        <Link
          key={i.label}
          href={i.href}
          className="py-3 text-product-name-lg font-semibold text-white transition hover:text-white/80"
        >
          {i.label}
        </Link>
      ))}

      <div className="ml-auto flex items-center gap-[7px] text-product-name font-semibold text-white/90">
        <MapPin size={13} strokeWidth={2.2} />
        {announcement.deliverTo}
      </div>
    </div>
  );
}
