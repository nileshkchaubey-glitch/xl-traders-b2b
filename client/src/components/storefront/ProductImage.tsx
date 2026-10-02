import { Package } from "lucide-react";
import { imageSources } from "@/lib/imageUtils";

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
 * Drive uses real thumbnail widths. New managed Storage uploads have actual
 * browser-generated WebP siblings with widths encoded in their names. Legacy
 * Storage/external URLs keep a single source; no paid transformations or
 * nonexistent siblings are requested.
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
  const { src, srcSet, sizes } = imageSources(url, slotPx);

  return (
    <div className={`relative ${aspect} overflow-hidden bg-slate-50 ${className}`}>
      {/* Fallback sits underneath — revealed by the img hiding itself on error. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Package className="w-8 h-8 text-slate-300" aria-hidden />
      </div>
      {src && (
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizes}
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
