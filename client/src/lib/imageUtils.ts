/**
 * Image auto-resize and compression utility.
 * Uses browser Canvas API — no external deps.
 *
 * Default: resize to max 800×800, white background, JPEG quality 0.85
 */

export interface ResizeResult {
  file: File;
  originalSize: number;
  newSize: number;
  originalDimensions: { w: number; h: number };
  newDimensions: { w: number; h: number };
}

export async function autoResizeImage(
  file: File,
  maxSize = 800,
  quality = 0.85,
): Promise<ResizeResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const originalDimensions = { w: img.width, h: img.height };

      let w = img.width;
      let h = img.height;

      if (w > maxSize || h > maxSize) {
        if (w >= h) {
          h = Math.round((h * maxSize) / w);
          w = maxSize;
        } else {
          w = Math.round((w * maxSize) / h);
          h = maxSize;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not available'));

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Compression failed'));
          const outName = file.name.replace(/\.[^.]+$/, '.jpg');
          const outFile = new File([blob], outName, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve({
            file: outFile,
            originalSize: file.size,
            newSize: outFile.size,
            originalDimensions,
            newDimensions: { w, h },
          });
        },
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}

export async function batchAutoResize(
  files: File[],
  maxSize = 800,
  quality = 0.85,
): Promise<ResizeResult[]> {
  const results: ResizeResult[] = [];
  for (const file of files) {
    try {
      const result = await autoResizeImage(file, maxSize, quality);
      results.push(result);
    } catch {
      results.push({
        file,
        originalSize: file.size,
        newSize: file.size,
        originalDimensions: { w: 0, h: 0 },
        newDimensions: { w: 0, h: 0 },
      });
    }
  }
  return results;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Normalize an image URL so it actually renders inside an <img> tag.
 *
 * Google Drive "share" links (…/file/d/ID/view, …/open?id=ID, …/uc?export=…)
 * return an HTML viewer page, not the image bytes, so they show up broken in
 * the catalog. We rewrite any recognizable Drive link to the thumbnail
 * endpoint, which DOES serve raw image bytes:
 *   https://drive.google.com/thumbnail?id=FILE_ID&sz=w1000
 *
 * Non-Drive URLs (Supabase Storage, direct https images, etc.) are returned
 * trimmed and otherwise untouched. Empty/blank input returns ''.
 */
export function normalizeImageUrl(url?: string | null, size = 1000): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (!/drive\.google\.com|googleusercontent\.com\/d\//.test(trimmed)) {
    return trimmed;
  }

  const id = extractDriveFileId(trimmed);
  if (!id) return trimmed;

  return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
}

/**
 * Build a `srcset` for high-DPI (retina) displays so grid/list thumbnails stay
 * crisp without over-fetching on small screens.
 *
 * Only Google Drive thumbnails support on-the-fly resizing (via the `sz=w` param
 * we control), so we emit 1x/2x width-descriptor variants for those. Non-Drive
 * URLs (Supabase Storage, direct images) have no resize endpoint — a srcset
 * would just repeat the same file — so we return '' and let plain `src` handle
 * it. Pair the result with a `sizes` attribute on the <img>.
 */
export function buildThumbnailSrcSet(url?: string | null, baseWidth = 400): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  const isDrive = /drive\.google\.com|googleusercontent\.com\/d\//.test(trimmed);
  const id = isDrive ? extractDriveFileId(trimmed) : null;
  if (!id) return '';
  const at = (w: number) => `https://drive.google.com/thumbnail?id=${id}&sz=w${w} ${w}w`;
  return `${at(baseWidth)}, ${at(baseWidth * 2)}`;
}

/** Pull the Drive file id out of any common Drive link shape. */
export function extractDriveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/, // /file/d/ID/view
    /[?&]id=([a-zA-Z0-9_-]+)/, // ?id=ID  /  uc?export=view&id=ID  /  thumbnail?id=ID
    /googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/, // lh3.googleusercontent.com/d/ID
    /\/d\/([a-zA-Z0-9_-]+)/, // generic /d/ID
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}
