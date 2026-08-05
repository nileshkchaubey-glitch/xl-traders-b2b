import { useEffect, useState } from "react";
import { categoryService } from "@/lib/productService";

/**
 * Tier 2 of the image fallback chain (docs/DESIGN_SYSTEM.md §3.2): the default
 * image for a product's category, used when the product itself has no usable
 * photo.
 *
 * A grid renders 12+ cards and every one of them needs this lookup, so the
 * fetch is shared at module scope — one `categoryService.getAll()` for the
 * whole page rather than one per card. The promise (not the result) is cached,
 * so cards that mount while the first request is still in flight join it
 * instead of starting their own.
 *
 * Components still never touch Supabase directly — this goes through
 * categoryService like everything else (Architecture Rule #1).
 */
let cache: Promise<Record<string, string>> | null = null;

function loadCategoryImages(): Promise<Record<string, string>> {
  if (!cache) {
    cache = categoryService
      .getAll()
      .then(cats => {
        const map: Record<string, string> = {};
        for (const c of cats) {
          // Only a genuine, non-empty URL counts as tier 2. Anything else
          // must fall straight through to the watermark.
          if (c.image_url && c.image_url.trim()) map[c.id] = c.image_url;
        }
        return map;
      })
      .catch(() => {
        // A failed lookup must not wedge the chain — reset so a later mount
        // can retry, and let every card fall to tier 3 for now.
        cache = null;
        return {};
      });
  }
  return cache;
}

export function useCategoryImages(): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    loadCategoryImages().then(m => {
      if (alive) setMap(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  return map;
}
