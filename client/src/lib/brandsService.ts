import { supabase, Brand } from "./supabase";
import { slugify } from "./catalogHealth";

// ============================================================================
// BRANDS (PIM P1)
// ============================================================================
// Service layer for public.brands — the first-class brand entity behind
// products.brand_id. Mirrors categoryService's shape exactly: reads swallow
// errors and return a safe fallback (a broken brands fetch must not take a
// screen down), writes throw so callers can surface the failure.
//
// RLS: anon/auth can read active brands only; writes require an admin session
// ("Admins can manage brands", is_admin()). Soft-delete only — a brand is
// deactivated, never hard-deleted, so products.brand_id references stay valid.

// Demo mode (VITE_DEMO_MODE=true) short-circuits before Supabase, same as
// productService. No demo brands are seeded — screens render their empty state.
const isDemo = import.meta.env.VITE_DEMO_MODE === "true";

export type BrandInput = Omit<
  Brand,
  "id" | "created_at" | "updated_at" | "slug"
> & { slug?: string };

// Postgres unique_violation — brands.name and brands.slug are both UNIQUE.
// Callers turn this into an inline field error rather than a raw toast.
export const PG_UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === PG_UNIQUE_VIOLATION
  );
}

export const brandsService = {
  // Storefront/picker listing: active brands only, in the operator's chosen
  // order (sort_order, then name so untouched rows are still deterministic).
  async getAll(): Promise<Brand[]> {
    if (isDemo) return [];
    try {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data as Brand[]) ?? [];
    } catch (error) {
      console.error("Error fetching brands:", error);
      return [];
    }
  },

  // Admin listing: every brand regardless of is_active — the manager must show
  // deactivated brands (e.g. Paras) so they can be reactivated or edited.
  async getAllAdmin(): Promise<Brand[]> {
    if (isDemo) return [];
    try {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data as Brand[]) ?? [];
    } catch (error) {
      console.error("Error fetching brands (admin):", error);
      return [];
    }
  },

  async getById(id: string): Promise<Brand> {
    const { data, error } = await supabase
      .from("brands")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as Brand;
  },

  // Product count per brand id (client-side aggregation over id-only rows —
  // same pattern and rationale as categoryService.getProductCounts; cheap at
  // catalogue scale). Unbranded products (brand_id NULL) are not counted here.
  async getProductCounts(): Promise<Record<string, number>> {
    if (isDemo) return {};
    try {
      const { data, error } = await supabase
        .from("products")
        .select("brand_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as { brand_id: string | null }[]) {
        if (row.brand_id)
          counts[row.brand_id] = (counts[row.brand_id] ?? 0) + 1;
      }
      return counts;
    } catch (error) {
      console.error("Error counting brand products:", error);
      return {};
    }
  },

  // Slug auto-derives from the name when omitted (same slugify the SEO tab
  // uses). Duplicate name/slug surfaces as Postgres 23505 — see
  // isUniqueViolation.
  async create(input: BrandInput): Promise<Brand> {
    const { data, error } = await supabase
      .from("brands")
      .insert({ ...input, slug: input.slug?.trim() || slugify(input.name) })
      .select()
      .single();
    if (error) throw error;
    return data as Brand;
  },

  async update(id: string, patch: Partial<BrandInput>): Promise<Brand> {
    const payload: Record<string, unknown> = { ...patch };
    // A cleared slug re-derives from the (possibly renamed) brand name.
    if ("slug" in patch && !patch.slug?.trim()) {
      if (!patch.name?.trim()) delete payload.slug;
      else payload.slug = slugify(patch.name);
    }
    const { data, error } = await supabase
      .from("brands")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Brand;
  },

  // Soft delete / restore. products.brand_id keeps pointing at an inactive
  // brand (by design — the FK only nulls on hard DELETE, which we never do
  // from the app).
  async setActive(id: string, isActive: boolean): Promise<Brand> {
    return this.update(id, { is_active: isActive });
  },
};
