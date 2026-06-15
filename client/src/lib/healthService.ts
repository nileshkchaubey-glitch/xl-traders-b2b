import { supabase } from './supabase';

export interface MissingCounts {
  price: number;
  category: number;
  moq: number;
  brand: number;
  image: number;
  specifications: number;
  description: number;
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
  missing_seo: boolean;
  health_score: number;
}

export const healthService = {
  async getMissingCounts(): Promise<MissingCounts> {
    const { data, error } = await supabase
      .from('v_product_health')
      .select(
        'missing_price,missing_category,missing_moq,missing_brand,' +
        'missing_image,missing_specifications,missing_description,missing_seo',
      );

    if (error) throw error;

    const rows = (data ?? []) as Array<Record<string, boolean>>;
    return {
      price: rows.filter((r) => r.missing_price).length,
      category: rows.filter((r) => r.missing_category).length,
      moq: rows.filter((r) => r.missing_moq).length,
      brand: rows.filter((r) => r.missing_brand).length,
      image: rows.filter((r) => r.missing_image).length,
      specifications: rows.filter((r) => r.missing_specifications).length,
      description: rows.filter((r) => r.missing_description).length,
      seo: rows.filter((r) => r.missing_seo).length,
    };
  },

  async productHealth(id: string): Promise<ProductHealthRow | null> {
    const { data, error } = await supabase
      .from('v_product_health')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as ProductHealthRow | null;
  },

  // Stub for later: returns product ids/names where the given field is missing.
  // Not wired to UI yet — all "what is missing" logic stays in the view.
  async getProductsMissing(
    field: keyof Omit<MissingCounts, never>,
    page = 1,
    pageSize = 50,
  ): Promise<{ id: string; name: string }[]> {
    const col = `missing_${field}` as string;
    const from = (page - 1) * pageSize;
    const { data, error } = await supabase
      .from('v_product_health')
      .select('id,name')
      .eq(col, true)
      .range(from, from + pageSize - 1);

    if (error) throw error;
    return (data ?? []) as { id: string; name: string }[];
  },
};
