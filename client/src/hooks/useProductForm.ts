import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Product } from "@/lib/supabase";
import {
  EMPTY_PRODUCT_FORM,
  ProductForm,
  productToForm,
  SaveProductOptions,
  saveProductForm,
} from "@/lib/productForm";

// Shared editor-form state + save, consumed by the detail drawer (and available
// to any other surface that edits a product). The actual create/update lives in
// saveProductForm() so the route editor and the drawer never fork their logic.
export function useProductForm(initial?: Product | null) {
  const [formData, setFormData] = useState<ProductForm>(
    initial ? productToForm(initial) : EMPTY_PRODUCT_FORM
  );
  const [saving, setSaving] = useState(false);

  const load = useCallback((product: Product | null) => {
    setFormData(product ? productToForm(product) : EMPTY_PRODUCT_FORM);
  }, []);

  const updateForm = useCallback(
    <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
      setFormData(current => ({ ...current, [key]: value }));
    },
    []
  );

  const isNA = useCallback(
    (field: string) => formData.na_fields.includes(field),
    [formData.na_fields]
  );

  const toggleNA = useCallback((field: string) => {
    setFormData(current => {
      const set = new Set(current.na_fields);
      if (set.has(field)) set.delete(field);
      else set.add(field);
      return { ...current, na_fields: Array.from(set) };
    });
  }, []);

  const save = useCallback(
    async (opts: SaveProductOptions = {}): Promise<Product | null> => {
      if (!formData.name.trim()) {
        toast.error("Product name is required");
        return null;
      }
      setSaving(true);
      try {
        return await saveProductForm(formData, opts);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save product");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [formData]
  );

  return {
    formData,
    setFormData,
    updateForm,
    load,
    isNA,
    toggleNA,
    saving,
    save,
  };
}
