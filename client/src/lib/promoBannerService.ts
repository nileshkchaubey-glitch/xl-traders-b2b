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

export const promoBannerService = {
  /**
   * Live banners for one slot.
   *
   * The scheduling window (`is_active`, `starts_at`, `ends_at`) is enforced by
   * the `public_read_live_banners` RLS policy, not here — so a banner that is
   * off, not yet started, or expired is invisible to the client rather than
   * filtered by it. That means this cannot accidentally render an inactive
   * banner even if the query is changed later.
   *
   * Returns [] on any failure, because a banner is decoration: a broken banner
   * query must never take the home page down.
   */
  async getByPosition(position: BannerPosition): Promise<PromoBanner[]> {
    try {
      const { data, error } = await supabase
        .from("promo_banners")
        .select(COLS)
        .eq("position", position)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as PromoBanner[]) ?? [];
    } catch (error) {
      console.error("Error fetching promo banners:", error);
      return [];
    }
  },
};
