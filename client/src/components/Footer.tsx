import { useEffect, useState } from "react";
import { Link } from "wouter";
import { categoryService } from "@/lib/productService";
import { settingsService, FALLBACKS } from "@/lib/settingsService";

interface FooterLink {
  label: string;
  href: string;
}

// Shown only if the DB has no grouped categories yet (keeps the footer populated).
const FALLBACK_CATEGORY_LINKS: FooterLink[] = [
  {
    label: "Food Packaging",
    href: "/catalog?group=Disposal%20%26%20Food%20Packaging",
  },
  { label: "Cleaning Supplies", href: "/catalog?group=Cleaning" },
  { label: "Decoration & Party", href: "/catalog?group=Decoration" },
  { label: "Packaging", href: "/catalog?group=Packaging" },
];

/**
 * MOBILE vs DESKTOP — why the mobile footer is a stub.
 *
 * On mobile a fixed 5-tab bottom nav (Home / Categories / Search / Cart /
 * Account) is always on screen, and the header carries call + WhatsApp buttons.
 * The full footer rendered on top of that was 880px tall — taller than an
 * 812px viewport — with 13 links, and the fixed 65px nav covered its last row.
 *
 * Each block was audited against what mobile ALREADY reaches:
 *
 *   brand lockup      -> header logo, on every page          DROP
 *   description       -> marketing; the Home hero says it    DROP
 *   phone link        -> header call button (md:hidden pair) DROP
 *   Categories column -> Categories tab                      DROP
 *   Company column    -> Home tab / Categories / header
 *                        WhatsApp / Account tab (all four)   DROP
 *   address           -> nowhere else                        KEEP
 *   email             -> nowhere else (header has phone and
 *                        WhatsApp, not email)                KEEP
 *   ordering terms    -> nowhere else on mobile: the header's
 *                        utility bar carrying GST/hours is
 *                        `hidden md:block`                   KEEP
 *   copyright/tagline -> nowhere else                        KEEP
 *
 * So it is REDUCED, not hidden: hiding it entirely would leave a B2B buyer with
 * no route to the company's address, email or GST/dispatch terms on the device
 * most of them use.
 *
 * One component tree, Tailwind breakpoints only — no `useIsMobile` fork.
 */
export default function Footer() {
  const email = import.meta.env.VITE_EMAIL || "xltraders990@gmail.com";
  const phone1 = import.meta.env.VITE_PHONE_1 || "9773239442";
  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";
  const currentYear = new Date().getFullYear();

  const [footer, setFooter] = useState(FALLBACKS.footer);
  const [categoryLinks, setCategoryLinks] = useState<FooterLink[]>(
    FALLBACK_CATEGORY_LINKS
  );

  useEffect(() => {
    settingsService
      .getContent("footer")
      .then(setFooter)
      .catch(() => {});

    // Category quick-links come from the real category groups, not hardcoded.
    categoryService
      .getCategoriesGroupedByGroup()
      .then(groups => {
        if (groups.length > 0) {
          setCategoryLinks(
            groups.map(g => ({
              label: g.group_name,
              href: `/catalog?group=${encodeURIComponent(g.group_name)}`,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  return (
    <footer className="mt-auto bg-slate-900 text-slate-400">
      {/* ── Mobile: only what the bottom nav and header do NOT provide ── */}
      <div className="xl-shell py-6 md:hidden">
        <div className="mb-2 text-body-sm font-extrabold tracking-[0.08em] text-white">
          XL TRADERS
        </div>
        <div className="text-body-sm leading-relaxed">
          {footer.address}
          <br />
          <a href={`mailto:${email}`} className="transition hover:text-white">
            {email}
          </a>
        </div>
        {/* The "Ordering" label is NOT decoration. Without it the first entry
            ("Surat — same day") renders unlabelled, one hairline above the
            tagline "You Order, We Deliver." — an arrival-flavoured phrase
            directly under what is actually a DISPATCH timing. That adjacency is
            the split-across-strings shape STOREFRONT_RULES §3.2 exists to stop.
            Desktop has always carried this heading; the mobile stub must too. */}
        <div className="mt-3 text-caption font-bold uppercase tracking-widest text-slate-500">
          Ordering
        </div>
        {/* Rendered whole and unfiltered: `ordering` is admin-editable, so the
            footer must not decide which of the owner's lines are worth showing. */}
        <div className="mt-1 text-caption leading-relaxed">
          {footer.ordering.join(" · ")}
        </div>
      </div>

      {/* ── Desktop: the full four-column footer, unchanged ── */}
      <div className="xl-shell hidden gap-8 py-10 md:grid md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        {/* Brand */}
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-body-md font-extrabold text-white">
              XL
            </div>
            <span className="text-body-md font-extrabold tracking-[0.08em] text-white">
              TRADERS
            </span>
          </div>
          <p className="mb-3.5 text-body-sm leading-relaxed">
            {footer.description}
          </p>
          <div className="text-body-sm leading-loose">
            {footer.address}
            <br />
            <a href={`tel:${phone1}`} className="transition hover:text-white">
              +91 {phone1}
            </a>{" "}
            ·{" "}
            <a href={`mailto:${email}`} className="transition hover:text-white">
              {email}
            </a>
          </div>
        </div>

        {/* Categories */}
        <div>
          <div className="mb-3 text-xs font-bold uppercase tracking-widest text-white">
            Categories
          </div>
          <div className="flex flex-col gap-2 text-body-sm">
            {categoryLinks.map(l => (
              <Link
                key={l.label}
                href={l.href}
                className="transition hover:text-white"
              >
                {l.label}
              </Link>
            ))}
            <Link href="/catalog" className="transition hover:text-white">
              All categories →
            </Link>
          </div>
        </div>

        {/* Company */}
        <div>
          <div className="mb-3 text-xs font-bold uppercase tracking-widest text-white">
            Company
          </div>
          <div className="flex flex-col gap-2 text-body-sm">
            <Link href="/catalog" className="transition hover:text-white">
              Product Catalogue
            </Link>
            <a
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hi XL Traders, I need a bulk / custom order quote.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-white"
            >
              Bulk &amp; Custom Orders
            </a>
            <Link href="/auth" className="transition hover:text-white">
              Sign In
            </Link>
          </div>
        </div>

        {/* Ordering */}
        <div>
          <div className="mb-3 text-xs font-bold uppercase tracking-widest text-white">
            Ordering
          </div>
          <div className="flex flex-col gap-2 text-body-sm">
            {footer.ordering.map(line => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Legal line, both breakpoints ── */}
      <div className="border-t border-slate-800">
        {/* pb-24 on mobile clears the fixed 65px bottom nav, which otherwise
            covers this row — the same clearance every page's <main> uses. */}
        <div className="xl-shell flex flex-col gap-1 py-4 pb-24 text-xs sm:flex-row sm:justify-between md:pb-4">
          <span>© {currentYear} XL Traders. All rights reserved.</span>
          <span>{footer.tagline}</span>
        </div>
      </div>
    </footer>
  );
}
