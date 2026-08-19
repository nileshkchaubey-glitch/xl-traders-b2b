import { useEffect, useState } from "react";

import { settingsService, FALLBACKS } from "@/lib/settingsService";

/**
 * Mobile location bar — the red strip above the search.
 *
 * Ported from `design-reference/xl-traders-storefront.source.dc.html`
 * (mobile shell, top of the phone frame). Layout, spacing, type sizes and
 * colours are the prototype's values verbatim, per the design-first rule:
 * where the shipped build and the prototype disagree on layout, the prototype
 * wins.
 *
 * ⚠️ Deliberate deviation from DESIGN_SYSTEM §1.2, flagged not hidden. That
 * section replaced ~90 arbitrary `text-[Npx]` values with the four type-scale
 * tokens. The prototype's 12 / 9.5 / 10.5px are none of caption(11) /
 * body-sm(13) / body-md(15), so matching it means arbitrary values here. Design
 * fidelity was made the priority explicitly; this is that instruction applied,
 * not an oversight.
 *
 * CONTENT is NOT ported. The prototype is sample data:
 *   · its pincode reads 395010 — the real one is 394221 (owner-confirmed)
 *   · its second line is `'Freight ' + {{FREIGHT_RULE}}` — the owner ruled out
 *     any freight claim, so the line is DROPPED, not filled. What renders
 *     instead is the dispatch promise, from the same `announcement` row the
 *     desktop utility bar reads, so the two breakpoints cannot disagree.
 *
 * This bar is also why the mobile gap existed at all: the desktop utility bar
 * carrying GST / dispatch / hours is `hidden md:block`, so before this, a phone
 * visitor saw none of it.
 */
export default function LocationBar() {
  const [announcement, setAnnouncement] = useState(FALLBACKS.announcement);

  const phone1 = import.meta.env.VITE_PHONE_1 || "9773239442";
  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";

  useEffect(() => {
    settingsService
      .getContent("announcement")
      .then(setAnnouncement)
      .catch(() => {});
  }, []);

  const quoteHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    "Hi XL Traders, I need a bulk / custom order quote."
  )}`;

  return (
    <div className="flex items-center gap-[9px] bg-red-600 px-3.5 py-[9px] text-white md:hidden">
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        className="flex-shrink-0"
        aria-hidden
      >
        <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.4" />
      </svg>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-bold">
          {announcement.deliverTo}
        </div>
        {/* The prototype puts a freight claim here. Dropped deliberately —
            this is the dispatch promise instead, from the one announcement
            row the desktop bar also reads. */}
        <div className="truncate text-[9.5px] font-medium opacity-[0.88]">
          {announcement.deliveryLine}
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1.5">
        <a
          href={`tel:${phone1}`}
          aria-label="Call XL Traders"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/[0.16]"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            aria-hidden
          >
            <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8.1 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2z" />
          </svg>
        </a>

        <a
          href={`https://wa.me/${whatsappNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Message XL Traders on WhatsApp"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-emerald-600"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.3A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5 0-2.3-.3-4.4-2.2s-2.5-3.4-2.6-4-.1-1.3.3-1.8c.3-.4.6-.5.8-.5h.6c.2 0 .4 0 .6.5l.7 1.7c.1.2.1.4 0 .6l-.4.5c-.2.2-.3.3-.1.6.2.4.8 1.2 1.4 1.7.8.7 1.3.9 1.6 1 .2.1.4 0 .5-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.3.1.4.2.4.4v.6z" />
          </svg>
        </a>

        <a
          href={quoteHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[30px] items-center whitespace-nowrap rounded-full bg-emerald-600 px-[11px] text-[10.5px] font-extrabold text-white"
        >
          Quote
        </a>
      </div>
    </div>
  );
}
