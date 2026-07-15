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
  { label: "Food Packaging", href: "/catalog?group=Disposal%20%26%20Food%20Packaging" },
  { label: "Cleaning Supplies", href: "/catalog?group=Cleaning" },
  { label: "Decoration & Party", href: "/catalog?group=Decoration" },
  { label: "Packaging", href: "/catalog?group=Packaging" },
];

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
    settingsService.getContent("footer").then(setFooter).catch(() => {});

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
    <footer className="bg-slate-900 text-slate-400 mt-auto">
      <div className="container py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-8">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-extrabold text-body-md">
              XL
            </div>
            <span className="font-extrabold text-body-md tracking-[0.08em] text-white">
              TRADERS
            </span>
          </div>
          <p className="text-body-sm leading-relaxed mb-3.5">
            {footer.description}
          </p>
          <div className="text-body-sm leading-loose">
            {footer.address}
            <br />
            <a href={`tel:${phone1}`} className="hover:text-white transition">
              +91 {phone1}
            </a>{" "}
            ·{" "}
            <a href={`mailto:${email}`} className="hover:text-white transition">
              {email}
            </a>
          </div>
        </div>

        {/* Categories */}
        <div>
          <div className="text-xs font-bold tracking-widest uppercase text-white mb-3">
            Categories
          </div>
          <div className="flex flex-col gap-2 text-body-sm">
            {categoryLinks.map(l => (
              <Link
                key={l.label}
                href={l.href}
                className="hover:text-white transition"
              >
                {l.label}
              </Link>
            ))}
            <Link href="/catalog" className="hover:text-white transition">
              All categories →
            </Link>
          </div>
        </div>

        {/* Company */}
        <div>
          <div className="text-xs font-bold tracking-widest uppercase text-white mb-3">
            Company
          </div>
          <div className="flex flex-col gap-2 text-body-sm">
            <Link href="/" className="hover:text-white transition">
              Why XL Traders
            </Link>
            <Link href="/catalog" className="hover:text-white transition">
              Product Catalogue
            </Link>
            <a
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hi XL Traders, I need a bulk / custom order quote.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition"
            >
              Bulk &amp; Custom Orders
            </a>
            <Link href="/auth" className="hover:text-white transition">
              Sign In
            </Link>
          </div>
        </div>

        {/* Ordering */}
        <div>
          <div className="text-xs font-bold tracking-widest uppercase text-white mb-3">
            Ordering
          </div>
          <div className="flex flex-col gap-2 text-body-sm">
            {footer.ordering.map(line => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800">
        <div className="container py-4 text-xs flex flex-col sm:flex-row gap-1 sm:justify-between">
          <span>© {currentYear} XL Traders. All rights reserved.</span>
          <span>{footer.tagline}</span>
        </div>
      </div>
    </footer>
  );
}
