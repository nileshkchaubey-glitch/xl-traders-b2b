import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ProductForm } from "@/lib/productForm";
import {
  formatOrderQty,
  initialPacks,
  orderingSettings,
} from "@/lib/orderingModel";

type OrderingKey = "order_unit" | "moq" | "order_step";

/** Shared by both editors; customer quantities are separate from price entry. */
export default function OrderingFields({
  form,
  onChange,
}: {
  form: ProductForm;
  onChange: <K extends OrderingKey>(key: K, value: ProductForm[K]) => void;
}) {
  const id = useId();
  const settings = orderingSettings(form);
  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-3">
      <legend className="px-1 text-sm font-semibold">Customer Ordering</legend>
      <p className="text-xs text-muted-foreground">
        How customers count quantities. This does not change the selling-unit
        price or price-entry mode.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-unit`}>Order unit</Label>
          <Select
            value={form.order_unit}
            onValueChange={value =>
              onChange("order_unit", value === "pcs" ? "pcs" : "pack")
            }
          >
            <SelectTrigger id={`${id}-unit`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pack">Packs</SelectItem>
              <SelectItem value="pcs">Pieces (pcs)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-size`}>Pack size (pieces)</Label>
          <Input
            id={`${id}-size`}
            readOnly
            value={form.quantity_in_unit}
            placeholder="Unknown"
          />
          <p className="text-xs text-muted-foreground">
            From Qty / pack above.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-moq`}>MOQ (packs)</Label>
          <Input
            id={`${id}-moq`}
            type="number"
            min="1"
            step="1"
            value={form.moq}
            onChange={event => onChange("moq", event.target.value)}
            placeholder="Default: 1 pack"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-step`}>Order step (pieces)</Label>
          <Input
            id={`${id}-step`}
            type="number"
            min="1"
            step="1"
            value={form.order_step}
            onChange={event => onChange("order_step", event.target.value)}
            placeholder={`Default: ${settings.spec.packSize}`}
          />
        </div>
      </div>
      {settings.error ? (
        <p role="alert" className="text-xs text-destructive">
          {settings.error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Minimum valid quantity:{" "}
          {formatOrderQty(initialPacks(settings.spec), settings.spec).primary}.
          Blank step uses one pack; custom steps must be whole pack-size
          multiples.
        </p>
      )}
    </fieldset>
  );
}
