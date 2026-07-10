import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Product, ProductStatus } from "@/lib/supabase";
import { ProductPatch } from "@/components/admin/products/ProductsTable";
import { isPriceOnEnquiry } from "@/lib/priceUtils";

interface ProductQuickEditSheetProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Parent persists the patch (optimistic update + toast) and closes the sheet. */
  onSave: (id: string, patch: ProductPatch) => void;
  onOpenFullEditor: (product: Product) => void;
}

/**
 * Bottom sheet for the 90% common product edits on mobile — price,
 * availability and publish state only. Everything else (variants, images,
 * specs, SEO) is deferred to the full route editor via "Open full editor".
 */
export default function ProductQuickEditSheet({
  product,
  open,
  onOpenChange,
  onSave,
  onOpenFullEditor,
}: ProductQuickEditSheetProps) {
  const [price, setPrice] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [published, setPublished] = useState(false);

  // Re-seed local fields whenever a different product opens.
  useEffect(() => {
    if (product) {
      setPrice(product.price == null ? "" : String(product.price));
      setIsActive(product.is_active ?? true);
      setPublished(product.status === "published");
    }
  }, [product]);

  if (!product) return null;

  const handleSave = () => {
    const trimmed = price.trim();
    const parsedPrice = trimmed === "" ? null : Number(trimmed);
    // Blank / 0 = "Price on enquiry" (null). A typed value must be numeric —
    // never let an invalid entry through as ₹0.
    if (parsedPrice !== null && Number.isNaN(parsedPrice)) {
      toast.error("Enter a valid price, or leave it blank for enquiry");
      return;
    }
    onSave(product.id, {
      // 0 / negative collapse to NULL so the storefront never shows ₹0.
      price: isPriceOnEnquiry(parsedPrice) ? null : parsedPrice,
      is_active: isActive,
      status: (published ? "published" : "draft") as ProductStatus,
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="truncate">{product.name}</DrawerTitle>
          <DrawerDescription>
            Quick edit — price, availability &amp; publishing
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-2 space-y-5 overflow-y-auto">
          {/* Price */}
          <div className="space-y-1.5">
            <Label htmlFor="qe-price">Price (₹)</Label>
            <Input
              id="qe-price"
              type="number"
              inputMode="decimal"
              min={0}
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="Leave blank for “Price on enquiry”"
              className="h-11"
            />
            <p className="text-xs text-slate-400">
              Blank = shown as “Price on enquiry”. 0 = Free.
            </p>
          </div>

          {/* Availability (is_active) */}
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span>
              <span className="block text-sm font-medium text-slate-800">
                Available
              </span>
              <span className="block text-xs text-slate-400">
                Inactive products are hidden from the storefront.
              </span>
            </span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </label>

          {/* Published (status) */}
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span>
              <span className="block text-sm font-medium text-slate-800">
                Published to website
              </span>
              <span className="block text-xs text-slate-400">
                Drafts are saved but not shown publicly.
              </span>
            </span>
            <Switch checked={published} onCheckedChange={setPublished} />
          </label>

          {/* Everything else → full editor */}
          <button
            onClick={() => onOpenFullEditor(product)}
            className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3 text-left active:bg-slate-50 transition"
          >
            <span>
              <span className="block text-sm font-semibold text-slate-800">
                Open full editor
              </span>
              <span className="block text-xs text-slate-400">
                Variants, images, specs, SEO &amp; more
              </span>
            </span>
            <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </button>
        </div>

        <DrawerFooter className="flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1 h-11"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white"
            onClick={handleSave}
          >
            Save
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
