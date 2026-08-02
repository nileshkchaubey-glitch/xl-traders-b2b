import { supabase } from "./supabase";

export interface MissingCounts {
  price: number;
  category: number;
  moq: number;
  brand: number;
  image: number;
  specifications: number;
  description: number;
  // Split in the P2 follow-up: `slug` is per-product, never inherits and is
  // mechanically derivable (AdminSEO bulk-generates it). `seo` is the editorial
  // meta copy — title AND description, both of which DO inherit from the
  // series. ANDing slug in meant a blank slug permanently masked whether the
  // meta was done; scoring only the title meant a bulk title-generate could
  // take the score to zero-missing while no product had a search snippet.
  slug: number;
  seo: number;
}

export interface ProductHealthRow {
  id: string;
  name: string;
  missing_price: boolean;
  missing_category: boolean;
  missing_moq: boolean;
  missing_brand: boolean;
  missing_image: boolean;
  missing_specifications: boolean;
  missing_description: boolean;
  missing_slug: boolean;
  missing_seo: boolean;
  health_score: number;
}

// Per-category rollup of catalogue health, aggregated straight from the
// v_product_health view (still the single source of missing-logic). Backs the
// Catalog Tree Editor's health dot: total products vs. how many are incomplete.
export interface CategoryHealth {
  total: number;
  incomplete: number;
}

// Supabase/PostgREST caps a single response at 1000 rows by default. A plain
// unranged .select() silently truncates past that, which is fine for a
// single-row lookup but wrong for "every id matching X" — so these two id
// lookups page through in chunks (same pattern productService.getAllAdmin
// uses for its own .range() calls) until a page comes back short, guaranteeing
// the full result set even once the catalogue grows past 1000 products.
// Ordered by id for a stable sort across the separate paged requests.
const ID_PAGE_SIZE = 1000;

async function fetchAllIds(
  buildPage: (
    from: number,
    to: number
  ) => PromiseLike<{
    data: { id: string }[] | null;
    error: { message: string } | null;
  }>
): Promise<string[]> {
  const ids: string[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildPage(from, from + ID_PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const r of rows) ids.push(r.id);
    if (rows.length < ID_PAGE_SIZE) break;
    from += ID_PAGE_SIZE;
  }
  return ids;
}

export const healthService = {
  // `categoryIds` (optional) scopes the counts to a group/category node in the
  // Catalog Tree Editor. Omit for a catalogue-wide total (Overview/Products).
  async getMissingCounts(categoryIds?: string[]): Promise<MissingCounts> {
    if (categoryIds && categoryIds.length === 0) {
      return {
        price: 0,
        category: 0,
        moq: 0,
        brand: 0,
        image: 0,
        specifications: 0,
        description: 0,
        slug: 0,
        seo: 0,
      };
    }
    let q = supabase
      .from("v_product_health")
      .select(
        "missing_price,missing_category,missing_moq,missing_brand," +
          "missing_image,missing_specifications,missing_description," +
          "missing_slug,missing_seo"
      );
    if (categoryIds?.length) q = q.in("category_id", categoryIds);
    const { data, error } = await q;

    if (error) throw error;

    // Dynamic .select() widens the row type to GenericStringError[]; cast via
    // unknown to the known view shape.
    const rows = (data ?? []) as unknown as Array<Record<string, boolean>>;
    return {
      price: rows.filter(r => r.missing_price).length,
      category: rows.filter(r => r.missing_category).length,
      moq: rows.filter(r => r.missing_moq).length,
      brand: rows.filter(r => r.missing_brand).length,
      image: rows.filter(r => r.missing_image).length,
      specifications: rows.filter(r => r.missing_specifications).length,
      description: rows.filter(r => r.missing_description).length,
      slug: rows.filter(r => r.missing_slug).length,
      seo: rows.filter(r => r.missing_seo).length,
    };
  },

  // Returns the ids of every product missing the given field, straight from
  // the v_product_health view. Callers (AdminProducts) intersect this with the
  // products table via `.in('id', ids)` so the missing-logic stays in the view.
  async getIdsMissing(
    field: keyof MissingCounts,
    categoryIds?: string[]
  ): Promise<string[]> {
    if (categoryIds && categoryIds.length === 0) return [];
    const col = `missing_${field}`;
    return fetchAllIds((from, to) => {
      let q = supabase
        .from("v_product_health")
        .select("id")
        .eq(col, true)
        .order("id");
      if (categoryIds?.length) q = q.in("category_id", categoryIds);
      return q.range(from, to);
    });
  },

  // Ids of every product missing ANY dimension (missing_count > 0) — backs the
  // Catalog Editor's "Needs attention" saved view. Pure read against the
  // existing view/column (same one getCategoryHealth rolls up); no new logic.
  async getIdsIncomplete(categoryIds?: string[]): Promise<string[]> {
    if (categoryIds && categoryIds.length === 0) return [];
    return fetchAllIds((from, to) => {
      let q = supabase
        .from("v_product_health")
        .select("id")
        .gt("missing_count", 0)
        .order("id");
      if (categoryIds?.length) q = q.in("category_id", categoryIds);
      return q.range(from, to);
    });
  },

  // Aggregates the view into { total, incomplete } per category_id so the tree
  // can colour a health dot without re-deriving "what is missing" in TS —
  // incomplete = missing_count > 0, straight from v_product_health.
  async getCategoryHealth(): Promise<Record<string, CategoryHealth>> {
    const { data, error } = await supabase
      .from("v_product_health")
      .select("category_id,missing_count");

    if (error) throw error;
    const rows = (data ?? []) as unknown as Array<{
      category_id: string | null;
      missing_count: number | null;
    }>;
    const out: Record<string, CategoryHealth> = {};
    for (const r of rows) {
      if (!r.category_id) continue;
      const entry = (out[r.category_id] ??= { total: 0, incomplete: 0 });
      entry.total += 1;
      if ((r.missing_count ?? 0) > 0) entry.incomplete += 1;
    }
    return out;
  },

  async productHealth(id: string): Promise<ProductHealthRow | null> {
    const { data, error } = await supabase
      .from("v_product_health")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data as ProductHealthRow | null;
  },

  // Stub for later: returns product ids/names where the given field is missing.
  // Not wired to UI yet — all "what is missing" logic stays in the view.
  async getProductsMissing(
    field: keyof Omit<MissingCounts, never>,
    page = 1,
    pageSize = 50
  ): Promise<{ id: string; name: string }[]> {
    const col = `missing_${field}` as string;
    const from = (page - 1) * pageSize;
    const { data, error } = await supabase
      .from("v_product_health")
      .select("id,name")
      .eq(col, true)
      .range(from, from + pageSize - 1);

    if (error) throw error;
    return (data ?? []) as { id: string; name: string }[];
  },
};
