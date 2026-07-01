import { useState } from "react";
import { X, Loader2, Ban } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import CategoryCombobox from "@/components/admin/CategoryCombobox";
import { Category, ProductStatus } from "@/lib/supabase";

const UNITS = ["pcs", "box", "pack", "roll", "kg", "litre", "set"];

// Fields that can be marked N/A (must match the na_fields values
// v_product_health checks).
const NA_FIELDS = [
  { key: "brand", label: "Brand" },
  { key: "specifications", label: "Specs" },
  { key: "description", label: "Description" },
  { key: "image", label: "Image" },
];

interface BulkActions {
  setBrand: (value: string) => void;
  setMoq: (moq: number) => void;
  setUnit: (unit: string) => void;
  setCategory: (categoryId: string, categoryName: string) => void;
  setStatus: (status: ProductStatus) => void;
  setActive: (activate: boolean) => void;
  setNA: (fields: string[], on: boolean) => void;
  remove: () => void;
}

interface BulkActionBarProps {
  categories: Category[];
  totalCount: number;
  selectionCount: number;
  selectAllMatching: boolean;
  canSelectAllMatching: boolean;
  busy: boolean;
  onSelectAllMatching: () => void;
  onClear: () => void;
  actions: BulkActions;
}

export default function BulkActionBar({
  categories,
  totalCount,
  selectionCount,
  selectAllMatching,
  canSelectAllMatching,
  busy,
  onSelectAllMatching,
  onClear,
  actions,
}: BulkActionBarProps) {
  const [brand, setBrand] = useState("");
  const [moq, setMoq] = useState("");
  const [naOpen, setNaOpen] = useState(false);
  const [naSelected, setNaSelected] = useState<string[]>([]);

  const doBrand = () => {
    const v = brand.trim();
    if (!v) return;
    actions.setBrand(v);
    setBrand("");
  };
  const doMoq = () => {
    const n = parseInt(moq);
    if (isNaN(n) || n < 1) return;
    actions.setMoq(n);
    setMoq("");
  };
  const doNA = (on: boolean) => {
    if (!naSelected.length) return;
    setNaOpen(false);
    actions.setNA(naSelected, on);
    setNaSelected([]);
  };

  return (
    <div className="bg-white border border-slate-300 rounded-xl px-4 py-3 shadow-sm space-y-3">
      {/* Scope banner */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {selectAllMatching ? (
          <span className="font-semibold text-slate-800">
            All <span className="text-red-600">{totalCount.toLocaleString()}</span>{" "}
            matching products selected
          </span>
        ) : (
          <span className="font-semibold text-slate-800">
            {selectionCount} selected{canSelectAllMatching ? " on this page" : ""}
          </span>
        )}
        {canSelectAllMatching && (
          <>
            <span className="text-slate-300">·</span>
            <button
              onClick={onSelectAllMatching}
              className="font-semibold text-red-600 hover:text-red-700 underline underline-offset-2"
            >
              Select all {totalCount.toLocaleString()} matching the filter
            </button>
          </>
        )}
        <div className="flex-1" />
        {busy && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
        >
          <X className="w-3.5 h-3.5" /> Clear
        </button>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-1">
          <Input
            value={brand}
            onChange={e => setBrand(e.target.value)}
            placeholder="Brand…"
            className="h-8 w-28 text-sm"
            disabled={busy}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={busy}
            onClick={doBrand}
          >
            Set
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min="1"
            value={moq}
            onChange={e => setMoq(e.target.value)}
            placeholder="MOQ…"
            className="h-8 w-20 text-sm"
            disabled={busy}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={busy}
            onClick={doMoq}
          >
            Set
          </Button>
        </div>
        <Select onValueChange={v => actions.setUnit(v)} disabled={busy}>
          <SelectTrigger className="h-8 w-28 text-sm bg-slate-50">
            <SelectValue placeholder="Set unit…" />
          </SelectTrigger>
          <SelectContent>
            {UNITS.map(u => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="w-44">
          <CategoryCombobox
            categories={categories}
            value=""
            onChange={id => {
              if (id) {
                const name =
                  categories.find(c => c.id === id)?.name ?? "category";
                actions.setCategory(id, name);
              }
            }}
            placeholder="Set category…"
            className="h-8 text-sm"
          />
        </div>
        <span className="w-px h-6 bg-slate-200" />
        <Button
          size="sm"
          className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
          disabled={busy}
          onClick={() => actions.setStatus("published")}
        >
          Publish
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={busy}
          onClick={() => actions.setStatus("draft")}
        >
          Unpublish
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1"
          disabled={busy}
          onClick={() => {
            setNaSelected([]);
            setNaOpen(true);
          }}
        >
          <Ban className="w-3.5 h-3.5" /> N/A
        </Button>
        <span className="w-px h-6 bg-slate-200" />
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={busy}
          onClick={() => actions.setActive(true)}
        >
          Activate
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={busy}
          onClick={() => actions.setActive(false)}
        >
          Deactivate
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="h-8 text-xs"
          disabled={busy}
          onClick={() => actions.remove()}
        >
          Delete
        </Button>
      </div>

      {/* N/A dialog */}
      <Dialog
        open={naOpen}
        onOpenChange={o => {
          if (!o) {
            setNaOpen(false);
            setNaSelected([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark fields “Not applicable”</DialogTitle>
            <DialogDescription>
              Pick which fields don’t apply to {selectionCount.toLocaleString()}{" "}
              selected product{selectionCount === 1 ? "" : "s"}. Marking N/A
              stops these from showing as “missing data”.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {NA_FIELDS.map(f => {
              const checked = naSelected.includes(f.key);
              return (
                <label
                  key={f.key}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() =>
                      setNaSelected(prev =>
                        prev.includes(f.key)
                          ? prev.filter(k => k !== f.key)
                          : [...prev, f.key]
                      )
                    }
                  />
                  <span className="text-sm text-slate-700">{f.label}</span>
                </label>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                setNaOpen(false);
                setNaSelected([]);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !naSelected.length}
              onClick={() => doNA(false)}
            >
              Clear N/A
            </Button>
            <Button
              size="sm"
              className="bg-slate-800 hover:bg-slate-900 text-white gap-1"
              disabled={busy || !naSelected.length}
              onClick={() => doNA(true)}
            >
              <Ban className="w-3.5 h-3.5" /> Mark N/A
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
