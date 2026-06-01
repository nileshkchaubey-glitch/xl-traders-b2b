import { useState } from 'react';
import { ImagePlaceholder } from './ImagePlaceholder';
import { normalizeImageUrl } from '@/lib/imageUtils';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  /** Tailwind classes for the wrapper (controls size / aspect ratio). */
  className?: string;
  /** Tailwind classes applied to the <img> itself (object-fit, padding, hover). */
  imgClassName?: string;
  /** Requested width passed to the Drive thumbnail endpoint. */
  width?: number;
  /** Show the "XL Traders" label inside the placeholder fallback. */
  showPlaceholderText?: boolean;
}

/**
 * Renders a product image with:
 * - Google Drive URL normalisation (so Drive share links actually load).
 * - A shimmer skeleton while the image is loading (no layout shift / pop-in).
 * - A graceful branded placeholder when the image is missing or fails.
 *
 * Used across the catalog grid, list view and admin table so product images
 * look and behave consistently everywhere.
 */
export default function ProductImage({
  src,
  alt,
  className = 'w-full h-full',
  imgClassName = 'object-contain p-2',
  width = 800,
  showPlaceholderText = false,
}: ProductImageProps) {
  const normalized = normalizeImageUrl(src, width);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
    normalized ? 'loading' : 'error'
  );

  if (!normalized || status === 'error') {
    return <ImagePlaceholder className={className} showText={showPlaceholderText} />;
  }

  return (
    <div className={`relative overflow-hidden bg-white ${className}`}>
      {status === 'loading' && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-100 to-slate-200" />
      )}
      <img
        src={normalized}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        className={`w-full h-full transition-opacity duration-300 ${
          status === 'loaded' ? 'opacity-100' : 'opacity-0'
        } ${imgClassName}`}
      />
    </div>
  );
}
