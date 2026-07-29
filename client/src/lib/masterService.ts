import {
  supabase,
  Product,
  Category,
  ProductMaster as ProductMasterRow,
} from "./supabase";
import {
  SERIES_SELECT,
  resolveSeriesAll,
  type ProductWithSeries,
} from "./seriesInheritance";

/**
 * A series row plus the relations it is always read with. The base columns live
 * in `supabase.ts` (`ProductMaster`); this adds the embedded category name and
 * image list that `getMasters()` selects.
 */
export interface ProductMaster extends ProductMasterRow {
  categories?: { name: string };
  product_master_images?: ProductMasterImage[];
}

export interface ProductMasterImage {
  id: string;
  master_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
  created_at: string;
}

const isDemo = import.meta.env.VITE_DEMO_MODE === "true";

/**
 * Derives `products.variant_sort` from a size label ("250 ml" → 250) so the
 * storefront selector runs small→large without the operator ordering by hand.
 * Returns null when the label doesn't start with a number, in which case the
 * query's secondary sort on `variant_label` takes over.
 */
export function variantSortFromLabel(label: string): number | null {
  const match = label.trim().match(/^\d+/);
  return match ? Number(match[0]) : null;
}

export const masterService = {
  async getMasters() {
    const { data, error } = await supabase
      .from("product_masters")
      .select("*, categories(name), product_master_images(*)")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching masters:", error);
      return [];
    }
    return data as ProductMaster[];
  },

  async getMasterById(id: string) {
    const { data, error } = await supabase
      .from("product_masters")
      .select("*, categories(name)")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as ProductMaster;
  },

  async findMasterByName(name: string) {
    const { data, error } = await supabase
      .from("product_masters")
      .select("*")
      .eq("name", name)
      .maybeSingle();

    if (error) throw error;
    return data as ProductMaster | null;
  },

  // sort_order is optional — the column defaults to 0, so a caller that doesn't
  // care about series ordering doesn't have to supply one.
  async createMaster(
    formData: Omit<
      ProductMaster,
      "id" | "created_at" | "updated_at" | "sort_order"
    > & { sort_order?: number }
  ) {
    const { data, error } = await supabase
      .from("product_masters")
      .insert(formData)
      .select()
      .single();

    if (error) throw error;
    return data as ProductMaster;
  },

  async updateMaster(id: string, updates: Partial<ProductMaster>) {
    const { data, error } = await supabase
      .from("product_masters")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as ProductMaster;
  },

  async deleteMaster(id: string) {
    const { error } = await supabase
      .from("product_masters")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  },

  // Public storefront call — only published variants are returned so a draft
  // variant never shows in the product page variant selector.
  //
  // Ordered by variant_sort (P2), not price. Ordering a size selector by price
  // meant it silently reshuffled whenever a price was edited, and collapsed
  // entirely for On-Enquiry variants where price is NULL. variant_sort falls
  // back to the label so an unsorted series still reads sensibly.
  async getVariantsByMasterId(masterId: string) {
    const { data, error } = await supabase
      .from("products")
      .select(`*,${SERIES_SELECT}`)
      .eq("master_id", masterId)
      // The publish gate is status='published' AND is_active — this method
      // checked only status, so a deactivated variant (HINGED-BOX-2250-ML) was
      // still selectable on the PDP while being absent from /catalog. Fixed
      // here rather than filed: it is one line in a method this PR rewrites.
      .eq("status", "published")
      .eq("is_active", true)
      .order("variant_sort", { ascending: true, nullsFirst: false })
      .order("variant_label", { ascending: true });

    if (error) {
      console.error("Error fetching variants:", error);
      return [];
    }
    return resolveSeriesAll(data as unknown as ProductWithSeries[]);
  },

  // Admin call — every variant of a master regardless of status (draft +
  // published), for the admin variants matrix. Mirrors getVariantsByMasterId
  // but without the published-only gate, and deliberately WITHOUT series
  // resolution: the admin matrix edits these rows, so it must show what is
  // actually stored (see seriesInheritance.ts).
  async getVariantsByMasterIdAdmin(masterId: string) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("master_id", masterId)
      .order("variant_sort", { ascending: true, nullsFirst: false })
      .order("variant_label", { ascending: true });

    if (error) {
      console.error("Error fetching variants:", error);
      return [];
    }
    return data as Product[];
  },

  async addVariant(variant: {
    master_id: string;
    variant_label: string;
    price: number | null;
    mrp: number | null;
    moq: number | null;
    unit_of_measure: string;
    sku?: string;
  }) {
    // Fetch master metadata
    const master = await this.getMasterById(variant.master_id);

    // Auto-generate SKU if not provided
    const sku =
      variant.sku ||
      `${master.slug.toUpperCase()}-${variant.variant_label.replace(/\s+/g, "-").toUpperCase()}`;

    // Concatenate name for listing
    const name = `${master.name} ${variant.variant_label}`;

    // P2: brand, description and image_url are NO LONGER copied from the
    // series. They resolve at read time (seriesInheritance.ts), so a later edit
    // to the series reaches this variant instead of stopping at the snapshot
    // taken here. Leaving them unset is what makes the variant inherit.
    //
    // category_id is the one exception and is still copied: products.category_id
    // is NOT NULL, so a variant cannot defer it to the series. Making it
    // nullable would undermine the `uncategorized` sentinel that exists exactly
    // so every product has a category. Recorded as a known limitation.
    const { data, error } = await supabase
      .from("products")
      .insert({
        master_id: variant.master_id,
        variant_label: variant.variant_label,
        variant_sort: variantSortFromLabel(variant.variant_label),
        name: name,
        category_id: master.category_id,
        price: variant.price ?? null,
        mrp: variant.mrp ?? null,
        moq: variant.moq ?? null,
        unit_of_measure: variant.unit_of_measure,
        sku: sku,
        is_active: true,
        is_featured: false,
        status: "draft",
      })
      .select()
      .single();

    if (error) throw error;
    return data as Product;
  },

  async deleteVariant(id: string) {
    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) throw error;
    return true;
  },

  async getMasterImages(masterId: string) {
    const { data, error } = await supabase
      .from("product_master_images")
      .select("*")
      .eq("master_id", masterId)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching master images:", error);
      return [];
    }
    return data as ProductMasterImage[];
  },

  async uploadMasterImage(
    masterId: string,
    file: File,
    isPrimary: boolean = false
  ) {
    if (isDemo) {
      console.warn("Demo mode: Image not uploaded");
      return {
        id: "demo",
        master_id: masterId,
        image_url: "demo",
        is_primary: isPrimary,
      };
    }

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${masterId}-${Date.now()}.${fileExt}`;
      const filePath = `masters/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      // Insert database reference
      const { data: dbData, error: dbError } = await supabase
        .from("product_master_images")
        .insert({
          master_id: masterId,
          image_url: publicUrl,
          is_primary: isPrimary,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // P2: no push-down. A variant with no image_url of its own resolves to
      // the series' primary image at read time, so copying the URL into product
      // rows here would only create stale duplicates to keep in sync.
      return dbData as ProductMasterImage;
    } catch (error) {
      console.error("Error uploading master image:", error);
      throw error;
    }
  },

  async deleteMasterImage(id: string) {
    const { data: img, error: fetchError } = await supabase
      .from("product_master_images")
      .select("image_url, master_id, is_primary")
      .eq("id", id)
      .single();

    if (!fetchError && img) {
      try {
        const parts = img.image_url.split("/product-images/");
        if (parts.length > 1) {
          const filePath = parts[1];
          await supabase.storage.from("product-images").remove([filePath]);
        }
      } catch (e) {
        console.error("Error deleting file from storage:", e);
      }
    }

    const { error } = await supabase
      .from("product_master_images")
      .delete()
      .eq("id", id);

    if (error) throw error;

    // If we deleted the primary, assign a new primary if images remain
    if (img?.is_primary) {
      const remaining = await this.getMasterImages(img.master_id);
      if (remaining.length > 0) {
        await this.setMasterPrimaryImage(img.master_id, remaining[0].id);
      }
    }

    return true;
  },

  async setMasterPrimaryImage(masterId: string, imageId: string) {
    // Reset all to false first
    await supabase
      .from("product_master_images")
      .update({ is_primary: false })
      .eq("master_id", masterId);

    // Set selected to true
    const { data: selected, error } = await supabase
      .from("product_master_images")
      .update({ is_primary: true })
      .eq("id", imageId)
      .select()
      .single();

    if (error) throw error;

    // P2: the unconditional `UPDATE products SET image_url = … WHERE master_id
    // = …` that used to live here is DELETED. It overwrote every variant's own
    // photo — including ones deliberately given a distinct image — every time
    // the series' primary changed. Variants without their own image_url now
    // resolve to this primary at read time instead.
    return selected as ProductMasterImage;
  },
};
