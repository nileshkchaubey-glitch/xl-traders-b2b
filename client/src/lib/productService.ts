import {
  supabase,
  Product,
  Category,
  ProductImage,
  Enquiry,
  Inquiry,
  ProductStatus,
} from "./supabase";
import { demoProducts, demoCategories } from "./demoData";

// Demo mode is opt-in only (VITE_DEMO_MODE=true). The supabase client now
// always has real credentials via built-in fallbacks, so we never fall into
// demo mode by accident on a deployment that lacks VITE_SUPABASE_URL.
const isDemo = import.meta.env.VITE_DEMO_MODE === "true";

// Columns granted to anon role — must exactly match sql/04-price-column-security.sql.
// price, mrp, and discount_percent are intentionally excluded.
// stock_status, tags, min_order_qty are omitted here because they are from
// untracked migrations and may not exist in all DB instances; they ARE granted
// conditionally by the SQL via a DO $$ existence check.
const GUEST_PRODUCT_COLS =
  "id,name,category_id,description,sku,unit_of_measure,quantity_in_unit," +
  "image_url,image_alt_text,image_description,specifications," +
  "is_active,is_featured,status,display_order,brand,created_at,updated_at";

// SECURITY-SENSITIVE CACHE: productSelectCols() gates the price/mrp/discount
// columns (guests must never see them). supabase.auth.getSession() does
// async storage I/O on every product fetch, so we cache the has-session flag
// here — BUT a stale `true` after logout would leak price columns to anon
// users, so authStore's onAuthStateChange calls invalidateSessionCache() on
// every auth event (SIGNED_IN / SIGNED_OUT / etc.) to force a re-check.
let cachedHasSession: boolean | null = null;

export function invalidateSessionCache() {
  cachedHasSession = null;
}

// Returns the right SELECT columns based on whether the caller has a session.
// Authenticated users get all columns (*). Guests get GUEST_PRODUCT_COLS only.
async function productSelectCols(): Promise<string> {
  if (cachedHasSession === null) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    cachedHasSession = !!session;
  }
  return cachedHasSession ? "*" : GUEST_PRODUCT_COLS;
}

// ============================================================================
// CATEGORIES
// ============================================================================

export interface CategoryGroup {
  group_name: string;
  group_order: number;
  categories: Category[];
}

export const categoryService = {
  async getAll() {
    if (isDemo) return demoCategories;

    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as Category[];
    } catch (error) {
      console.error("Error fetching categories:", error);
      return [];
    }
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as Category;
  },

  async create(category: Omit<Category, "id" | "created_at" | "updated_at">) {
    const { data, error } = await supabase
      .from("categories")
      .insert(category)
      .select()
      .single();

    if (error) throw error;
    return data as Category;
  },

  async update(id: string, updates: Partial<Category>) {
    const { data, error } = await supabase
      .from("categories")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as Category;
  },

  async delete(id: string) {
    const { error } = await supabase.from("categories").delete().eq("id", id);

    if (error) throw error;
  },

  // Resolves the Uncategorized category id, self-healing if it is missing.
  // Looks up by slug with NO is_active filter (the category may have been
  // deactivated but still needs to catch products saved without a category).
  // If no row exists, it creates one so a blank-category save never fails.
  async getOrCreateUncategorized(): Promise<string | null> {
    try {
      const { data: existing } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", "uncategorized")
        .maybeSingle();
      if (existing?.id) return existing.id;

      const { data: created, error } = await supabase
        .from("categories")
        .insert({
          name: "Uncategorized",
          slug: "uncategorized",
          description: "Products without a category",
          display_order: 999,
          is_active: true,
        })
        .select("id")
        .single();
      if (error) {
        console.error("Error creating Uncategorized category:", error);
        return null;
      }
      return created?.id ?? null;
    } catch (error) {
      console.error("Error resolving Uncategorized category:", error);
      return null;
    }
  },

  // Returns categories bucketed by group_name, sorted by group_order.
  // Returns [] when no category has a group_name yet (caller falls back to flat list).
  async getCategoriesGroupedByGroup(): Promise<CategoryGroup[]> {
    if (isDemo) return [];
    const cats = await this.getAll();
    if (!cats.some(c => c.group_name)) return [];

    const groupMap = new Map<string, CategoryGroup>();
    for (const cat of cats) {
      const key = cat.group_name ?? "__other__";
      const displayName = cat.group_name ?? "Other";
      const order = cat.group_name ? (cat.group_order ?? 999) : 999;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          group_name: displayName,
          group_order: order,
          categories: [],
        });
      }
      groupMap.get(key)!.categories.push(cat);
    }
    return [...groupMap.values()].sort((a, b) => a.group_order - b.group_order);
  },
};

// ============================================================================
// PRODUCTS
// ============================================================================

// Bulk writes go out in chunks so a "select all 1000 matching" action stays a
// handful of `UPDATE … WHERE id IN (…)` statements (never one write per row)
// and the id list never blows past the request URL limit.
const BULK_CHUNK = 300;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Fields the operator may set in bulk. price/mrp/discount_percent are
// deliberately excluded — bulk price edits stay out for now (price security).
export type BulkEditableField =
  | "brand"
  | "moq"
  | "unit_of_measure"
  | "category_id"
  | "is_active";
const BULK_EDITABLE_FIELDS: BulkEditableField[] = [
  "brand",
  "moq",
  "unit_of_measure",
  "category_id",
  "is_active",
];

export const productService = {
  async getAll(filters?: {
    categoryId?: string;
    categoryIds?: string[];
    search?: string;
    featured?: boolean;
    brand?: string;
  }) {
    if (isDemo) {
      let results = [...demoProducts];
      if (filters?.categoryId)
        results = results.filter(p => p.category_id === filters.categoryId);
      if (filters?.categoryIds?.length)
        results = results.filter(p =>
          filters.categoryIds!.includes(p.category_id)
        );
      if (filters?.featured) results = results.filter(p => p.is_featured);
      if (filters?.brand)
        results = results.filter(p => p.brand === filters.brand);
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        results = results.filter(
          p =>
            p.name.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q)
        );
      }
      return results;
    }

    try {
      const cols = await productSelectCols();
      // Public visibility = published AND active. Drafts never appear publicly.
      let query = supabase
        .from("products")
        .select(cols)
        .eq("status", "published")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (filters?.categoryId) {
        query = query.eq("category_id", filters.categoryId);
      }

      if (filters?.categoryIds?.length) {
        query = query.in("category_id", filters.categoryIds);
      }

      if (filters?.featured) {
        query = query.eq("is_featured", true);
      }

      if (filters?.brand) {
        query = query.eq("brand", filters.brand);
      }

      if (filters?.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Product[];
    } catch (error) {
      console.error("Error fetching products:", error);
      return [];
    }
  },

  // Admin-scoped listing: unlike getAll() above, this returns every status
  // (draft + published, active + inactive) since admin screens must see the
  // whole catalogue, not just what's public. Sort/search/category/status are
  // applied server-side; `ids` (optional) intersects with a caller-supplied id
  // set — e.g. from healthService.getIdsMissing() — so "missing X" filters can
  // AND in without this method knowing anything about v_product_health.
  async getAllAdmin(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    categoryId?: string;
    status?: "all" | "draft" | "published" | "active" | "inactive" | "featured";
    sortField?: "name" | "price" | "created_at";
    sortAscending?: boolean;
    ids?: string[];
  }): Promise<{ data: Product[]; count: number }> {
    const {
      page = 1,
      pageSize = 50,
      search,
      categoryId,
      status = "all",
      sortField = "created_at",
      sortAscending = false,
      ids,
    } = params;

    if (ids && ids.length === 0) return { data: [], count: 0 };

    let query = supabase
      .from("products")
      .select("*", { count: "exact" })
      .order(sortField, { ascending: sortAscending });

    if (search?.trim()) query = query.ilike("name", `%${search.trim()}%`);
    if (categoryId && categoryId !== "all")
      query = query.eq("category_id", categoryId);
    if (status === "active") query = query.eq("is_active", true);
    else if (status === "inactive") query = query.eq("is_active", false);
    else if (status === "featured") query = query.eq("is_featured", true);
    else if (status === "draft") query = query.eq("status", "draft");
    else if (status === "published") query = query.eq("status", "published");
    if (ids) query = query.in("id", ids);

    query = query.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: (data as Product[]) ?? [], count: count ?? 0 };
  },

  async getBrands(): Promise<string[]> {
    if (isDemo) return [];
    try {
      const { data, error } = await supabase
        .from("products")
        .select("brand")
        .eq("status", "published")
        .eq("is_active", true)
        .not("brand", "is", null);
      if (error) throw error;
      const brands = [
        ...new Set(
          (data as { brand: string | null }[])
            .map(p => p.brand)
            .filter((b): b is string => !!b)
        ),
      ].sort();
      return brands;
    } catch {
      return [];
    }
  },

  // Public callers (ProductDetail) get published products only. Admin callers
  // pass { includeUnpublished: true } so the editor can load drafts.
  async getById(id: string, opts?: { includeUnpublished?: boolean }) {
    if (isDemo) {
      return demoProducts.find(p => p.id === id) || null;
    }

    try {
      const cols = await productSelectCols();
      let query = supabase.from("products").select(cols).eq("id", id);
      if (!opts?.includeUnpublished) query = query.eq("status", "published");
      const { data, error } = await query.single();

      if (error) throw error;
      return data as Product;
    } catch (error) {
      console.error("Error fetching product:", error);
      return null;
    }
  },

  async getByIdWithImages(id: string) {
    const product = await this.getById(id);
    const images = await productImageService.getByProductId(id);
    return { ...product, images };
  },

  async getFeatured(limit: number = 6) {
    if (isDemo) {
      return demoProducts.filter(p => p.is_featured).slice(0, limit);
    }

    try {
      const cols = await productSelectCols();
      const { data, error } = await supabase
        .from("products")
        .select(cols)
        .eq("status", "published")
        .eq("is_active", true)
        .eq("is_featured", true)
        .order("display_order", { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data as Product[];
    } catch (error) {
      console.error("Error fetching featured products:", error);
      return [];
    }
  },

  async search(query: string, limit: number = 20) {
    if (isDemo) {
      const q = query.toLowerCase();
      return demoProducts
        .filter(
          p =>
            p.name.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q)
        )
        .slice(0, limit);
    }

    try {
      const cols = await productSelectCols();
      const { data, error } = await supabase
        .from("products")
        .select(cols)
        .eq("status", "published")
        .eq("is_active", true)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(limit);

      if (error) throw error;
      return data as Product[];
    } catch (error) {
      console.error("Error searching products:", error);
      return [];
    }
  },

  async create(product: Omit<Product, "id" | "created_at" | "updated_at">) {
    // New products are drafts unless a status is explicitly provided, so nothing
    // reaches the storefront until it is published.
    const payload = { ...product, status: product.status ?? "draft" };
    const { data, error } = await supabase
      .from("products")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as Product;
  },

  async update(id: string, updates: Partial<Product>) {
    const { data, error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as Product;
  },

  async delete(id: string) {
    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) throw error;
  },

  // Publish one or more products (storefront-visible once active too).
  async publishProducts(ids: string[]) {
    if (!ids.length) return;
    const { error } = await supabase
      .from("products")
      .update({ status: "published" as ProductStatus })
      .in("id", ids);
    if (error) throw error;
  },

  // ── Bulk edits ─────────────────────────────────────────────────────────────
  // Set a single whitelisted field to one value across many products in one
  // UPDATE per chunk. Returns the number of ids targeted.
  async bulkUpdateField(
    ids: string[],
    field: BulkEditableField,
    value: string | number | boolean | null
  ): Promise<number> {
    if (!ids.length) return 0;
    if (!BULK_EDITABLE_FIELDS.includes(field)) {
      throw new Error(`Field "${field}" is not allowed in bulk edit`);
    }
    for (const part of chunk(ids, BULK_CHUNK)) {
      const { error } = await supabase
        .from("products")
        .update({ [field]: value })
        .in("id", part);
      if (error) throw error;
    }
    return ids.length;
  },

  async bulkSetStatus(ids: string[], status: ProductStatus): Promise<number> {
    if (!ids.length) return 0;
    for (const part of chunk(ids, BULK_CHUNK)) {
      const { error } = await supabase
        .from("products")
        .update({ status })
        .in("id", part);
      if (error) throw error;
    }
    return ids.length;
  },

  async bulkDelete(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    for (const part of chunk(ids, BULK_CHUNK)) {
      const { error } = await supabase.from("products").delete().in("id", part);
      if (error) throw error;
    }
    return ids.length;
  },

  // Add/remove fields from each product's na_fields ("not applicable") array.
  // Each row's array differs, so we read current values, compute the new array
  // per row, then group rows that end up identical into a single UPDATE — the
  // number of writes is bounded by distinct results, never one per row.
  async bulkSetNA(
    ids: string[],
    fields: string[],
    on: boolean
  ): Promise<number> {
    if (!ids.length || !fields.length) return 0;

    const rows: { id: string; na_fields: string[] | null }[] = [];
    for (const part of chunk(ids, BULK_CHUNK)) {
      const { data, error } = await supabase
        .from("products")
        .select("id,na_fields")
        .in("id", part);
      if (error) throw error;
      rows.push(
        ...((data ?? []) as { id: string; na_fields: string[] | null }[])
      );
    }

    const groups = new Map<string, { value: string[]; ids: string[] }>();
    for (const row of rows) {
      const set = new Set(row.na_fields ?? []);
      if (on) fields.forEach(f => set.add(f));
      else fields.forEach(f => set.delete(f));
      const value = [...set].sort();
      const key = JSON.stringify(value);
      const group = groups.get(key) ?? { value, ids: [] };
      group.ids.push(row.id);
      groups.set(key, group);
    }

    for (const { value, ids: groupIds } of groups.values()) {
      for (const part of chunk(groupIds, BULK_CHUNK)) {
        const { error } = await supabase
          .from("products")
          .update({ na_fields: value })
          .in("id", part);
        if (error) throw error;
      }
    }
    return rows.length;
  },

  async toggleActive(id: string, isActive: boolean) {
    return this.update(id, { is_active: isActive });
  },

  async toggleFeatured(id: string, isFeatured: boolean) {
    return this.update(id, { is_featured: isFeatured });
  },
};

// ============================================================================
// PRODUCT IMAGES
// ============================================================================

export const productImageService = {
  async getByProductId(productId: string) {
    if (isDemo) return [];

    try {
      const { data, error } = await supabase
        .from("product_images")
        .select("*")
        .eq("product_id", productId)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as ProductImage[];
    } catch (error) {
      console.error("Error fetching product images:", error);
      return [];
    }
  },

  async create(image: Omit<ProductImage, "id" | "created_at">) {
    const { data, error } = await supabase
      .from("product_images")
      .insert(image)
      .select()
      .single();

    if (error) throw error;
    return data as ProductImage;
  },

  // Batch insert — one round-trip instead of N sequential creates.
  async createMany(images: Array<Omit<ProductImage, "id" | "created_at">>) {
    if (!images.length) return [];
    const { data, error } = await supabase
      .from("product_images")
      .insert(images)
      .select();

    if (error) throw error;
    return (data ?? []) as ProductImage[];
  },

  async update(id: string, updates: Partial<ProductImage>) {
    const { data, error } = await supabase
      .from("product_images")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as ProductImage;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("product_images")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};

// ============================================================================
// ENQUIRIES
// ============================================================================

export const enquiryService = {
  async create(enquiry: Omit<Enquiry, "id" | "created_at" | "updated_at">) {
    const { data, error } = await supabase
      .from("enquiries")
      .insert(enquiry)
      .select()
      .single();

    if (error) throw error;
    return data as Enquiry;
  },

  async getByUserId(userId: string) {
    const { data, error } = await supabase
      .from("enquiries")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as Enquiry[];
  },

  async getAll() {
    const { data, error } = await supabase
      .from("enquiries")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as Enquiry[];
  },

  async updateStatus(id: string, status: string) {
    const { data, error } = await supabase
      .from("enquiries")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as Enquiry;
  },
};

// ============================================================================
// STORAGE
// ============================================================================

export const storageService = {
  async uploadProductImage(file: File, productId: string) {
    if (isDemo) {
      console.warn("Demo mode: Image not uploaded");
      return "";
    }

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${productId}-${Date.now()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  },

  async deleteProductImage(filePath: string) {
    const { error } = await supabase.storage
      .from("product-images")
      .remove([filePath]);

    if (error) throw error;
  },

  getPublicUrl(filePath: string) {
    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);

    return data.publicUrl;
  },
};

// ============================================================================
// MEDIA / IMAGE LIBRARY SERVICE
// ============================================================================

export interface MediaImage {
  url: string;
  name: string;
  source: "storage" | "database";
  created_at?: string | null;
  size?: number;
}

export const mediaService = {
  async listAllImages(): Promise<MediaImage[]> {
    if (isDemo) return [];
    try {
      // 1. Fetch images from Supabase Storage
      let storageImages: MediaImage[] = [];
      try {
        const { data: storageFiles, error: storageError } =
          await supabase.storage
            .from("product-images")
            .list("products", { limit: 100 });

        if (!storageError && storageFiles) {
          storageImages = storageFiles
            .filter(f => f.name !== ".emptyFolderPlaceholder")
            .map(f => {
              const filePath = `products/${f.name}`;
              const { data } = supabase.storage
                .from("product-images")
                .getPublicUrl(filePath);
              return {
                url: data.publicUrl,
                name: f.name,
                source: "storage" as const,
                created_at: f.created_at,
                size: f.metadata?.size,
              };
            });
        }
      } catch (err) {
        console.warn("Could not load files from Supabase storage:", err);
      }

      // 2. Fetch image URLs from products table
      let productsData: any[] = [];
      try {
        const { data } = await supabase
          .from("products")
          .select("image_url, name, created_at");
        if (data) productsData = data;
      } catch (err) {
        console.warn("Could not load images from products table:", err);
      }

      // 3. Fetch image URLs from product_images table
      let galleryData: any[] = [];
      try {
        const { data } = await supabase
          .from("product_images")
          .select("image_url, alt_text, created_at");
        if (data) galleryData = data;
      } catch (err) {
        console.warn("Could not load images from product_images table:", err);
      }

      const dbImagesMap = new Map<string, MediaImage>();

      for (const p of productsData) {
        if (p.image_url) {
          const url = p.image_url.trim();
          if (!dbImagesMap.has(url)) {
            dbImagesMap.set(url, {
              url,
              name: p.name || "Product Image",
              source: "database" as const,
              created_at: p.created_at,
            });
          }
        }
      }

      for (const g of galleryData) {
        if (g.image_url) {
          const url = g.image_url.trim();
          if (!dbImagesMap.has(url)) {
            dbImagesMap.set(url, {
              url,
              name: g.alt_text || "Gallery Image",
              source: "database" as const,
              created_at: g.created_at,
            });
          }
        }
      }

      const dbImages = Array.from(dbImagesMap.values());

      // Combine both lists. Deduplicate by URL (prefer storage version if URL matches)
      const combinedMap = new Map<string, MediaImage>();

      // Add db images first
      for (const img of dbImages) {
        combinedMap.set(img.url, img);
      }

      // Overwrite/add storage images
      for (const img of storageImages) {
        combinedMap.set(img.url, img);
      }

      // Sort by created_at desc
      return Array.from(combinedMap.values()).sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
    } catch (error) {
      console.error("Error in mediaService.listAllImages:", error);
      return [];
    }
  },

  async uploadGlobalImage(file: File): Promise<string> {
    if (isDemo) return "";
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `global-${Date.now()}-${Math.random().toString(36).substr(2, 6)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error("Error uploading global image:", error);
      throw error;
    }
  },
};

// ============================================================================
// INQUIRIES — lightweight log for every WhatsApp button click (all users)
// ============================================================================

export const inquiriesService = {
  async create(inquiry: Omit<Inquiry, "id" | "created_at">) {
    const { error } = await supabase.from("inquiries").insert(inquiry);

    if (error) throw error;
  },
};
