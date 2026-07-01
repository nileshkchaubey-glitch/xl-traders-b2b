import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { productService } from "@/lib/productService";
import { ProductStatus } from "@/lib/supabase";

interface UseBulkSelectionArgs {
  // ids on the current page (for select-all-on-page + "can select all matching")
  pageIds: string[];
  // total rows behind the active filter (for the select-all-matching scope)
  totalCount: number;
  // resolves EVERY id matching the active filter (all pages)
  getMatchingIds: () => Promise<string[]>;
  // called after any successful bulk write so the caller can refresh the grid
  onChanged: () => void;
}

// Owns multi-select + bulk write actions for the product grid. Selection state
// lives here; every write delegates to the existing productService bulk methods
// (bulkUpdateField / bulkSetStatus / bulkDelete / bulkSetNA / publishProducts) —
// the same logic /admin uses, no fork.
export function useBulkSelection({
  pageIds,
  totalCount,
  getMatchingIds,
  onChanged,
}: UseBulkSelectionArgs) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [busy, setBusy] = useState(false);

  const allPageSelected =
    pageIds.length > 0 && pageIds.every(id => selected.has(id));
  const selectionCount = selectAllMatching ? totalCount : selected.size;
  const hasSelection = selectionCount > 0;
  const canSelectAllMatching =
    allPageSelected && !selectAllMatching && totalCount > pageIds.length;

  const clear = useCallback(() => {
    setSelected(new Set());
    setSelectAllMatching(false);
  }, []);

  const toggleRow = useCallback((id: string) => {
    setSelectAllMatching(false);
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAllOnPage = useCallback(() => {
    setSelectAllMatching(false);
    setSelected(prev => {
      const everySelected =
        pageIds.length > 0 && pageIds.every(id => prev.has(id));
      return everySelected ? new Set() : new Set(pageIds);
    });
  }, [pageIds]);

  const resolveTargetIds = useCallback(async (): Promise<string[]> => {
    if (selectAllMatching) return getMatchingIds();
    return Array.from(selected);
  }, [selectAllMatching, getMatchingIds, selected]);

  // Shared flow: resolve ids → optional transform → confirm with the EXACT
  // final count → run one chunked write → refresh + clear.
  const runBulk = useCallback(
    async (
      confirmLabel: (n: number) => string,
      run: (ids: string[]) => Promise<number>,
      transform?: (ids: string[]) => Promise<{ ids: string[]; note?: string }>
    ) => {
      if (busy) return;
      setBusy(true);
      try {
        let ids = await resolveTargetIds();
        let note = "";
        if (transform) {
          const t = await transform(ids);
          ids = t.ids;
          note = t.note ?? "";
        }
        if (!ids.length) {
          toast.error("No matching products");
          return;
        }
        if (
          !window.confirm(confirmLabel(ids.length) + (note ? `\n\n${note}` : ""))
        )
          return;
        const n = await run(ids);
        toast.success(`Updated ${n} products`);
        clear();
        onChanged();
      } catch (err) {
        console.error(err);
        toast.error("Bulk action failed");
      } finally {
        setBusy(false);
      }
    },
    [busy, resolveTargetIds, clear, onChanged]
  );

  const actions = useMemo(
    () => ({
      setBrand: (value: string) =>
        runBulk(
          n => `Set brand to "${value}" for ${n} products?`,
          ids => productService.bulkUpdateField(ids, "brand", value)
        ),
      setMoq: (moq: number) =>
        runBulk(
          n => `Set MOQ to ${moq} for ${n} products?`,
          ids => productService.bulkUpdateField(ids, "moq", moq)
        ),
      setUnit: (unit: string) =>
        runBulk(
          n => `Set unit to "${unit}" for ${n} products?`,
          ids => productService.bulkUpdateField(ids, "unit_of_measure", unit)
        ),
      setCategory: (categoryId: string, categoryName: string) =>
        runBulk(
          n => `Set category to "${categoryName}" for ${n} products?`,
          ids =>
            productService.bulkUpdateField(ids, "category_id", categoryId)
        ),
      setStatus: (status: ProductStatus) =>
        runBulk(
          n =>
            `${status === "published" ? "Publish" : "Unpublish"} ${n} products?`,
          ids => productService.bulkSetStatus(ids, status)
        ),
      setActive: (activate: boolean) =>
        runBulk(
          n => `${activate ? "Activate" : "Deactivate"} ${n} products?`,
          ids => productService.bulkUpdateField(ids, "is_active", activate)
        ),
      setNA: (fields: string[], on: boolean) =>
        runBulk(
          n => `${on ? "Mark" : "Clear"} N/A (${fields.join(", ")}) for ${n} products?`,
          ids => productService.bulkSetNA(ids, fields, on)
        ),
      remove: () =>
        runBulk(
          n => `Delete ${n} products? This cannot be undone.`,
          ids => productService.bulkDelete(ids)
        ),
    }),
    [runBulk]
  );

  return {
    selected,
    selectAllMatching,
    setSelectAllMatching,
    allPageSelected,
    selectionCount,
    hasSelection,
    canSelectAllMatching,
    busy,
    clear,
    toggleRow,
    toggleAllOnPage,
    actions,
  };
}
