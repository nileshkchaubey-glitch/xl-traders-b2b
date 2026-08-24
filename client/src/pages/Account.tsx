import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronRight } from "lucide-react";

import { useAuthStore } from "@/lib/authStore";
import { settingsService, FALLBACKS } from "@/lib/settingsService";

const WA_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";
const EMAIL = import.meta.env.VITE_EMAIL || "xltraders990@gmail.com";
const PHONE = import.meta.env.VITE_PHONE_1 || "9773239442";

/**
 * The Account screen.
 *
 * Ported from `design-reference/xl-traders-storefront.source.dc.html` by
 * RENDERING the prototype and reading computed styles off its Account screen at
 * both breakpoints — not by reading markup. Reading markup is what let the
 * earlier version of this file ship a white identity card when the prototype's
 * mobile identity block is a full-bleed DARK panel.
 *
 * The two breakpoints are genuinely different layouts, and both are measured:
 *
 *   mobile 390   dark full-bleed panel (identity + 3 stat tiles, bg #0f172a)
 *                then rates card, order history, "Account", settings list
 *   desktop 1440 breadcrumb, then a 280px sidebar card (identity + Sign in +
 *                settings) beside a right column (3 white stat cards, rates
 *                card, order history). No dark panel at all.
 *
 * ONE COMPONENT TREE (STYLE_REFERENCE §5): the dark panel wrapper is
 * `lg:contents`, so at desktop it stops painting and its two children become
 * direct grid items in different columns. No `useIsMobile`, and the stat row is
 * rendered once, not per breakpoint.
 *
 * WHY THIS SCREEN CARRIES THE FOOTER DETAIL: the prototype has NO mobile
 * footer — measured, `{mobileHasFooter:false, desktopHasFooter:true}`. The
 * address, hours, phone, email and ordering terms that used to sit in a cramped
 * mobile footer stub live in the settings list below instead ("all the details
 * are in the account"). Those rows are load-bearing, not decoration —
 * `Footer.tsx` is `lg:block` only because they exist.
 *
 * TYPE: zero new tokens. Every size maps onto the #170 role scale or a stock
 * utility, and two pairs turned out to be exact — the stat number is 15→22,
 * which IS `--text-page-title`, and the rates button is 11.5→12.5, which IS
 * `--text-product-name`. The recorded near-misses are all ≤0.5px and all in the
 * settings row: label 12→12.5, sub and code 10→9.5. The identity name is 16px,
 * a role the scale does not carry, so it uses stock `text-base` — exactly 16.
 *
 * DELIBERATE DEVIATIONS, all small and all recorded:
 *  - The desktop sidebar is TWO cards (identity, settings) where the prototype
 *    has one. Keeping it as one would mean rendering the settings list twice,
 *    or nesting it inside the dark mobile panel. The visible delta is one
 *    hairline across a 14px gap the prototype already has.
 *  - "Order history" heads the card from inside at both breakpoints (the
 *    desktop treatment); the prototype puts that heading above the card on
 *    mobile.
 *  - The prototype's settings rows name features this site does not have
 *    (saved addresses, payment preference, WhatsApp alert settings). Its row
 *    STRUCTURE is kept; the rows carry what is true today plus the footer
 *    detail. A chevron renders only where there is somewhere to go — a chevron
 *    with no destination is the dead-link defect flagged on "Offers zone".
 *
 * THE STAT ROW RENDERS DASHES, and that is the prototype's own guest treatment,
 * not a placeholder invented here. There is no order-history surface yet, so a
 * dash is accurate: we do not have the number. Wiring real counts is A3 / PR-5,
 * which is also when the order card gets rows and Reorder gets a handler.
 */
type Row = {
  code: string;
  label: string;
  sub: string;
  href?: string;
  external?: boolean;
};

function SettingsRow({ code, label, sub, href, external }: Row) {
  const body = (
    <>
      <span className="grid h-[30px] w-[30px] flex-shrink-0 place-items-center rounded-[9px] bg-slate-50 text-meta-lg font-extrabold text-slate-600 lg:h-[26px] lg:w-[26px] lg:rounded-lg lg:bg-slate-100">
        {code}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-product-name-lg font-bold text-slate-900">
          {label}
        </span>
        <span className="mt-px block text-meta-lg font-medium leading-snug text-slate-400">
          {sub}
        </span>
      </span>
      {href && (
        <ChevronRight
          size={14}
          className="flex-shrink-0 text-slate-300"
          aria-hidden
        />
      )}
    </>
  );

  const cls =
    "flex items-center gap-[11px] border-b border-slate-100 px-[13px] py-3 last:border-b-0 transition-colors duration-150 lg:rounded-[9px] lg:border-b-0 lg:px-2.5 lg:py-[9px]";

  if (!href) return <div className={cls}>{body}</div>;

  return external ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${cls} hover:bg-slate-50`}
    >
      {body}
    </a>
  ) : (
    <Link href={href} className={`${cls} hover:bg-slate-50`}>
      {body}
    </Link>
  );
}

/** The prototype's three, all rendering an em dash until A3 wires history. */
const STATS = ["Orders placed", "Ordered this year", "Saved for reorder"];

export default function Account() {
  const { user, profile, isAuthenticated, signOut } = useAuthStore();
  const [, setLocation] = useLocation();
  const [footer, setFooter] = useState(FALLBACKS.footer);
  const [announcement, setAnnouncement] = useState(FALLBACKS.announcement);

  useEffect(() => {
    settingsService
      .getAllContent()
      .then(c => {
        setFooter(c.footer);
        setAnnouncement(c.announcement);
      })
      .catch(() => {});
  }, []);

  const name =
    profile?.company_name || profile?.contact_person || user?.email || "Guest";
  const initials =
    (name.match(/\b[A-Za-z0-9]/g) || []).slice(0, 2).join("").toUpperCase() ||
    "G";

  const businessSub = isAuthenticated
    ? [profile?.contact_person, profile?.gst_number, user?.email]
        .filter(Boolean)
        .join(" · ") || "No details saved yet"
    : "Add after sign in";

  const rows: Row[] = [
    { code: "BZ", label: "Business details", sub: businessSub },
    { code: "OR", label: "Ordering", sub: footer.ordering.join(" · ") },
    {
      code: "HP",
      label: "Help & support",
      sub: `+91 ${PHONE} · ${announcement.hours}`,
      href: `https://wa.me/${WA_NUMBER}`,
      external: true,
    },
    {
      code: "EM",
      label: "Email",
      sub: EMAIL,
      href: `mailto:${EMAIL}`,
      external: true,
    },
    { code: "AD", label: "Address", sub: footer.address },
    {
      code: "CT",
      label: "Product catalogue",
      sub: "Browse every live category",
      href: "/catalog",
    },
  ];

  return (
    <main className="flex-1 pb-24 lg:pb-10">
      <div className="xl-shell pb-3.5 pt-0 lg:py-6">
        {/* The prototype shows no page title — the breadcrumb names the screen.
            Kept for assistive tech, which does need a heading. */}
        <h1 className="sr-only">My account</h1>

        <nav
          aria-label="Breadcrumb"
          className="mb-3.5 hidden text-product-name font-semibold text-slate-400 lg:block"
        >
          <Link href="/" className="transition-colors hover:text-slate-600">
            Home
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-slate-500">My account</span>
        </nav>

        <div className="grid gap-3.5 lg:grid-cols-[280px_1fr] lg:items-start lg:gap-5">
          {/* Mobile: the full-bleed dark panel. Desktop: `contents`, so the two
              children below become grid items and every style on this wrapper
              (background, negative margin, padding) stops applying on its own —
              a `display:contents` box paints nothing. */}
          <div className="-mx-4 bg-slate-900 px-4 pb-5 pt-[18px] sm:-mx-6 sm:px-6 lg:contents">
            <section className="lg:col-start-1 lg:row-start-1 lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-white lg:p-[18px]">
              <div className="flex flex-wrap items-center gap-[13px]">
                <span className="grid h-[52px] w-[52px] flex-shrink-0 place-items-center rounded-full bg-red-600 text-lg font-extrabold text-white lg:h-[54px] lg:w-[54px]">
                  {initials}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-extrabold text-white lg:text-slate-900">
                    {isAuthenticated ? name : "Guest user"}
                  </div>
                  <div className="mt-0.5 truncate text-product-name font-semibold text-slate-400 lg:text-slate-500">
                    {isAuthenticated
                      ? user?.email || "Signed in"
                      : "Not signed in · rates hidden"}
                  </div>
                </div>

                {/* One button, two shapes: compact and right-aligned inside the
                    row on mobile, full-width on its own line at lg — `w-full`
                    is what makes it wrap, so no second element is needed. */}
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await signOut();
                      setLocation("/");
                    }}
                    className="ml-auto rounded-[10px] border border-white/25 px-3.5 py-[9px] text-product-name font-extrabold text-white transition-colors hover:bg-white/10 lg:ml-0 lg:mt-3.5 lg:w-full lg:rounded-[11px] lg:border-slate-200 lg:py-3 lg:text-heading-sub lg:text-slate-600 lg:hover:border-red-200 lg:hover:bg-white lg:hover:text-red-600"
                  >
                    Sign out
                  </button>
                ) : (
                  <Link
                    href="/auth"
                    className="ml-auto rounded-[10px] bg-red-600 px-3.5 py-[9px] text-center text-product-name font-extrabold text-white transition-colors hover:bg-red-700 lg:ml-0 lg:mt-3.5 lg:w-full lg:rounded-[11px] lg:py-3 lg:text-heading-sub"
                  >
                    Sign in
                    <span className="hidden lg:inline"> to your account</span>
                  </Link>
                )}
              </div>
            </section>

            <div className="mt-4 grid grid-cols-3 gap-[9px] lg:col-start-2 lg:row-start-1 lg:mt-0 lg:gap-3.5">
              {STATS.map(label => (
                <div
                  key={label}
                  className="rounded-[11px] bg-slate-800 p-2.5 lg:rounded-[14px] lg:border lg:border-slate-200 lg:bg-white lg:p-[15px]"
                >
                  <div className="text-page-title font-extrabold leading-none text-white lg:text-page-title-lg lg:text-slate-900">
                    —
                  </div>
                  <div className="mt-1 text-chip-lg font-semibold text-slate-400 lg:mt-1.5 lg:text-caption lg:text-slate-500">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column at lg: the guest rates card and order history. */}
          <div className="space-y-3.5 lg:col-start-2 lg:row-start-2">
            {!isAuthenticated && (
              <div className="rounded-[13px] border border-amber-100 bg-amber-50 p-[13px] lg:rounded-[14px] lg:p-[15px]">
                <div className="text-product-name-lg font-extrabold text-amber-900 lg:text-heading-sub">
                  Sign in to see your rates
                </div>
                <p className="mt-1 text-caption font-semibold leading-[1.55] text-amber-800 lg:text-product-name">
                  Signed-in business accounts see per-piece rates and can order
                  on WhatsApp.
                </p>
                <Link
                  href="/auth"
                  className="mt-3 inline-block rounded-[10px] bg-red-600 px-[18px] py-[11px] text-product-name font-extrabold text-white transition-colors hover:bg-red-700 lg:text-product-name-lg"
                >
                  Sign in
                </Link>
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3 text-heading-sub-lg font-extrabold text-slate-900 lg:text-heading-sub">
                Order history
              </div>
              <p className="px-4 py-6 text-center text-caption font-medium text-slate-500 lg:text-product-name">
                Order history is coming soon. Past orders are confirmed on
                WhatsApp in the meantime.
              </p>
            </div>
          </div>

          {/* The detail. This is what "all the details are in the account"
              means, and what lets the mobile footer go. */}
          <section className="lg:col-start-1 lg:row-start-2">
            <h2 className="mb-2.5 text-heading-sub-lg font-extrabold text-slate-900 lg:hidden">
              Account
            </h2>

            <div className="overflow-hidden rounded-[13px] border border-slate-200 bg-white lg:space-y-[3px] lg:overflow-visible lg:rounded-2xl lg:p-[18px]">
              {rows.map(r => (
                <SettingsRow key={r.code} {...r} />
              ))}
            </div>

            {/* The desktop footer carries the copyright; on mobile there is no
                footer, so it lands here. */}
            <p className="mt-4 text-center text-meta-lg font-medium text-slate-400 lg:hidden">
              © {new Date().getFullYear()} XL Traders · {footer.tagline}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
