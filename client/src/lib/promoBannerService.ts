import { supabase } from "./supabase";

export type BannerPosition = "home_top" | "home_mid" | "category_top";

export interface PromoBanner {
  id: string;
  image_url: string | null;
  headline: string;
  /**
   * FREE TEXT ONLY — never a computed or looked-up price. Banners render to
   * signed-out visitors, so a derived rate here would bypass the B2B price
   * gate. Enforced by the column comment in SQL and by never joining a price
   * into this query.
   */
  rate_line: string | null;
  link_target: string | null;
  position: BannerPosition;
  sort_order: number;
}

const COLS = "id,image_url,headline,rate_line,link_target,position,sort_order";

export interface AdminPromoBanner extends PromoBanner {
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}
export type BannerInput = Omit<AdminPromoBanner, "id">;
const ADMIN_COLS = `${COLS},is_active,starts_at,ends_at`;

/** Allow same-site paths or HTTPS, excluding protocol-relative/script/data URLs. */
export function safeBannerUrl(value: string | null): string | null {
  const url = value?.trim();
  if (!url) return null;
  if (/[\s\\\u0000-\u001f]/.test(url)) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
      ? url
      : null;
  } catch {
    return null;
  }
}

function validatedBanner(input: BannerInput): BannerInput {
  if (!input.headline.trim()) throw new Error("Enter a banner headline.");
  if (!["home_top", "home_mid", "category_top"].includes(input.position))
    throw new Error("Choose a banner position.");
  if (!Number.isSafeInteger(input.sort_order) || input.sort_order < 0)
    throw new Error("Sort order must be a non-negative whole number.");
  for (const value of [input.image_url, input.link_target])
    if (value?.trim() && !safeBannerUrl(value))
      throw new Error("Use a same-site path or an HTTPS URL.");
  const date = (value: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime()))
      throw new Error("Enter a valid scheduling date.");
    return parsed.toISOString();
  };
  const starts_at = date(input.starts_at),
    ends_at = date(input.ends_at);
  if (starts_at && ends_at && ends_at <= starts_at)
    throw new Error("End must be after start.");
  return {
    headline: input.headline.trim(),
    image_url: safeBannerUrl(input.image_url),
    rate_line: input.rate_line?.trim() || null,
    link_target: safeBannerUrl(input.link_target),
    position: input.position,
    sort_order: input.sort_order,
    is_active: input.is_active === true,
    starts_at,
    ends_at,
  };
}

export const promoBannerService = {
  /**
   * Live banners for one slot.
   *
   * The scheduling window (`is_active`, `starts_at`, `ends_at`) is enforced by
   * the `public_read_live_banners` customer RLS policy. Explicit filters also
   * keep management-visible inactive/expired rows out of an admin's storefront.
   *
   * Returns [] on any failure, because a banner is decoration: a broken banner
   * query must never take the home page down.
   */
  async getByPosition(position: BannerPosition): Promise<PromoBanner[]> {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("promo_banners")
        .select(COLS)
        .eq("position", position)
        .eq("is_active", true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gt.${now}`)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as PromoBanner[]) ?? [];
    } catch (error) {
      console.error("Error fetching promo banners:", error);
      return [];
    }
  },

  async listForAdmin(): Promise<AdminPromoBanner[]> {
    const { data, error } = await supabase
      .from("promo_banners")
      .select(ADMIN_COLS)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: BannerInput): Promise<AdminPromoBanner> {
    // New banners start inactive; activation is a separate owner/admin action.
    const payload = validatedBanner({ ...input, is_active: false });
    const { data, error } = await supabase
      .from("promo_banners")
      .insert(payload)
      .select(ADMIN_COLS)
      .single();
    if (error) throw error;
    return data;
  },
  async update(id: string, input: BannerInput): Promise<AdminPromoBanner> {
    if (!id) throw new Error("Missing banner ID.");
    const payload = validatedBanner(input);
    const { data, error } = await supabase
      .from("promo_banners")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(ADMIN_COLS)
      .single();
    if (error) throw error;
    return data;
  },
};
