import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Sparkles, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseProductDetailsWithAI, ParsedProduct } from "@/lib/aiService";
import { categoryService } from "@/lib/productService";
import {
  EMPTY_PRODUCT_FORM,
  saveProductForm,
} from "@/lib/productForm";
import { Category } from "@/lib/supabase";

// Paste supplier/website text → AI extracts fields → review → create a draft
// product. Reuses parseProductDetailsWithAI (aiService) for extraction and
// saveProductForm (the shared editor save) for the create, so a Smart-Paste
// product goes through the exact same path as the manual editor.
export default function SmartPastePanel() {
  const [, setLocation] = useLocation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ParsedProduct | null>(null);

  useEffect(() => {
    categoryService.getAll().then(setCategories);
  }, []);

  const parse = async () => {
    if (!text.trim()) {
      toast.error("Paste some product text first");
      return;
    }
    setParsing(true);
    try {
      const parsed = await parseProductDetailsWithAI(
        text,
        categories.map(c => c.name)
      );
      setResult(parsed);
      toast.success("Extracted — review and create");
    } catch {
      toast.error("Failed to parse text");
    } finally {
      setParsing(false);
    }
  };

  const create = async (openEditor: boolean) => {
    if (!result?.name?.trim()) {
      toast.error("Product name is required");
      return;
    }
    setSaving(true);
    try {
      const matchedCategory = result.category_name
        ? categories.find(
            c => c.name.toLowerCase() === result.category_name!.toLowerCase()
          )
        : undefined;

      const product = await saveProductForm({
        ...EMPTY_PRODUCT_FORM,
        name: result.name.trim(),
        category_id: matchedCategory?.id ?? "",
        description: result.description ?? "",
        price: result.price != null ? String(result.price) : "",
        mrp: result.mrp != null ? String(result.mrp) : "",
        unit_of_measure: result.unit_of_measure || "pcs",
        quantity_in_unit:
          result.quantity_in_unit != null
            ? String(result.quantity_in_unit)
            : "",
        brand: result.brand ?? "",
      });

      toast.success(`"${product.name}" created as draft`);
      setText("");
      setResult(null);
      if (openEditor) setLocation(`/admin-v2/products/${product.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create product");
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof ParsedProduct, value: string) =>
    setResult(prev => ({ ...prev, [key]: value }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
        <h2 className="text-sm font-bold text-slate-800">AI Smart Paste</h2>
      </div>
      <p className="text-xs text-slate-500">
        Paste product text from a supplier site, PDF, or WhatsApp. AI extracts
        the fields; review, then create it as a draft.
      </p>

      <Textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={`Round Container 500ml box of 250 pcs.\nPrice: 350. MRP: 400. Brand: XL Traders.`}
        className="min-h-[140px] text-sm"
        disabled={parsing || saving}
      />
      <div className="flex justify-end">
        <Button
          onClick={parse}
          disabled={parsing || saving}
          size="sm"
          className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
        >
          {parsing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Extract details
        </Button>
      </div>

      {result && (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Name</Label>
              <Input
                value={result.name ?? ""}
                onChange={e => field("name", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Price (₹)</Label>
              <Input
                type="number"
                value={result.price ?? ""}
                onChange={e => field("price", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">MRP (₹)</Label>
              <Input
                type="number"
                value={result.mrp ?? ""}
                onChange={e => field("mrp", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unit</Label>
              <Input
                value={result.unit_of_measure ?? ""}
                onChange={e => field("unit_of_measure", e.target.value)}
                className="h-9"
                placeholder="pcs, box, pack…"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Qty in unit</Label>
              <Input
                type="number"
                value={result.quantity_in_unit ?? ""}
                onChange={e => field("quantity_in_unit", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Brand</Label>
              <Input
                value={result.brand ?? ""}
                onChange={e => field("brand", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category (AI suggestion)</Label>
              <Input
                value={result.category_name ?? ""}
                onChange={e => field("category_name", e.target.value)}
                className="h-9"
                placeholder="Falls back to Uncategorized"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={result.description ?? ""}
                onChange={e => field("description", e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setResult(null)}
            >
              Discard
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => create(true)}
            >
              Create &amp; edit
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={() => create(false)}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Create draft
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
