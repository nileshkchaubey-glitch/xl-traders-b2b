import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ChevronRight, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CategoryCombobox from "@/components/admin/CategoryCombobox";
import { useProductForm } from "@/hooks/useProductForm";
import { normalizeImageUrl } from "@/lib/imageUtils";
import { Category, Product } from "@/lib/supabase";
import ProductMediaSection from "@/components/admin/products/ProductMediaSection";

const UNITS = ["pcs", "box", "pack", "roll", "kg", "litre", "set"];

interface ProductDrawerProps {
  product: Product | null;
  open: boolean;
  categories: Category[];
  hasNext: boolean;
  onClose: () => void;
  onSaved: (product: Product) => void;
  onSaveAndNext: () => void;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 border-b border-slate-100 px-5 py-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function ProductDrawer({
  product,
  open,
  categories,
  hasNext,
  onClose,
  onSaved,
  onSaveAndNext,
}: ProductDrawerProps) {
  const { formData, updateForm, load, isNA, toggleNA, saving, save } =
    useProductForm(product);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");

  // Load the form whenever a different product is opened (keyed on id so list
  // refreshes mid-edit don't clobber in-progress changes).
  useEffect(() => {
    if (!product) return;
    load(product);
    setMetaTitle(product.meta_title || "");
    setMetaDescription(product.meta_description || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const handleSave = async (advance: boolean) => {
    const updated = await save({
      productId: product?.id,
      extra: {
        meta_title: metaTitle.trim() || undefined,
        meta_description: metaDescription.trim() || undefined,
      },
    });
    if (!updated) return;
    toast.success(
      formData.status === "published" ? "Saved & published" : "Saved"
    );
    onSaved(updated);
    if (advance && hasNext) onSaveAndNext();
    else onClose();
  };

  const previewUrl = normalizeImageUrl(formData.image_url);

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col gap-0"
      >
        <SheetHeader className="border-b border-slate-200 px-5 py-4">
          <SheetTitle className="text-base">
            {product ? "Edit product" : "Product"}
          </SheetTitle>
          <SheetDescription className="text-xs">
            Quick edit. Use the full editor for bulk image uploads.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Basics */}
          <Section title="Basics">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={formData.name}
                onChange={e => updateForm("name", e.target.value)}
                placeholder="Product name"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <CategoryCombobox
                categories={categories}
                value={formData.category_id}
                onChange={v => updateForm("category_id", v)}
                placeholder="Uncategorized"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Brand</Label>
                <NaToggle field="brand" isNA={isNA} toggleNA={toggleNA} />
              </div>
              <Input
                value={formData.brand}
                onChange={e => updateForm("brand", e.target.value)}
                placeholder="Brand"
                className="h-9"
              />
            </div>
          </Section>

          {/* Pricing & stock */}
          <Section title="Pricing & stock">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Price ₹ (blank = enquiry)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={e => updateForm("price", e.target.value)}
                  placeholder="Enquiry"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">MRP ₹</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.mrp}
                  onChange={e => updateForm("mrp", e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">MOQ</Label>
                  <NaToggle field="moq" isNA={isNA} toggleNA={toggleNA} />
                </div>
                <Input
                  type="number"
                  min="1"
                  value={formData.moq}
                  onChange={e => updateForm("moq", e.target.value)}
                  placeholder="Unknown"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unit</Label>
                <Select
                  value={formData.unit_of_measure}
                  onValueChange={v => updateForm("unit_of_measure", v)}
                >
                  <SelectTrigger className="h-9">
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
              </div>
            </div>
          </Section>

          {/* Media */}
          <Section title="Media">
            <ProductMediaSection
              product={product}
              imageUrl={formData.image_url}
              previewUrl={previewUrl}
              onImageUrlChange={v => updateForm("image_url", v)}
              isNA={isNA}
              toggleNA={toggleNA}
            />
          </Section>

          {/* SEO */}
          <Section title="SEO">
            <div className="space-y-1.5">
              <Label className="text-xs">Meta title</Label>
              <Input
                value={metaTitle}
                onChange={e => setMetaTitle(e.target.value)}
                placeholder={formData.name}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Meta description</Label>
              <Textarea
                value={metaDescription}
                onChange={e => setMetaDescription(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          </Section>

          {/* Status */}
          <Section title="Status">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Published</Label>
                <p className="text-[11px] text-slate-400">
                  Live on the storefront when on + active.
                </p>
              </div>
              <Switch
                checked={formData.status === "published"}
                onCheckedChange={c =>
                  updateForm("status", c ? "published" : "draft")
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Active</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={c => updateForm("is_active", c)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Featured</Label>
              <Switch
                checked={formData.is_featured}
                onCheckedChange={c => updateForm("is_featured", c)}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <NaToggle
                field="description"
                isNA={isNA}
                toggleNA={toggleNA}
                label="Description N/A"
              />
              <NaToggle
                field="specifications"
                isNA={isNA}
                toggleNA={toggleNA}
                label="Specs N/A"
              />
            </div>
          </Section>
        </div>

        <SheetFooter className="flex-row items-center gap-2 border-t border-slate-200 px-5 py-3">
          {product && (
            <button
              onClick={() => window.open(`/product/${product.id}`, "_blank")}
              className="mr-auto inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View live
            </button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          {hasNext && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="gap-1"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              Save & next
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function NaToggle({
  field,
  isNA,
  toggleNA,
  label = "N/A",
}: {
  field: string;
  isNA: (f: string) => boolean;
  toggleNA: (f: string) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => toggleNA(field)}
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
        isNA(field)
          ? "bg-slate-700 text-white border-slate-700"
          : "border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400"
      }`}
      title={
        isNA(field)
          ? "Marked N/A — not counted as missing"
          : "Mark as N/A (not applicable)"
      }
    >
      {label}
    </button>
  );
}
