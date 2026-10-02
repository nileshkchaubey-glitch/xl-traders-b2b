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

// Output format. Defaults to jpeg so every existing caller is untouched; the
// Workbench's SKU uploads pass "webp" (smaller at the same visual quality, and
// it is what the SKU filenames declare — XL0105.webp).
export type ResizeFormat = "jpeg" | "webp";

export async function autoResizeImage(
  file: File,
  maxSize = 800,
  quality = 0.85,
  format: ResizeFormat = "jpeg"
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

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not available"));

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      const mime = format === "webp" ? "image/webp" : "image/jpeg";
      const ext = format === "webp" ? ".webp" : ".jpg";
      canvas.toBlob(
        blob => {
          if (!blob) return reject(new Error("Compression failed"));
          if (blob.type !== mime)
            return reject(
              new Error("This browser cannot encode the requested image format")
            );
          const outName = file.name.replace(/\.[^.]+$/, ext);
          const outFile = new File([blob], outName, {
            type: mime,
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
        mime,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };

    img.src = objectUrl;
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Keep the caller's original bytes; generate both real renditions before upload. */
export async function prepareImageSet(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file");
  const [web, large] = await Promise.all([
    autoResizeImage(file, 800, 0.85, "webp"),
    autoResizeImage(file, 1600, 0.85, "webp"),
  ]);
  return { original: file, web, large };
}

/** Storage originals/2x files are companions, not separate library choices. */
export function isDisplayImageObject(name: string): boolean {
  return (
    !name.includes(".xl-original.") &&
    !/\.xl-web-\d+w-\d+w-2x\.webp$/.test(name)
  );
}

/** Derive only the siblings guaranteed by the managed upload convention. */
export function imageSources(url: string | null | undefined, slotPx: number) {
  const src = normalizeImageUrl(url, slotPx);
  const src2x = normalizeImageUrl(url, slotPx * 2);
  if (src && src2x !== src)
    return { src, srcSet: `${src} 1x, ${src2x} 2x`, sizes: undefined };
  const managed = src.match(
    /\/storage\/v1\/object\/public\/(?:product-images|category-images)\/.*\.xl-web-(\d+)w-(\d+)w-1x\.webp(?:\?.*)?$/
  );
  if (
    managed &&
    Number(managed[2]) > Number(managed[1]) &&
    Number(managed[1]) > 0
  ) {
    return {
      src,
      srcSet: `${src} ${managed[1]}w, ${src.replace(/-1x\.webp(?=\?|$)/, "-2x.webp")} ${managed[2]}w`,
      sizes: `${slotPx}px`,
    };
  }
  return { src, srcSet: undefined, sizes: undefined };
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
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  if (!/drive\.google\.com|googleusercontent\.com\/d\//.test(trimmed)) {
    return trimmed;
  }

  const id = extractDriveFileId(trimmed);
  if (!id) return trimmed;

  return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
}

/** Pull the Drive file id out of any common Drive link shape. */
function extractDriveFileId(url: string): string | null {
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
