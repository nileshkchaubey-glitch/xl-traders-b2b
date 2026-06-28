import { Check, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CategoryCombobox from "@/components/admin/CategoryCombobox";
import { Category } from "@/lib/supabase";

const UNITS = ["pcs", "box", "pack", "roll", "kg", "litre", "set"];

export interface RapidEntryValues {
  name: string;
  category_id: string;
  price: string;
  unit_of_measure: string;
}

interface RapidEntryRowProps {
  values: RapidEntryValues;
  adding: boolean;
  categories: Category[];
  nameRef: React.RefObject<HTMLInputElement | null>;
  onChange: (patch: Partial<RapidEntryValues>) => void;
  onSubmit: () => void;
  onClose: () => void;
}

// Single-line fast add: name, category, price, unit. Enter saves & refocuses the
// name field for the next entry. The rest of the fields live in the drawer.
export default function RapidEntryRow({
  values,
  adding,
  categories,
  nameRef,
  onChange,
  onSubmit,
  onClose,
}: RapidEntryRowProps) {
  const submitOnEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSubmit();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 shadow-sm">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-500">
        {adding ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
      </span>
      <Input
        ref={nameRef}
        value={values.name}
        onChange={e => onChange({ name: e.target.value })}
        onKeyDown={submitOnEnter}
        placeholder="Product name *"
        className="h-8 min-w-[180px] flex-1 border-green-300 bg-white text-sm focus:border-green-500"
        disabled={adding}
      />
      <div className="w-44">
        <CategoryCombobox
          categories={categories}
          value={values.category_id}
          onChange={v => onChange({ category_id: v })}
          placeholder="Category"
          className="h-8 border-green-300 bg-white text-sm"
        />
      </div>
      <Input
        type="number"
        step="0.01"
        min="0"
        value={values.price}
        onChange={e => onChange({ price: e.target.value })}
        onKeyDown={submitOnEnter}
        placeholder="Price"
        className="h-8 w-24 border-green-300 bg-white text-sm"
        disabled={adding}
      />
      <Select
        value={values.unit_of_measure}
        onValueChange={v => onChange({ unit_of_measure: v })}
      >
        <SelectTrigger className="h-8 w-24 border-green-300 bg-white text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {UNITS.map(u => (
            <SelectItem key={u} value={u}>
              {u}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        onClick={onSubmit}
        disabled={adding}
        className="h-8 gap-1 bg-green-600 px-3 hover:bg-green-700"
      >
        {adding ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Check className="h-3 w-3" />
        )}
        Add
      </Button>
      <button
        onClick={onClose}
        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
        aria-label="Hide quick add"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
