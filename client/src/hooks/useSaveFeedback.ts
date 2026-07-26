import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Shared save-feedback mechanics for product-editing surfaces.
//
// Extracted from CatalogTreeEditor (PR-A, 25 Jul 2026) so the Catalog Editor
// table and the Catalog Workbench give identical feedback rather than each
// growing its own. Three pieces, all of which existed for a reason:
//
//   committingRef — guards a save against re-entry with stale state. In the
//     table, Enter/Tab commits and then moves DOM focus, and that focus change
//     fires the editor's onBlur → a second commit from the same render's
//     closure, where the state checks all still pass. In the Workbench the same
//     shape appears as double-firing "Save & Next" (Enter + click, or a fast
//     double Enter). Two productService.update() calls and two toasts either way.
//
//   flashSaved — a ~1.2s row pulse. A transient bottom-right toast alone reads
//     identical to nothing happening when your eyes are on the field you just
//     left (DE-02).
//
//   toastWithUndo — success toast carrying an Undo action, the pattern
//     handleTogglePublish established. The revert callback owns restoring both
//     local state and the database.
const FLASH_MS = 1200;

export function useSaveFeedback() {
  const committingRef = useRef(false);

  const [flashRows, setFlashRows] = useState<Set<string>>(new Set());
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const flashSaved = useCallback((id: string) => {
    setFlashRows(prev => new Set(prev).add(id));
    clearTimeout(flashTimers.current[id]);
    flashTimers.current[id] = setTimeout(() => {
      setFlashRows(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      delete flashTimers.current[id];
    }, FLASH_MS);
  }, []);

  useEffect(() => {
    const timers = flashTimers.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  const isFlashing = useCallback(
    (id: string) => flashRows.has(id),
    [flashRows]
  );

  return { committingRef, flashRows, flashSaved, isFlashing };
}

// Success toast with an Undo action. `revert` is responsible for putting both
// the local state and the database back; it reports its own outcome so a failed
// undo is never silent.
export function toastWithUndo(message: string, revert: () => Promise<void>) {
  toast.success(message, {
    action: {
      label: "Undo",
      onClick: async () => {
        try {
          await revert();
          toast.success("Undone");
        } catch {
          toast.error("Undo failed");
        }
      },
    },
  });
}
