import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Loader2, ExternalLink, Sparkles, Plus, Trash2 } from "lucide-react";
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
import AISmartPasteDialog from "@/components/admin/AISmartPasteDialog";
import ProductMediaSection from "@/components/admin/products/ProductMediaSection";
import { useProductForm } from "@/hooks/useProductForm";
import { productToForm, EMPTY_PRODUCT_FORM } from "@/lib/productForm";
import { normalizeImageUrl } from "@/lib/imageUtils";
import { isPriceOnEnquiry } from "@/lib/priceUtils";
import { Category, Product } from "@/lib/supabase";
import { ParsedProduct } from "@/lib/aiService";

const UNITS = ["pcs", "box", "pack", "roll", "kg", "litre", "set"];

interface CatalogProductPanelProps {
  product: Product | null;
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onSaved: (product: Product) => void;
}

interface SpecRow {
  key: string;
  value: string;
}

function specsToRows(specs: Record<string, unknown> | undefined): SpecRow[] {
  if (!specs) return [];
  return Object.entries(specs).map(([key, value]) => ({
    key,
    value: value == null ? "" : String(value),
  }));
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-3 border-b border-slate-100 px-5 py-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

/**
 * Catalog Editor's right-side editor panel. Reuses the shared `useProductForm`
 * (so create/update logic never forks from the route editor or the products
 * drawer) and adds the Catalog-Editor extras: SKU, an On-Enquiry price toggle,
 * a key/value specifications editor, SEO, AI Smart Paste, a dirty-state close
 * guard, and a link to the full route editor for deep edits.
 */
export default function CatalogProductPanel({
  product,
  open,
  categories,
  onClose,
  onSaved,
}: CatalogProductPanelProps) {
  const [, setLocation] = useLocation();
  const { formData, updateForm, load, saving, save, isNA, toggleNA } =
    useProductForm(product);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [specs, setSpecs] = useState<SpecRow[]>([]);
  const [aiOpen, setAiOpen] = useState(false);

  // Load form + extras whenever a different product opens (keyed on id).
  useEffect(() => {
    if (!product) return;
    load(product);
    setMetaTitle(product.meta_title || "");
    setMetaDescription(product.meta_description || "");
    setSpecs(specsToRows(product.specifications));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  // Dirty detection — compare current state to the product's pristine snapshot.
  const dirty = useMemo(() => {
    const pristine = product ? productToForm(product) : EMPTY_PRODUCT_FORM;
    if (JSON.stringify(formData) !== JSON.stringify(pristine)) return true;
    if (metaTitle !== (product?.meta_title || "")) return true;
    if (metaDescription !== (product?.meta_description || "")) return true;
    if (JSON.stringify(specs) !== JSON.stringify(specsToRows(product?.specifications)))
      return true;
    return false;
  }, [formData, metaTitle, metaDescription, specs, product]);

  const guardedClose = () => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    onClose();
  };

  const onEnquiry = isPriceOnEnquiry(
    formData.price ? parseFloat(formData.price) : null
  );

  const handleAutofill = (data: ParsedProduct) => {
    if (data.name) updateForm("name", data.name);
    if (data.price != null) updateForm("price", String(data.price));
    if (data.mrp != null) updateForm("mrp", String(data.mrp));
    if (data.unit_of_measure) updateForm("unit_of_measure", data.unit_of_measure);
    if (data.quantity_in_unit != null)
      updateForm("quantity_in_unit", String(data.quantity_in_unit));
    if (data.brand) updateForm("brand", data.brand);
    if (data.description) updateForm("description", data.description);
    if (data.category_name) {
      const match = categories.find(
        c => c.name.toLowerCase() === data.category_name!.toLowerCase()
      );
      if (match) updateForm("category_id", match.id);
    }
    setAiOpen(false);
  };

  const handleSave = async () => {
    // Serialize the spec rows (skip blank keys) into the JSONB column.
    const specObject: Record<string, string> = {};
    for (const row of specs) {
      const k = row.key.trim();
      if (k) specObject[k] = row.value.trim();
    }
    const updated = await save({
      productId: product?.id,
      extra: {
        meta_title: metaTitle.trim() || undefined,
        meta_description: metaDescription.trim() || undefined,
        specifications: specObject,
      },
    });
    if (!updated) return;
    toast.success(
      formData.status === "published" ? "Saved & published" : "Saved"
    );
    onSaved(updated);
    onClose();
  };

  const previewUrl = normalizeImageUrl(formData.image_url);

  return (
    <>
      <Sheet open={open} onOpenChange={o => !o && guardedClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg p-0 flex flex-col gap-0"
        >
          <SheetHeader className="border-b border-slate-200 px-5 py-4">
            <SheetTitle className="text-base">
              {product ? "Edit product" : "Product"}
            </SheetTitle>
            <SheetDescription className="text-xs">
              Full field editor. Use the route editor for bulk image uploads.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {/* Basic */}
            <Section
              title="Basic"
              action={
                <button
                  onClick={() => setAiOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800"
                >
                  <Sparkles className="w-3 h-3 fill-amber-400 text-amber-500" />
                  AI Paste
                </button>
              }
            >
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input
                  value={formData.name}
                  onChange={e => updateForm("name", e.target.value)}
                  placeholder="Product name"
                  className="h-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">SKU</Label>
                  <Input
                    value={formData.sku}
                    onChange={e => updateForm("sku", e.target.value)}
                    placeholder="Auto-generated"
                    className="h-9 font-mono text-xs"
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
            </Section>

            {/* Pricing */}
            <Section title="Pricing">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <div>
                  <Label className="text-xs">Price on enquiry</Label>
                  <p className="text-[11px] text-slate-400">
                    Hides price; stores NULL (never ₹0).
                  </p>
                </div>
                <Switch
                  checked={onEnquiry}
                  onCheckedChange={c => updateForm("price", c ? "" : "1")}
                />
              </div>
              {!onEnquiry && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Price ₹</Label>
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
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">MOQ</Label>
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
                  <Label className="text-xs">Qty / pack</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.quantity_in_unit}
                    onChange={e =>
                      updateForm("quantity_in_unit", e.target.value)
                    }
                    className="h-9"
                  />
                </div>
              </div>
            </Section>

            {/* Stock / availability */}
            <Section title="Availability">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Available (active)</Label>
                  <p className="text-[11px] text-slate-400">
                    In stock &amp; sellable.
                  </p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={c => updateForm("is_active", c)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Published (live)</Label>
                <Switch
                  checked={formData.status === "published"}
                  onCheckedChange={c =>
                    updateForm("status", c ? "published" : "draft")
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Featured</Label>
                <Switch
                  checked={formData.is_featured}
                  onCheckedChange={c => updateForm("is_featured", c)}
                />
              </div>
            </Section>

            {/* Description */}
            <Section title="Description">
              <Textarea
                value={formData.description}
                onChange={e => updateForm("description", e.target.value)}
                rows={4}
                placeholder="Short B2B description"
                className="resize-none text-sm"
              />
            </Section>

            {/* Specifications (JSONB key/value) */}
            <Section
              title="Specifications"
              action={
                <button
                  onClick={() => setSpecs(s => [...s, { key: "", value: "" }])}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              }
            >
              {specs.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  No specifications. Add key/value pairs (e.g. Material →
                  Plastic).
                </p>
              ) : (
                <div className="space-y-2">
                  {specs.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={row.key}
                        onChange={e =>
                          setSpecs(s =>
                            s.map((r, j) =>
                              j === i ? { ...r, key: e.target.value } : r
                            )
                          )
                        }
                        placeholder="Key"
                        className="h-8 text-xs"
                      />
                      <Input
                        value={row.value}
                        onChange={e =>
                          setSpecs(s =>
                            s.map((r, j) =>
                              j === i ? { ...r, value: e.target.value } : r
                            )
                          )
                        }
                        placeholder="Value"
                        className="h-8 text-xs"
                      />
                      <button
                        onClick={() =>
                          setSpecs(s => s.filter((_, j) => j !== i))
                        }
                        className="p-1 text-slate-400 hover:text-red-600"
                        aria-label="Remove spec"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Images — primary + gallery, assigned from the Image Library
                (the exact same ProductMediaSection flow the products drawer uses). */}
            <Section title="Images">
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
          </div>

          <SheetFooter className="flex-row items-center gap-2 border-t border-slate-200 px-5 py-3">
            {product && (
              <button
                onClick={() => setLocation(`/admin/products/${product.id}`)}
                className="mr-auto inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Full editor
              </button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={guardedClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AISmartPasteDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        categories={categories}
        onAutofill={handleAutofill}
      />
    </>
  );
}
