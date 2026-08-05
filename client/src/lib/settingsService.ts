import { supabase } from "./supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Site content service (Phase B)
//
// Moves hardcoded storefront copy into the `site_content` table (key text PK,
// value jsonb) so the owner edits it from admin without a code deploy.
//
// Architecture:
//  - Components NEVER call Supabase directly — they go through this service.
//  - EVERY key has an in-code fallback default (the CURRENT hardcoded value).
//    If the table is empty, a row is missing, or the fetch fails, the fallback
//    is returned so the storefront is never blank.
//  - Reads are cached for the session (single fetch shared across every key /
//    component); writes update the cache so admin edits reflect immediately.
// ─────────────────────────────────────────────────────────────────────────────

const isDemo = import.meta.env.VITE_DEMO_MODE === "true";

// ── Value shapes ─────────────────────────────────────────────────────────────

export interface HeroContent {
  // The delivery promise — the largest element on the page since PR-1
  // (STYLE_REFERENCE §2.1 A6: same-day-in-Surat is the strongest
  // differentiator and used to sit as a small tick below the hero).
  // Editable like everything else here: the biggest thing on the storefront
  // must not be hardcoded copy.
  promiseLead: string;
  promiseAccent: string;
  // Delivery tiers shown under the promise. Was hardcoded inside the Service
  // Areas card before PR-1; moved here so the hero owns it and it is stated once.
  promiseTiers: string[];
  titleLead: string;
  titleAccent: string;
  subline: string;
  /**
   * @deprecated Unused since storefront PR-1. `promiseTiers` took this row in
   * the hero, and the bullets' content ("24h dispatch", "GST invoice on every
   * order") repeated the trust points — part of the same 4× duplication
   * (STYLE_REFERENCE §2.4 item 5). Kept so existing `site_content` rows stay
   * readable; nothing renders it and the editor no longer offers it.
   */
  bullets: string[];
}

/**
 * @deprecated Unused since storefront PR-1. Its two facts — the Google rating
 * and the businesses-served count — are the same ones `trust_stats` carries,
 * and rendering both was half of the "trust content appears 4×" problem
 * (STYLE_REFERENCE §2.4 item 5). The key is left in place so existing
 * `site_content` rows stay readable; nothing renders it and the Site Content
 * editor no longer offers it. Edit those facts in Trust stats instead.
 */
export interface TrustBadge {
  rating: string;
  businesses: string;
}

export interface TrustStat {
  value: string;
  label: string;
  sub: string;
}

export interface TrustPoint {
  glyph: string;
  title: string;
  body: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface BulkBanner {
  eyebrow: string;
  title: string;
  body: string;
}

export interface AnnouncementContent {
  gstLine: string;
  deliveryLine: string;
  hours: string;
  mobilePill: string;
}

export interface FooterContent {
  description: string;
  address: string;
  tagline: string;
  ordering: string[];
}

/**
 * The legal furniture, rendered ONLY at the bottom of the Account screen
 * (docs/DESIGN_SYSTEM.md §4) — the homepage carries no address, GSTIN or
 * legal links.
 *
 * `gstin` defaults to EMPTY and the line is omitted when it is: the design
 * board showed a placeholder ("24XXXXXXXXXXXZX") and shipping that would put
 * a fabricated tax number on a B2B invoice-facing screen. The owner enters the
 * real one in Site Content.
 */
export interface LegalContent {
  entity: string;
  address: string;
  gstin: string;
  version: string;
}

// Registry of every content key → its value type. Adding a key here (plus a
// FALLBACKS entry) is all that's needed to make new content editable.
export interface SiteContentMap {
  hero: HeroContent;
  trust_badge: TrustBadge;
  trust_stats: TrustStat[];
  trust_points: TrustPoint[];
  service_areas: string[];
  faqs: FaqItem[];
  bulk_banner: BulkBanner;
  announcement: AnnouncementContent;
  footer: FooterContent;
  legal: LegalContent;
  gst_enabled: boolean;
  gst_percentage: number;
  min_order_enabled: boolean;
  min_order_value: number;
}

export type SiteContentKey = keyof SiteContentMap;

// ── FALLBACKS — the current hardcoded values (single source of truth) ─────────
// These are exactly what the storefront rendered before Phase B, so an empty
// `site_content` table produces a byte-identical site.
export const FALLBACKS: SiteContentMap = {
  hero: {
    promiseLead: "Same-day delivery in",
    promiseAccent: "Surat",
    promiseTiers: [
      "Same-day · Surat city",
      "Next-day · South Gujarat",
      "2–4 days · Pan-India",
    ],
    titleLead: "Packaging Solutions For",
    titleAccent: "Growing Businesses",
    subline:
      "Wholesale food containers, paper cups, carry bags, corrugated boxes and restaurant supplies. Order in under a minute — delivered same-day in Surat.",
    bullets: [
      "Bulk wholesale pricing",
      "24h dispatch",
      "GST invoice on every order",
    ],
  },
  trust_badge: {
    rating: "4.8 on Google",
    businesses: "500+ businesses served",
  },
  trust_stats: [
    { value: "4.8★", label: "Google Rating", sub: "From local businesses" },
    {
      value: "10+",
      label: "Years in Business",
      sub: "Wholesale since day one",
    },
    { value: "500+", label: "Businesses Served", sub: "Restaurants to kirana" },
    { value: "24h", label: "Dispatch Promise", sub: "Same-day in Surat" },
  ],
  trust_points: [
    {
      glyph: "GST",
      title: "GST-registered wholesaler",
      body: "Proper GST invoice with every order — claim your input credit.",
    },
    {
      glyph: "₹",
      title: "Transparent wholesale pricing",
      body: "Sign in to see exact prices; bulk orders unlock better rates.",
    },
    {
      glyph: "✓",
      title: "Quality-checked supply",
      body: "Food-grade materials from verified manufacturers.",
    },
  ],
  service_areas: [
    "Surat City",
    "Udhna",
    "Katargam",
    "Varachha",
    "Navsari",
    "Bardoli",
    "Ankleshwar",
    "Pan-India",
  ],
  faqs: [
    {
      q: "What is the minimum order quantity?",
      a: "Each product shows its own MOQ. The cart checks MOQ before you order so there are no surprises later.",
    },
    {
      q: "Do you deliver outside Surat?",
      a: "Yes — same-day in Surat city, next-day across South Gujarat, and 2–4 days pan-India via surface transport.",
    },
    {
      q: "Do I get a GST invoice?",
      a: "Every order ships with a GST invoice. Share your GSTIN on WhatsApp once and it is applied to all future orders.",
    },
    {
      q: "Can I get custom printing on bags and boxes?",
      a: "Yes, for bulk orders. Use the Bulk Quote button and we respond within 2 business hours with slab pricing.",
    },
  ],
  bulk_banner: {
    eyebrow: "Bulk & Custom Orders",
    title: "Ordering 10,000+ units or need custom branding?",
    body: "Get a dedicated quote with slab pricing, custom printing and scheduled deliveries. Response within 2 business hours.",
  },
  announcement: {
    gstLine: "GST Registered Wholesaler",
    // The one delivery line on the storefront, under the search field.
    // Three tiers, stated as fact — the locked design gives this no headline
    // treatment, no countdown and no repetition anywhere else.
    deliveryLine:
      "Same-day Surat · Next-day South Gujarat · 2–4 days Pan-India",
    hours: "Mon–Sat 9AM–9PM",
    mobilePill: "Same-day Surat",
  },
  footer: {
    description:
      "Wholesale food packaging & disposables for restaurants, cafés, cloud kitchens, caterers and distributors. Surat, Gujarat.",
    address: "Surat, Gujarat 395002",
    tagline: "You Order, We Deliver — wholesale in under 60 seconds.",
    ordering: [
      "Same-day delivery in Surat",
      "24h dispatch pan-India",
      "GST invoice on every order",
      "Order & confirm on WhatsApp",
    ],
  },
  legal: {
    entity: "XL Traders",
    address: "Ring Road, Surat 395002",
    // Intentionally blank — the Account screen omits the GSTIN line entirely
    // rather than render the design board's placeholder as if it were real.
    gstin: "",
    version: "v1.0",
  },
  gst_enabled: false,
  gst_percentage: 0,
  min_order_enabled: false,
  min_order_value: 0,
};

// ── Session cache ────────────────────────────────────────────────────────────
// A single fetch of the whole table is shared across every getContent() call so
// the storefront doesn't hit the DB once per key per render.
let allCache: Partial<SiteContentMap> | null = null;
let inflight: Promise<Partial<SiteContentMap>> | null = null;

async function fetchAll(): Promise<Partial<SiteContentMap>> {
  if (isDemo) return {};
  try {
    const { data, error } = await supabase
      .from("site_content")
      .select("key, value");
    if (error || !data) return {};
    const map: Partial<SiteContentMap> = {};
    for (const row of data as { key: string; value: unknown }[]) {
      // Ignore unknown keys and explicit nulls so a stray row can't blank the site.
      if (row.key in FALLBACKS && row.value != null) {
        (map as Record<string, unknown>)[row.key] = row.value;
      }
    }
    return map;
  } catch {
    // Network hiccup / table missing / RLS — fall back silently.
    return {};
  }
}

/**
 * Merges a stored `site_content` value over its in-code fallback **per field**.
 *
 * The merge used to be `{ ...FALLBACKS, ...stored }`, which is shallow: a
 * stored row REPLACED the whole object. That is fine until a new sub-field is
 * added to an existing key — every row written before that moment is missing
 * it, so the field arrives as `undefined` at the render site. PR-1 hit exactly
 * this: the live `hero` row carries only the four sub-keys it was saved with,
 * so `hero.promiseTiers.map()` would have thrown on production while looking
 * perfect locally against the fallback.
 *
 * Objects merge one level deep, which is all these shapes need. Arrays are
 * replaced wholesale on purpose — a stored list of 3 tiers must not have
 * fallback entries 4+ bleeding back in from underneath it.
 */
function mergeOverFallback<T>(fallback: T, stored: unknown): T {
  if (stored == null) return fallback;
  if (
    Array.isArray(stored) ||
    Array.isArray(fallback) ||
    typeof stored !== "object" ||
    typeof fallback !== "object" ||
    fallback == null
  ) {
    return stored as T;
  }
  return { ...(fallback as object), ...(stored as object) } as T;
}

function loadAll(): Promise<Partial<SiteContentMap>> {
  if (allCache) return Promise.resolve(allCache);
  if (!inflight) {
    inflight = fetchAll().then(map => {
      allCache = map;
      inflight = null;
      return map;
    });
  }
  return inflight;
}

export const settingsService = {
  /**
   * Fetch one content key. Returns the stored value, or the in-code fallback
   * when the row is missing / the fetch fails. Never throws.
   */
  async getContent<K extends SiteContentKey>(
    key: K
  ): Promise<SiteContentMap[K]> {
    const all = await loadAll();
    return mergeOverFallback(FALLBACKS[key], all[key]);
  },

  /**
   * Fetch every key merged over the fallbacks — used by the admin editor so
   * each field shows its current effective value (DB if present, else default).
   */
  async getAllContent(): Promise<SiteContentMap> {
    const all = await loadAll();
    // Per-field merge, not a shallow key-level spread — see mergeOverFallback.
    const out = { ...FALLBACKS };
    for (const key of Object.keys(FALLBACKS) as SiteContentKey[]) {
      (out as Record<string, unknown>)[key] = mergeOverFallback(
        FALLBACKS[key],
        all[key]
      );
    }
    return out;
  },

  /**
   * Upsert one key (authenticated / admin only per RLS). Updates the session
   * cache so the change is visible immediately without a reload.
   */
  async updateContent<K extends SiteContentKey>(
    key: K,
    value: SiteContentMap[K]
  ): Promise<void> {
    const { error } = await supabase
      .from("site_content")
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    if (error) throw error;
    if (allCache) allCache[key] = value;
    else allCache = { [key]: value } as Partial<SiteContentMap>;
  },

  /** Drop the cache so the next read re-fetches (e.g. after external changes). */
  invalidate() {
    allCache = null;
    inflight = null;
  },
};
