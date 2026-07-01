import { supabase, Product, Category } from "./supabase";

export interface ProductMaster {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  brand?: string | null;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

export const masterService = {
  async getMasters() {
    const { data, error } = await supabase
      .from("product_masters")
      .select("*, categories(name), product_master_images(*)")
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

  async createMaster(
    formData: Omit<ProductMaster, "id" | "created_at" | "updated_at">
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
  async getVariantsByMasterId(masterId: string) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("master_id", masterId)
      .eq("status", "published")
      .order("price", { ascending: true });

    if (error) {
      console.error("Error fetching variants:", error);
      return [];
    }
    return data as Product[];
  },

  // Admin call — every variant of a master regardless of status (draft +
  // published), for the admin variants matrix. Mirrors getVariantsByMasterId
  // but without the published-only gate.
  async getVariantsByMasterIdAdmin(masterId: string) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("master_id", masterId)
      .order("price", { ascending: true, nullsFirst: true });

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

    // Get any primary image of the master to set as default image_url for variant product row
    const masterImages = await this.getMasterImages(variant.master_id);
    const primaryImg =
      masterImages.find(img => img.is_primary) || masterImages[0];
    const image_url = primaryImg ? primaryImg.image_url : undefined;

    const { data, error } = await supabase
      .from("products")
      .insert({
        master_id: variant.master_id,
        variant_label: variant.variant_label,
        name: name,
        category_id: master.category_id,
        brand: master.brand || null,
        description: master.description || null,
        price: variant.price ?? null,
        mrp: variant.mrp ?? null,
        moq: variant.moq ?? null,
        unit_of_measure: variant.unit_of_measure,
        sku: sku,
        image_url: image_url || null,
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

      // If we just uploaded the primary image, update any variants without image_url
      if (isPrimary) {
        await supabase
          .from("products")
          .update({ image_url: publicUrl })
          .eq("master_id", masterId)
          .is("image_url", null);
      }

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

    // Update the image_url of all products (variants) belonging to this master to match the new primary
    await supabase
      .from("products")
      .update({ image_url: selected.image_url })
      .eq("master_id", masterId);

    return selected as ProductMasterImage;
  },
};
