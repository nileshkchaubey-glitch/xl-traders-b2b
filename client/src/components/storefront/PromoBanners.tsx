import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  promoBannerService,
  type BannerPosition,
  type PromoBanner,
} from "@/lib/promoBannerService";

/**
 * Owner-controlled banner slot.
 *
 * ── The empty-slot rule ──────────────────────────────────────────────────
 * An empty slot renders **nothing at all** — no box, no skeleton, no
 * placeholder, no reserved space. `null` is returned before any wrapper is
 * created, so an unused slot leaves no trace in the DOM. A storefront with no
 * banners configured must look deliberate, not broken.
 *
 * Scheduling (`is_active` / `starts_at` / `ends_at`) is enforced by RLS, so an
 * expired or unpublished banner never reaches this component.
 *
 * `rate_line` is free text by contract — never a computed price. Banners are
 * visible to signed-out visitors, so a derived rate here would bypass the B2B
 * price gate.
 */
export default function PromoBanners({
  position,
  className = "",
}: {
  position: BannerPosition;
  className?: string;
}) {
  const [banners, setBanners] = useState<PromoBanner[]>([]);

  useEffect(() => {
    let cancelled = false;
    promoBannerService
      .getByPosition(position)
      .then(b => !cancelled && setBanners(b))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [position]);

  // Nothing configured — render nothing. Not an empty container.
  if (banners.length === 0) return null;

  return (
    <section className={`container ${className}`}>
      <div
        className={`grid gap-3 ${banners.length > 1 ? "sm:grid-cols-2" : ""}`}
      >
        {banners.map(b => (
          <BannerCard key={b.id} banner={b} />
        ))}
      </div>
    </section>
  );
}

function BannerCard({ banner }: { banner: PromoBanner }) {
  const body = (
    <div
      className="relative flex min-h-[128px] items-center overflow-hidden rounded-2xl border border-slate-200"
      style={{ background: "var(--xl-accent-soft)" }}
    >
      {banner.image_url && (
        <img
          src={banner.image_url}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="relative z-10 max-w-[70%] p-5">
        <div className="text-lg font-extrabold leading-tight tracking-tight text-slate-900">
          {banner.headline}
        </div>
        {banner.rate_line && (
          <div
            className="mt-1 text-body-sm font-bold"
            style={{ color: "var(--xl-accent)" }}
          >
            {banner.rate_line}
          </div>
        )}
      </div>
    </div>
  );

  if (!banner.link_target) return body;

  // Internal targets use wouter (Critical Rule #5 — never <a href> for
  // internal nav); anything absolute is external and opens in a new tab.
  return banner.link_target.startsWith("/") ? (
    <Link href={banner.link_target}>{body}</Link>
  ) : (
    <a href={banner.link_target} target="_blank" rel="noopener noreferrer">
      {body}
    </a>
  );
}
