import { useEffect, useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { toast } from "sonner";
import { ChevronRight, Loader2 } from "lucide-react";
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
import ProductMediaSection from "@/components/admin/products/ProductMediaSection";
import { useProductForm } from "@/hooks/useProductForm";
import { categoryService, productService } from "@/lib/productService";
import { Category, Product, ProductStatus } from "@/lib/supabase";
import { normalizeImageUrl } from "@/lib/imageUtils";

const UNITS = ["pcs", "box", "pack", "roll", "kg", "litre", "set"];

function NaToggle({
  field,
  isNA,
  toggleNA,
}: {
  field: string;
  isNA: (f: string) => boolean;
  toggleNA: (f: string) => void;
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
          ? "Marked N/A — not counted as missing data"
          : "Mark as N/A (not applicable)"
      }
    >
      N/A
    </button>
  );
}

export default function ProductEntryPage() {
  const params = useParams<{ id?: string }>();
  const productId = params.id;
  const isEditing = !!productId;
  const [, setLocation] = useLocation();

  const [categories, setCategories] = useState<Category[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(isEditing);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");

  // Shared form state + save — same hook the detail drawer uses, so
  // admin-v2 never forks the create/update logic in productForm.ts.
  const { formData, updateForm, load, isNA, toggleNA, saving, save } =
    useProductForm(product);

  useEffect(() => {
    categoryService.getAll().then(setCategories);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadProduct() {
      if (!productId) {
        setLoadingProduct(false);
        return;
      }
      setLoadingProduct(true);
      const loaded = await productService.getById(productId, {
        includeUnpublished: true,
      });
      if (cancelled) return;
      if (!loaded) {
        toast.error("Product not found");
        setLocation("/admin-v2/products");
        return;
      }
      setProduct(loaded);
      load(loaded);
      setMetaTitle(loaded.meta_title || "");
      setMetaDescription(loaded.meta_description || "");
      setLoadingProduct(false);
    }
    loadProduct();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const goBack = () => setLocation("/admin-v2/products");

  const handleSave = async (opts: {
    addAnother?: boolean;
    publish?: boolean;
  }) => {
    const updated = await save({
      productId,
      statusOverride: opts.publish ? "published" : undefined,
      extra: {
        meta_title: metaTitle.trim() || undefined,
        meta_description: metaDescription.trim() || undefined,
      },
    });
    if (!updated) return;
    toast.success(
      opts.publish
        ? "Published to website"
        : isEditing
          ? "Product updated"
          : "Product created"
    );
    if (opts.addAnother) {
      setLocation("/admin-v2/products/new");
      setProduct(null);
      load(null);
      setMetaTitle("");
      setMetaDescription("");
    } else {
      goBack();
    }
  };

  if (loadingProduct) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <Loader2 className="w-6 h-6 animate-spin text-red-600" />
      </div>
    );
  }

  const previewUrl = normalizeImageUrl(formData.image_url);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-1.5 text-sm">
        <Link
          href="/admin-v2/products"
          className="text-slate-400 hover:text-slate-800"
        >
          Products
        </Link>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <span className="font-semibold text-slate-800">
          {isEditing ? formData.name || "Edit Product" : "New Product"}
        </span>
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          handleSave({});
        }}
        className="space-y-6"
      >
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="space-y-1.5">
            <Label>Product Name *</Label>
            <Input
              value={formData.name}
              onChange={e => updateForm("name", e.target.value)}
              placeholder="e.g., 50ml Attach Lid Container"
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Category{" "}
              <span className="text-slate-400 font-normal text-xs">
                (auto-assigns Uncategorized if blank)
              </span>
            </Label>
            <CategoryCombobox
              categories={categories}
              value={formData.category_id}
              onChange={v => updateForm("category_id", v)}
              placeholder="Select category"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Price (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Leave blank = price on enquiry"
                value={formData.price}
                onChange={e => updateForm("price", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>MRP (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.mrp}
                onChange={e => updateForm("mrp", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>MOQ</Label>
                <NaToggle field="moq" isNA={isNA} toggleNA={toggleNA} />
              </div>
              <Input
                type="number"
                min="1"
                value={formData.moq}
                onChange={e => updateForm("moq", e.target.value)}
                placeholder="Unknown"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select
                value={formData.unit_of_measure}
                onValueChange={v => updateForm("unit_of_measure", v)}
              >
                <SelectTrigger>
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
            <div className="space-y-1.5">
              <Label>Pack Size</Label>
              <Input
                type="number"
                min="1"
                value={formData.quantity_in_unit}
                onChange={e => updateForm("quantity_in_unit", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Brand</Label>
              <NaToggle field="brand" isNA={isNA} toggleNA={toggleNA} />
            </div>
            <Input
              value={formData.brand}
              onChange={e => updateForm("brand", e.target.value)}
              placeholder="e.g. Oshine, Biopack"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>SKU</Label>
              <Input
                value={formData.sku}
                onChange={e => updateForm("sku", e.target.value)}
                className="font-mono text-sm"
                placeholder="Auto-generated if blank"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Barcode</Label>
              <Input
                value={formData.barcode}
                onChange={e => updateForm("barcode", e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Description</Label>
              <NaToggle field="description" isNA={isNA} toggleNA={toggleNA} />
            </div>
            <Textarea
              value={formData.description}
              onChange={e => updateForm("description", e.target.value)}
              rows={5}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-slate-600">Specifications</Label>
            <NaToggle field="specifications" isNA={isNA} toggleNA={toggleNA} />
            <span className="text-[10px] text-slate-400">
              mark N/A if none
            </span>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
          <Label>
            Images{" "}
            <span className="font-normal text-slate-400 text-xs">
              (gallery + library reuse — same as the drawer editor)
            </span>
          </Label>
          <ProductMediaSection
            product={product}
            imageUrl={formData.image_url}
            previewUrl={previewUrl}
            onImageUrlChange={v => updateForm("image_url", v)}
            isNA={isNA}
            toggleNA={toggleNA}
          />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={v => updateForm("status", v as ProductStatus)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft (hidden)</SelectItem>
                <SelectItem value="published">Published (live)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400">
              Drafts never appear on the storefront.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_active}
                onCheckedChange={v => updateForm("is_active", v)}
              />
              <Label>Active</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_featured}
                onCheckedChange={v => updateForm("is_featured", v)}
              />
              <Label>Featured</Label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Meta title</Label>
            <Input
              value={metaTitle}
              onChange={e => setMetaTitle(e.target.value)}
              placeholder={formData.name}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Meta description</Label>
            <Textarea
              value={metaDescription}
              onChange={e => setMetaDescription(e.target.value)}
              rows={2}
            />
          </div>
        </section>

        <div className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-[#f4f6f9]/95 py-4 backdrop-blur">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSave({ addAnother: true })}
            disabled={saving}
          >
            Save & Add Another
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-slate-700 text-white hover:bg-slate-800"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Save changes" : "Save as Draft"}
          </Button>
          {formData.status !== "published" && (
            <Button
              type="button"
              onClick={() => handleSave({ publish: true })}
              disabled={saving}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish to website
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
