import { categoryService, productService } from "@/lib/productService";
import { normalizeImageUrl } from "@/lib/imageUtils";
import { Product, ProductStatus } from "@/lib/supabase";

// The editor form shape, shared by the route editor (AdminProductEditor) and the
// detail drawer (ProductDrawer) so the two never drift. Kept identical to the
// route editor's form so its state stays assignable to saveProductForm().
export const EMPTY_PRODUCT_FORM = {
  name: "",
  category_id: "",
  description: "",
  price: "",
  mrp: "",
  unit_of_measure: "pcs",
  quantity_in_unit: "",
  discount_percent: "0",
  brand: "",
  is_active: true,
  is_featured: false,
  sku: "",
  barcode: "",
  moq: "",
  image_url: "",
  status: "draft" as ProductStatus,
  na_fields: [] as string[],
};

export type ProductForm = typeof EMPTY_PRODUCT_FORM;

// Product → form. Mirrors the route editor's load mapping exactly.
export function productToForm(product: Product): ProductForm {
  return {
    name: product.name,
    category_id: product.category_id,
    description: product.description || "",
    price: product.price != null ? product.price.toString() : "",
    mrp: product.mrp?.toString() || "",
    unit_of_measure: product.unit_of_measure || "pcs",
    quantity_in_unit: product.quantity_in_unit?.toString() || "",
    discount_percent: (product.discount_percent || 0).toString(),
    brand: product.brand || "",
    is_active: product.is_active,
    is_featured: product.is_featured || false,
    sku: product.sku || "",
    barcode: product.barcode || "",
    moq: product.moq != null ? product.moq.toString() : "",
    image_url: product.image_url || "",
    status: (product.status ?? "draft") as ProductStatus,
    na_fields: product.na_fields ?? [],
  };
}

export interface SaveProductOptions {
  productId?: string;
  statusOverride?: ProductStatus;
  imageMeta?: { altText?: string; description?: string };
  // Extra columns merged into the payload (e.g. SEO meta from the drawer) that
  // are not part of the core form shape.
  extra?: Partial<Product>;
}

// Single source of truth for turning the editor form into a create/update.
// Both the route editor and the detail drawer call this, so save behavior never
// forks. Image-FILE uploads and navigation stay in the caller; this handles
// category resolution, payload build, SKU autogen, and the create/update.
export async function saveProductForm(
  formData: ProductForm,
  { productId, statusOverride, imageMeta, extra }: SaveProductOptions = {}
): Promise<Product> {
  const isEditing = !!productId;

  // Resolve category — fall back to the 'Uncategorized' sentinel if none chosen.
  let categoryId = formData.category_id;
  if (!categoryId) {
    categoryId = (await categoryService.getOrCreateUncategorized()) ?? "";
    if (!categoryId) {
      throw new Error("Could not assign the Uncategorized category");
    }
  }

  const productData: Record<string, unknown> = {
    name: formData.name.trim(),
    category_id: categoryId,
    description: formData.description,
    price: formData.price ? parseFloat(formData.price) : null,
    mrp: formData.mrp ? parseFloat(formData.mrp) : undefined,
    unit_of_measure: formData.unit_of_measure,
    quantity_in_unit: formData.quantity_in_unit
      ? parseInt(formData.quantity_in_unit)
      : undefined,
    discount_percent: parseInt(formData.discount_percent) || 0,
    brand: formData.brand.trim() || undefined,
    is_active: formData.is_active,
    is_featured: formData.is_featured,
    sku: formData.sku.trim() || undefined,
    barcode: formData.barcode.trim() || undefined,
    moq: formData.moq ? parseInt(formData.moq) : null,
    status: statusOverride ?? formData.status,
    na_fields: formData.na_fields,
    image_alt_text: imageMeta?.altText || formData.name.trim(),
    image_description: imageMeta?.description || "",
    ...extra,
  };
  const pastedUrl = normalizeImageUrl(formData.image_url);
  if (pastedUrl) productData.image_url = pastedUrl;
  if (!isEditing && !productData.sku) {
    productData.sku = `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  return isEditing
    ? await productService.update(productId!, productData as Partial<Product>)
    : await productService.create(
        productData as Omit<Product, "id" | "created_at" | "updated_at">
      );
}
