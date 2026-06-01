/**
 * Image helpers for product images.
 *
 * Product images come from a few different sources (Supabase Storage public
 * URLs, plain web URLs, and Google Drive links). Google Drive "share" links
 * such as `https://drive.google.com/file/d/FILE_ID/view` do NOT render inside
 * an <img> tag — they return an HTML page, not the image bytes. They must be
 * converted to the thumbnail endpoint first. This helper normalises every
 * known Drive URL shape into a renderable thumbnail URL, and leaves all other
 * URLs untouched.
 */

/** Extract the Drive file id from any common Google Drive URL shape. */
function extractDriveFileId(url: string): string | null {
  // https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  const pathMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (pathMatch) return pathMatch[1];

  // https://drive.google.com/open?id=FILE_ID
  // https://drive.google.com/uc?id=FILE_ID&export=view
  // https://drive.google.com/thumbnail?id=FILE_ID&sz=w800
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];

  return null;
}

/**
 * Normalise an image URL so it can be used directly as an <img src>.
 * - Google Drive links → thumbnail endpoint at the requested width.
 * - Everything else (Supabase Storage, plain URLs) → returned unchanged.
 *
 * @param url   The raw image URL (may be undefined/empty).
 * @param width Requested thumbnail width for Drive images. Defaults to 800.
 */
export function normalizeImageUrl(
  url?: string | null,
  width: number = 800
): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (trimmed.includes('drive.google.com')) {
    const id = extractDriveFileId(trimmed);
    if (id) {
      return `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`;
    }
  }

  return trimmed;
}

/** True when the URL looks like a usable http(s) image link. */
export function isValidImageUrl(url?: string | null): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url.trim());
}
