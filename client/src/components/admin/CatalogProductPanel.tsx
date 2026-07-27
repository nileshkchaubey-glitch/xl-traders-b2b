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
import { confirm } from "@/components/ui/confirm-dialog";
import { useProductForm } from "@/hooks/useProductForm";
import { productToForm, EMPTY_PRODUCT_FORM } from "@/lib/productForm";
import { normalizeImageUrl } from "@/lib/imageUtils";
import { isPriceOnEnquiry } from "@/lib/priceUtils";
import {
  type PriceEntryMode,
  DEFAULT_PRICE_MODE,
  perPieceRate,
  formatPerPiece,
} from "@/lib/priceEntryMode";
import { usePriceEntry } from "@/hooks/usePriceEntry";
import { Category, Product } from "@/lib/supabase";
import { ParsedProduct } from "@/lib/aiService";

const UNITS = ["pcs", "box", "pack", "roll", "kg", "litre", "set"];

interface CatalogProductPanelProps {
  product: Product | null;
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onSaved: (product: Product) => void;
  /**
   * Price entry unit, shared with the table's inline cell and the Workbench
   * (one URL param, owned by CatalogTreeEditor). Optional so the drawer still
   * renders standalone; it then behaves exactly as it always did — per pack.
   */
  priceMode?: PriceEntryMode;
  onPriceModeChange?: (mode: PriceEntryMode) => void;
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
  priceMode: priceModeProp = DEFAULT_PRICE_MODE,
  onPriceModeChange,
}: CatalogProductPanelProps) {
  // Without a change handler there is no way out of per-piece mode, so an
  // unwired drawer keeps the pack semantics it has always had rather than
  // reinterpreting the operator's number with no way to say otherwise.
  const priceMode = onPriceModeChange ? priceModeProp : "pack";
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
    if (
      JSON.stringify(specs) !==
      JSON.stringify(specsToRows(product?.specifications))
    )
      return true;
    return false;
  }, [formData, metaTitle, metaDescription, specs, product]);

  const guardedClose = async () => {
    if (
      dirty &&
      !(await confirm({
        title: "Discard unsaved changes?",
        destructive: true,
        confirmLabel: "Discard",
      }))
    )
      return;
    onClose();
  };

  // ── On-Enquiry ──────────────────────────────────────────────────────────────
  // Explicit state, seeded from the product, and thereafter owned ONLY by the
  // toggle below.
  //
  // It used to be derived live from formData.price, which meant clearing the
  // box to retype a price flipped it true mid-keystroke: the pricing block —
  // and the focused input inside it — unmounted under the cursor, and the
  // product silently became On-Enquiry without anyone choosing that. Deleting
  // and retyping a price is the single most common action during a catalogue
  // rebuild, so that fired constantly.
  //
  // It is also what productValidation.ts already says out loud: a blank price
  // is never coerced to "on enquiry", because On-Enquiry is a deliberate
  // business decision with its own toggle (DE-01). An empty box means "I am
  // retyping", not "no price".
  const [onEnquiry, setOnEnquiry] = useState(false);
  useEffect(() => {
    setOnEnquiry(isPriceOnEnquiry(product?.price ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  // ── Per-piece price entry ───────────────────────────────────────────────────
  // This drawer is the third surface that edits a price, alongside the table's
  // inline cell and the Workbench fields pane. Before this it silently took a
  // raw pack price while the other two were in per-piece mode — so a per-piece
  // figure typed here would have been stored as the pack price, ~480x low.
  // Same shared hook, same URL-backed mode, same storage contract: what lands
  // in formData.price (and therefore in saveProductForm) is always the price
  // of one selling unit.
  const {
    available: canEnterPerPiece,
    active: enteringPerPiece,
    value: priceFieldValue,
    onChange: onPriceFieldChange,
    settle: settlePriceEntry,
  } = usePriceEntry({
    mode: priceMode,
    price: formData.price,
    quantityInUnit: formData.quantity_in_unit,
    onPriceChange: v => updateForm("price", v),
    resetKey: product?.id ?? null,
  });

  // Live readout, mirroring the Workbench's: the figure the operator is NOT
  // typing is the one they need to see confirmed.
  const priceNum = formData.price.trim() === "" ? null : Number(formData.price);
  const priceInvalid = priceNum !== null && !Number.isFinite(priceNum);
  const perPiece =
    priceNum != null && !priceInvalid && !isPriceOnEnquiry(priceNum)
      ? perPieceRate(priceNum, formData.quantity_in_unit)
      : null;

  const handleAutofill = (data: ParsedProduct) => {
    if (data.name) updateForm("name", data.name);
    if (data.price != null) updateForm("price", String(data.price));
    if (data.mrp != null) updateForm("mrp", String(data.mrp));
    if (data.unit_of_measure)
      updateForm("unit_of_measure", data.unit_of_measure);
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
                  onCheckedChange={c => {
                    setOnEnquiry(c);
                    // Turning it ON clears the price, because that IS the
                    // stored meaning (NULL). Turning it OFF just reveals an
                    // empty box to type into — the old code wrote a sentinel
                    // "1" here purely so the derived flag would go false,
                    // which showed up as a phantom ₹1 (and as ₹0.0021 once
                    // per-piece display landed).
                    if (c) updateForm("price", "");
                  }}
                />
              </div>
              {!onEnquiry && (
                <>
                  {/* Entry unit — the same URL-backed preference the table and
                      the Workbench use, so all three surfaces agree on what
                      the number in the box means. */}
                  <div
                    className={`items-center gap-2 flex-wrap ${onPriceModeChange ? "flex" : "hidden"}`}
                  >
                    <span className="text-xs font-medium text-slate-500">
                      Enter as
                    </span>
                    <div
                      role="group"
                      aria-label="Price entry unit"
                      className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5"
                    >
                      {(
                        [
                          { id: "pack", label: "Per pack" },
                          { id: "piece", label: "Per piece" },
                        ] as const
                      ).map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={priceMode === id}
                          disabled={id === "piece" && !canEnterPerPiece}
                          title={
                            id === "piece" && !canEnterPerPiece
                              ? "Set Qty / pack above 1 first"
                              : undefined
                          }
                          onClick={() => onPriceModeChange?.(id)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${
                            priceMode === id
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        {enteringPerPiece
                          ? "Price ₹ / piece"
                          : "Price ₹ / pack"}
                      </Label>
                      {/* text + inputMode, not type="number": a number input
                          reports "" for anything the browser can't parse, so a
                          typo arrives looking like a deliberate blank — that is
                          DE-01, fixed in the table's inline editor and missed
                          here. It also lets 0.025 be typed without fighting
                          step="0.01". */}
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={priceFieldValue}
                        onChange={e => onPriceFieldChange(e.target.value)}
                        onBlur={settlePriceEntry}
                        placeholder={
                          enteringPerPiece ? "e.g. 10.20" : "Price per pack"
                        }
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
                  {/* Says plainly what gets stored, and shows the derived rate
                      live — the drawer previously gave no signal at all that
                      its Price field meant one whole pack. */}
                  <p className="text-[11px] leading-tight">
                    {priceInvalid ? (
                      <span className="text-red-600 font-semibold">
                        Not a number — this won't save
                      </span>
                    ) : priceNum == null ? (
                      // The box no longer collapses when it is emptied, so it
                      // has to say what an empty box actually saves as —
                      // otherwise "not collapsing" would just hide the outcome
                      // instead of the input.
                      <span className="text-amber-700">
                        Empty saves as no price (On Enquiry). Type the price of
                        ONE selling unit — the pack.
                      </span>
                    ) : (
                      <span className="text-slate-500">
                        Stores ₹
                        <strong
                          className={
                            enteringPerPiece ? "font-semibold" : "font-normal"
                          }
                        >
                          {priceNum.toLocaleString()}
                        </strong>{" "}
                        {/* "one pack of 480 pcs", never "one pcs of 480":
                            unit_of_measure names the pieces INSIDE the pack,
                            not the selling unit. Same phrasing as the PDP
                            price card. */}
                        {formData.quantity_in_unit
                          ? `for one pack of ${formData.quantity_in_unit} ${formData.unit_of_measure || "pcs"}`
                          : "for one selling unit"}
                        {perPiece != null && (
                          <>
                            {" "}
                            · ₹
                            <strong
                              className={
                                enteringPerPiece
                                  ? "font-normal"
                                  : "font-semibold"
                              }
                            >
                              {formatPerPiece(perPiece)}
                            </strong>
                            /pc
                          </>
                        )}
                      </span>
                    )}
                  </p>
                </>
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
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Save"
              )}
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
