import { Trash2, Plus, ExternalLink, Package } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ProductMaster } from "@/lib/masterService";
import { Product } from "@/lib/supabase";
import VariantRow from "@/components/admin/VariantRow";

interface MobileMasterSheetProps {
  master: ProductMaster | null;
  variants: Product[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addingVariant: boolean;
  onStartAddVariant: () => void;
  onCancelAddVariant: () => void;
  // All reuse the existing AdminMasters handlers / masterService methods.
  onToggleActive: (master: ProductMaster) => void;
  onDeleteMaster: (id: string) => void;
  onDeleteVariant: (id: string) => void;
  onVariantAdded: () => void;
  onEditVariant: (id: string) => void;
}

/**
 * Bottom sheet for the common master edits on mobile — toggle visibility, view
 * / add / delete variants, open a variant in the full editor, delete master.
 * No new logic: every action calls into AdminMasters' existing handlers.
 */
export default function MobileMasterSheet({
  master,
  variants,
  open,
  onOpenChange,
  addingVariant,
  onStartAddVariant,
  onCancelAddVariant,
  onToggleActive,
  onDeleteMaster,
  onDeleteVariant,
  onVariantAdded,
  onEditVariant,
}: MobileMasterSheetProps) {
  if (!master) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="truncate">{master.name}</DrawerTitle>
          <DrawerDescription>
            {master.categories?.name || "Uncategorized"} · {variants.length}{" "}
            variant{variants.length === 1 ? "" : "s"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4 overflow-y-auto">
          {/* Visibility */}
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span>
              <span className="block text-sm font-medium text-slate-800">
                Active
              </span>
              <span className="block text-xs text-slate-400">
                Inactive masters and their variants are hidden.
              </span>
            </span>
            <Switch
              checked={!!master.is_active}
              onCheckedChange={() => onToggleActive(master)}
            />
          </label>

          {/* Variants */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2">
              Variants
            </div>
            {variants.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                No variants yet.
              </p>
            ) : (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                {variants.map(v => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 px-3 py-2.5 min-h-[52px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-800 truncate">
                        {v.variant_label || "—"}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">
                        {v.sku}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-700 tabular-nums flex-shrink-0">
                      {v.price != null ? `₹${v.price}` : "—"}
                    </span>
                    <button
                      onClick={() => onEditVariant(v.id)}
                      aria-label="Open full editor"
                      className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 active:bg-slate-50 flex-shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteVariant(v.id)}
                      aria-label="Delete variant"
                      className="w-10 h-10 flex items-center justify-center rounded-lg text-rose-500 active:bg-rose-50 flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {addingVariant ? (
              <div className="mt-3 border border-slate-200 rounded-xl p-3">
                <VariantRow
                  masterId={master.id}
                  masterSlug={master.slug}
                  onSuccess={onVariantAdded}
                  onCancel={onCancelAddVariant}
                />
              </div>
            ) : (
              <Button
                onClick={onStartAddVariant}
                className="w-full h-11 mt-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add Variant
              </Button>
            )}
          </div>

          {/* Danger zone */}
          <button
            onClick={() => onDeleteMaster(master.id)}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-red-200 text-sm font-semibold text-red-600 active:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete master
          </button>

          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Package className="w-3.5 h-3.5" />
            Deleting a master unlinks its variants but does not delete them.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
