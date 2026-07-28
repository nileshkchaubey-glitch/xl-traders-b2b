import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { brandsService, isUniqueViolation } from "@/lib/brandsService";
import { slugify } from "@/lib/catalogHealth";
import { Brand } from "@/lib/supabase";

// ── Form state ────────────────────────────────────────────────────────────────

interface BrandForm {
  name: string;
  slug: string;
  website: string;
  logo_url: string;
  description: string;
  certifications: string; // comma-separated in the UI ↔ text[] in the DB
  sort_order: string;
  is_active: boolean;
}

const EMPTY_FORM: BrandForm = {
  name: "",
  slug: "",
  website: "",
  logo_url: "",
  description: "",
  certifications: "",
  sort_order: "0",
  is_active: true,
};

function brandToForm(b: Brand): BrandForm {
  return {
    name: b.name,
    slug: b.slug,
    website: b.website || "",
    logo_url: b.logo_url || "",
    description: b.description || "",
    certifications: (b.certifications ?? []).join(", "),
    sort_order: String(b.sort_order ?? 0),
    is_active: b.is_active,
  };
}

function formToInput(f: BrandForm) {
  return {
    name: f.name.trim(),
    slug: f.slug.trim() || slugify(f.name),
    website: f.website.trim() || null,
    // Plain text URL for now — logo UPLOAD is PIM P4 (storage bucket decision
    // still open).
    logo_url: f.logo_url.trim() || null,
    description: f.description.trim() || null,
    certifications: f.certifications
      .split(",")
      .map(c => c.trim())
      .filter(Boolean),
    sort_order: parseInt(f.sort_order) || 0,
    is_active: f.is_active,
  };
}

// ── Screen ────────────────────────────────────────────────────────────────────

// Brands manager (PIM P1). A tab inside the existing /admin dashboard — NOT a
// new admin surface (see the admin-v2 removal, PR #80). Self-loading via
// brandsService only; zero direct Supabase calls (unlike the older
// AdminCategories, which is flagged debt — DESIGN_SYSTEM.md §2.1).
export default function AdminBrands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Dialog state: null = closed, "new" = creating, Brand = editing.
  const [editing, setEditing] = useState<Brand | "new" | null>(null);
  const [form, setForm] = useState<BrandForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  // Inline duplicate-name/slug error (Postgres 23505) — rendered under the
  // field, never a raw error toast.
  const [dupError, setDupError] = useState(false);
  // Tracks whether the operator hand-edited the slug; until then it live-derives
  // from the name so the common case needs no slug thought at all.
  const [slugTouched, setSlugTouched] = useState(false);

  const load = async () => {
    setLoading(true);
    const [all, productCounts] = await Promise.all([
      brandsService.getAllAdmin(),
      brandsService.getProductCounts(),
    ]);
    setBrands(all);
    setCounts(productCounts);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDupError(false);
    setSlugTouched(false);
    setEditing("new");
  };

  const openEdit = (brand: Brand) => {
    setForm(brandToForm(brand));
    setDupError(false);
    setSlugTouched(true); // existing slug: never silently rewrite it on rename
    setEditing(brand);
  };

  const updateField = (patch: Partial<BrandForm>) => {
    setDupError(false);
    setForm(f => ({ ...f, ...patch }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Brand name is required");
      return;
    }
    setSaving(true);
    try {
      if (editing === "new") {
        await brandsService.create(formToInput(form));
        toast.success("Brand created");
      } else if (editing) {
        await brandsService.update(editing.id, formToInput(form));
        toast.success("Brand updated");
      }
      setEditing(null);
      load();
    } catch (error) {
      if (isUniqueViolation(error)) {
        setDupError(true); // inline, under the Name field
      } else {
        console.error("Brand save failed:", error);
        toast.error("Could not save the brand");
      }
    } finally {
      setSaving(false);
    }
  };

  // Soft delete = deactivate. A switch flip is reversible, so no confirm
  // dialog (same pattern as the Catalog Editor's publish switch).
  const handleToggleActive = async (brand: Brand) => {
    try {
      const updated = await brandsService.setActive(brand.id, !brand.is_active);
      setBrands(bs => bs.map(b => (b.id === brand.id ? updated : b)));
      toast.success(
        updated.is_active
          ? `${updated.name} activated`
          : `${updated.name} deactivated`
      );
    } catch (error) {
      console.error("Brand toggle failed:", error);
      toast.error("Could not update the brand");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Brands</h2>
          <p className="text-sm text-slate-500">
            Brands you stock. Deactivating hides a brand from pickers and the
            storefront — products keep their link. Assign products from the
            Products tab (Unbranded filter → bulk Set brand).
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5" />
          Add brand
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : brands.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Tag className="w-9 h-9 text-slate-300" />
          <div>
            <p className="font-medium text-slate-700">No brands yet</p>
            <p className="text-sm text-slate-400 mt-0.5">
              Add the brands you stock, then assign products to them.
            </p>
          </div>
          <Button onClick={openCreate} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Add brand
          </Button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Brand</th>
                <th className="px-4 py-2.5 font-semibold hidden md:table-cell">
                  Slug
                </th>
                <th className="px-4 py-2.5 font-semibold text-right">
                  Products
                </th>
                <th className="px-4 py-2.5 font-semibold hidden md:table-cell">
                  Certifications
                </th>
                <th className="px-4 py-2.5 font-semibold text-center">
                  Active
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {brands.map(brand => (
                <tr
                  key={brand.id}
                  className="border-t border-slate-100 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">
                      {brand.name}
                    </div>
                    {brand.website && (
                      <div className="text-xs text-slate-400 truncate max-w-[220px]">
                        {brand.website}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-mono text-xs text-slate-500">
                      {brand.slug}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    {counts[brand.id] ?? 0}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {brand.certifications?.length ? (
                      <Badge variant="secondary" className="text-xs">
                        {brand.certifications.length} cert
                        {brand.certifications.length === 1 ? "" : "s"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch
                      checked={brand.is_active}
                      onCheckedChange={() => handleToggleActive(brand)}
                      aria-label={`${brand.name} active`}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => openEdit(brand)}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog open={editing !== null} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing === "new" ? "Add brand" : `Edit ${form.name || "brand"}`}
            </DialogTitle>
            <DialogDescription>
              Logo upload comes later — paste a URL for now if you have one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input
                value={form.name}
                onChange={e =>
                  updateField(
                    slugTouched
                      ? { name: e.target.value }
                      : { name: e.target.value, slug: slugify(e.target.value) }
                  )
                }
                placeholder="e.g. Fortune Petpack"
                aria-invalid={dupError}
                className={dupError ? "border-red-400" : undefined}
              />
              {dupError && (
                <p className="text-xs text-red-600">
                  A brand with this name or slug already exists.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Slug</Label>
                <Input
                  value={form.slug}
                  onChange={e => {
                    setSlugTouched(true);
                    updateField({ slug: e.target.value });
                  }}
                  placeholder="auto"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={e => updateField({ sort_order: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Website</Label>
              <Input
                value={form.website}
                onChange={e => updateField({ website: e.target.value })}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Logo URL</Label>
              <Input
                value={form.logo_url}
                onChange={e => updateField({ logo_url: e.target.value })}
                placeholder="https://… (upload comes in a later phase)"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={form.description}
                onChange={e => updateField({ description: e.target.value })}
                placeholder="Short note about this supplier"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Certifications</Label>
              <Input
                value={form.certifications}
                onChange={e => updateField({ certifications: e.target.value })}
                placeholder="Comma-separated, e.g. ISO 9001, FSSAI"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <Label className="text-xs">Active</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={v => updateField({ is_active: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {editing === "new" ? "Create brand" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
