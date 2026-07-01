import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { masterService, ProductMaster } from "@/lib/masterService";
import { productService } from "@/lib/productService";
import { Product, ProductStatus } from "@/lib/supabase";

// Thin wrapper around masterService — the masters + variants model already
// exists; this hook only owns the admin-v2 matrix's local state and delegates
// every read/write to the existing service (no new logic, no schema changes).
export function useVariants() {
  const [masters, setMasters] = useState<ProductMaster[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [variants, setVariants] = useState<Product[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadMasters = useCallback(async () => {
    setLoadingMasters(true);
    try {
      const rows = await masterService.getMasters();
      setMasters(rows);
      // Auto-select the first master so the matrix isn't empty on open.
      setSelectedId(prev => prev ?? rows[0]?.id ?? null);
    } catch {
      toast.error("Failed to load masters");
    } finally {
      setLoadingMasters(false);
    }
  }, []);

  useEffect(() => {
    loadMasters();
  }, [loadMasters]);

  const loadVariants = useCallback(async (masterId: string) => {
    setLoadingVariants(true);
    try {
      setVariants(await masterService.getVariantsByMasterIdAdmin(masterId));
    } catch {
      toast.error("Failed to load variants");
    } finally {
      setLoadingVariants(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadVariants(selectedId);
    else setVariants([]);
  }, [selectedId, loadVariants]);

  const addVariant = useCallback(
    async (input: {
      variant_label: string;
      price: number | null;
      mrp: number | null;
      moq: number | null;
      unit_of_measure: string;
    }) => {
      if (!selectedId) return;
      if (!input.variant_label.trim()) {
        toast.error("Variant label is required");
        return;
      }
      setBusy(true);
      try {
        await masterService.addVariant({
          master_id: selectedId,
          variant_label: input.variant_label.trim(),
          price: input.price,
          mrp: input.mrp,
          moq: input.moq,
          unit_of_measure: input.unit_of_measure,
        });
        await loadVariants(selectedId);
        toast.success("Variant added (draft)");
      } catch {
        toast.error("Failed to add variant");
      } finally {
        setBusy(false);
      }
    },
    [selectedId, loadVariants]
  );

  const deleteVariant = useCallback(
    async (id: string) => {
      if (!selectedId) return;
      setBusy(true);
      try {
        await masterService.deleteVariant(id);
        setVariants(prev => prev.filter(v => v.id !== id));
        toast.success("Variant deleted");
      } catch {
        toast.error("Failed to delete variant");
      } finally {
        setBusy(false);
      }
    },
    [selectedId]
  );

  // Inline field edit on a variant row — optimistic, persisted via the existing
  // productService.update (variants are just products with a master_id).
  const updateVariant = useCallback(
    async (id: string, patch: Partial<Product>) => {
      setVariants(prev =>
        prev.map(v => (v.id === id ? { ...v, ...patch } : v))
      );
      try {
        await productService.update(id, patch);
      } catch {
        toast.error("Update failed");
        if (selectedId) loadVariants(selectedId);
      }
    },
    [selectedId, loadVariants]
  );

  const setVariantStatus = useCallback(
    (id: string, status: ProductStatus) => updateVariant(id, { status }),
    [updateVariant]
  );

  return {
    masters,
    loadingMasters,
    selectedId,
    setSelectedId,
    selectedMaster: masters.find(m => m.id === selectedId) ?? null,
    variants,
    loadingVariants,
    busy,
    addVariant,
    deleteVariant,
    updateVariant,
    setVariantStatus,
    reloadMasters: loadMasters,
  };
}
