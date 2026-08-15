import { Package } from "lucide-react";
import { normalizeImageUrl } from "@/lib/imageUtils";

interface ProductImageProps {
  url?: string | null;
  alt: string;
  /** CSS width of the slot at its largest, in px. Drives the requested size. */
  slotPx: number;
  /** Tailwind aspect ratio class. Fixed, so the grid never reflows on load. */
  aspect?: string;
  /** Above-the-fold images opt out of lazy loading. */
  priority?: boolean;
  className?: string;
}

/**
 * One product image, with the layout-stability rules applied in one place:
 *
 *  * a FIXED aspect ratio, so a card reserves its space before the image loads
 *    and a grid never reflows mid-scroll (the CLS that made the old cards jump);
 *  * `loading="lazy"` + `decoding="async"` below the fold, `eager` + high
 *    fetch priority above it;
 *  * a CSS-only fallback — the icon sits UNDERNEATH the image, so a broken or
 *    missing URL reveals it with no React state and no re-render cascade on a
 *    page full of broken images.
 *
 * ── On image sizing, stated honestly ──────────────────────────────────────
 * The V3 target is sized WebP served from Supabase Storage. That is not yet
 * reachable for most of the catalogue and this component does not pretend
 * otherwise:
 *
 *  * ~89% of product imagery is still hosted on Google Drive. Drive's thumbnail
 *    endpoint DOES accept a width (`&sz=w400`), so for those URLs we request a
 *    slot-appropriate size and emit a real 1x/2x `srcSet`. That is a genuine
 *    transfer saving today.
 *  * Supabase-hosted images are served at their stored size. Supabase image
 *    transformations are a PAID-plan feature and this project is on the free
 *    plan, so there is no on-the-fly resize; multi-rendition WebP has to be
 *    generated at UPLOAD time, which is an admin-pipeline change and a separate
 *    PR. Emitting a `srcSet` for `-400`/`-800` files that do not exist yet
 *    would break every Supabase-hosted image.
 *
 * Nothing here is ever a base64 data URI — the bundle carries no image bytes.
 */
export default function ProductImage({
  url,
  alt,
  slotPx,
  aspect = "aspect-square",
  priority = false,
  className = "",
}: ProductImageProps) {
  const src = normalizeImageUrl(url, slotPx);
  const src2x = normalizeImageUrl(url, slotPx * 2);
  // Only Drive URLs actually vary with the requested size; when they don't, a
  // srcSet of two identical URLs would just confuse the browser's picker.
  const hasRealSrcSet = !!src && !!src2x && src !== src2x;

  return (
    <div className={`relative ${aspect} overflow-hidden bg-slate-50 ${className}`}>
      {/* Fallback sits underneath — revealed by the img hiding itself on error. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Package className="w-8 h-8 text-slate-300" aria-hidden />
      </div>
      {src && (
        <img
          src={src}
          srcSet={hasRealSrcSet ? `${src} 1x, ${src2x} 2x` : undefined}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          className="relative w-full h-full object-contain p-3 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.04]"
          onError={e => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
    </div>
  );
}
