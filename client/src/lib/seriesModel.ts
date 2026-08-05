import type { Product } from "./supabase";
import { displayPrice } from "./priceUtils.ts";
import { displayName } from "./displayName.ts";

/**
 * Series collapsing (docs/DESIGN_SYSTEM.md §3.1b).
 *
 * `product_masters` models a SERIES — one product sold in several sizes, with
 * each size a `products` row carrying `master_id` and `variant_label`. The
 * admin PIM has understood this since P2 and the PDP already renders a variant
 * picker, but the storefront listing did not: it rendered every variant as its
 * own card, so the single "Hinged box" series filled the entire first screen
 * with ten near-identical cards (same name, same photo, same price state).
 *
 * A listing entry is therefore either a standalone product or a whole series.
 * The series entry carries the size RANGE and the variant count, because those
 * are what distinguish it — the name alone is identical across all ten.
 *
 * Pure: no I/O, no React. Regression-tested in scripts/check-series-model.ts.
 */

export interface SeriesEntry {
  kind: "series";
  /** `product_masters.id` — stable key for React and for links. */
  id: string;
  name: string;
  /** Every live variant, ordered smallest size first. */
  variants: Product[];
  /** The variant a click opens; the PDP's picker takes it from there. */
  leadVariant: Product;
  /** e.g. "100–2000" — null when no variant yields a numeric size. */
  sizeRange: string | null;
  /** e.g. "ml" — the unit shared by the range. */
  sizeUnit: string | null;
  /** Lowest per-piece rate across variants, or null when none is derivable. */
  fromPerPiece: number | null;
  perPieceUnit: string;
  /** True when NO variant has a usable price for this viewer. */
  allOnEnquiry: boolean;
}

export interface ProductEntry {
  kind: "product";
  id: string;
  product: Product;
}

export type ListingEntry = ProductEntry | SeriesEntry;

/** Minimal shape needed from `product_masters`; keeps the dependency small. */
export interface MasterRef {
  id: string;
  name: string;
}

/**
 * Parse the numeric part of a `variant_label` ("2000 ml" → {2000, "ml"}).
 * Variant labels are authored in admin, so they are far more reliable than
 * product names — but still optional, hence the null path.
 */
export function parseVariantLabel(
  label?: string | null
): { value: number; unit: string } | null {
  const m = (label ?? "").trim().match(/^(\d+(?:\.\d+)?)\s*([a-z]*)/i);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return null;
  return { value, unit: (m[2] || "").toLowerCase() };
}

/** Trim a number for display without inventing precision: 2000.0 → "2000". */
const tidy = (n: number) => String(Number(n));

/**
 * Collapse a flat product list into listing entries.
 *
 * Order is preserved: a series takes the position of its FIRST variant in the
 * incoming list, so whatever sort the caller asked the database for still
 * governs the page. Products whose `master_id` points at a master we weren't
 * given fall back to rendering standalone rather than vanishing.
 */
export function collapseSeries(
  products: Product[],
  masters: MasterRef[],
  isAuthenticated: boolean
): ListingEntry[] {
  const byId = new Map(masters.map(m => [m.id, m]));
  const entries: ListingEntry[] = [];
  const seriesIndex = new Map<string, SeriesEntry>();

  for (const p of products) {
    const master = p.master_id ? byId.get(p.master_id) : undefined;

    if (!master) {
      entries.push({ kind: "product", id: p.id, product: p });
      continue;
    }

    const existing = seriesIndex.get(master.id);
    if (existing) {
      existing.variants.push(p);
      continue;
    }

    const entry: SeriesEntry = {
      kind: "series",
      id: master.id,
      name: displayName(master.name),
      variants: [p],
      leadVariant: p,
      sizeRange: null,
      sizeUnit: null,
      fromPerPiece: null,
      perPieceUnit: "pc",
      allOnEnquiry: true,
    };
    seriesIndex.set(master.id, entry);
    entries.push(entry);
  }

  // Second pass: everything below needs the FULL variant set, so it can only
  // be computed once the loop above has finished gathering them.
  for (const entry of seriesIndex.values()) {
    const parsed = entry.variants
      .map(v => ({ v, s: parseVariantLabel(v.variant_label) }))
      .filter(
        (x): x is { v: Product; s: { value: number; unit: string } } =>
          x.s !== null
      )
      .sort((a, b) => a.s.value - b.s.value);

    if (parsed.length > 0) {
      entry.variants = [
        ...parsed.map(x => x.v),
        // Variants with an unparseable label keep their original order at the end
        // rather than being dropped — the count must stay honest.
        ...entry.variants.filter(v => !parseVariantLabel(v.variant_label)),
      ];
      entry.leadVariant = parsed[0].v;

      const lo = parsed[0].s;
      const hi = parsed[parsed.length - 1].s;
      // A range needs two DIFFERENT ends; a one-size series shows a single figure.
      entry.sizeRange =
        lo.value === hi.value
          ? tidy(lo.value)
          : `${tidy(lo.value)}–${tidy(hi.value)}`;
      // Only claim a shared unit when every parsed variant agrees.
      const units = new Set(parsed.map(x => x.s.unit).filter(Boolean));
      entry.sizeUnit = units.size === 1 ? [...units][0] : null;
    }

    // Cheapest per-piece rate across the series, for "from ₹X/pc".
    let best: number | null = null;
    for (const v of entry.variants) {
      const dp = displayPrice(v, isAuthenticated);
      if (dp.onEnquiry) continue;
      entry.allOnEnquiry = false;
      entry.perPieceUnit = dp.perPieceUnit;
      const rate = dp.perPiece ?? dp.packPrice;
      if (rate != null && (best === null || rate < best)) best = rate;
    }
    entry.fromPerPiece = best;
  }

  return entries;
}

/**
 * Take the first `n` entries. Collapsing only ever REDUCES the count, so a
 * caller that wants n entries must over-fetch products; this is the slice.
 */
export function takeEntries(
  entries: ListingEntry[],
  n: number
): ListingEntry[] {
  return entries.slice(0, n);
}

/**
 * Order variants smallest-size first, for the PDP's size picker.
 *
 * The database can only order these by `display_order` or `price`, neither of
 * which is size — which is why the picker read 100, 250, 375, 500, 1000, 1250,
 * 600, 750… Sorting on the parsed label is the only way to get 100→2000, and
 * it keeps the picker consistent with the range the series card advertises.
 * Variants with an unparseable label keep their relative order at the end.
 */
export function sortVariantsBySize<T extends { variant_label?: string | null }>(
  variants: T[]
): T[] {
  return [...variants].sort((a, b) => {
    const pa = parseVariantLabel(a.variant_label);
    const pb = parseVariantLabel(b.variant_label);
    if (pa && pb) return pa.value - pb.value;
    if (pa) return -1;
    if (pb) return 1;
    return 0;
  });
}
