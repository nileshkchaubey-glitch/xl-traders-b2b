import { useEffect, useState } from "react";

import { settingsService, FALLBACKS } from "@/lib/settingsService";

/**
 * The footer — ONE slim row, DESKTOP ONLY.
 *
 * Ported from `design-reference/xl-traders-storefront.source.dc.html`. The
 * prototype's footer is a single flex row that wraps, not the four-column
 * block this used to be:
 *
 *   bg #0f172a · padding 22px 28px · gap 22px · row-gap 10px · wrap
 *   "XL TRADERS" 16px/800, XL in #ef4444
 *   point labels 11.5px/600 #94a3b8
 *   contact, pushed right, 11.5px/600 #64748b
 *
 * There is NO mobile footer, verified by rendering the prototype in mobile
 * mode: it has none at all. The bottom nav replaces it, and the detail that
 * used to justify a mobile footer stub (#165 — address, email, GST terms)
 * lives on the Account screen, which is where the prototype puts it.
 *
 * That retires the mobile stub #165 built. On a phone this row wrapped into a
 * cramped four-line block that collided with the back-to-top button — the
 * owner caught it on screen. The fix is not to tune the wrap; it is that the
 * row should not be there.
 *
 * LAYOUT is the prototype's. CONTENT is ours: the prototype's four labels are
 * feature names ("Per-piece rates", "Quick reorder"), while `footer.ordering`
 * carries the owner's real terms — dispatch tiers, GST invoice, WhatsApp
 * ordering. Those are the items #165 established have no other home on mobile,
 * so they occupy the same slot rather than being replaced by sample copy.
 *
 * The contact slot carries address · phone · EMAIL. The prototype shows only
 * address and phone; email is added because it is otherwise reachable only
 * from Account, and a desktop visitor should not have to go there for it.
 */
export default function Footer() {
  const email = import.meta.env.VITE_EMAIL || "xltraders990@gmail.com";
  const phone1 = import.meta.env.VITE_PHONE_1 || "9773239442";
  const currentYear = new Date().getFullYear();

  const [footer, setFooter] = useState(FALLBACKS.footer);

  useEffect(() => {
    settingsService
      .getContent("footer")
      .then(setFooter)
      .catch(() => {});
  }, []);

  return (
    <footer className="mt-auto hidden bg-slate-900 lg:block">
      <div className="flex flex-wrap items-center gap-x-[22px] gap-y-2.5 px-7 py-[22px]">
        <div className="text-heading-row-lg font-extrabold tracking-tight text-white">
          <span className="text-red-500">XL</span> TRADERS
        </div>

        {footer.ordering.map(line => (
          <div
            key={line}
            className="text-product-name font-semibold text-slate-400"
          >
            {line}
          </div>
        ))}

        <div className="ml-auto text-product-name font-semibold text-slate-500">
          {footer.address} ·{" "}
          <a href={`tel:${phone1}`} className="hover:text-slate-300">
            +91 {phone1}
          </a>{" "}
          ·{" "}
          <a href={`mailto:${email}`} className="hover:text-slate-300">
            {email}
          </a>
          <span className="ml-[22px]">© {currentYear}</span>
        </div>
      </div>
    </footer>
  );
}
