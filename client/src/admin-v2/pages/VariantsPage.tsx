import { useState } from "react";
import { useLocation } from "wouter";
import {
  Loader2,
  Search,
  Plus,
  Trash2,
  Layers,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Product } from "@/lib/supabase";
import { useVariants } from "../hooks/useVariants";

const UNITS = ["pcs", "box", "pack", "roll", "kg", "litre", "set"];

function formatPrice(price: number | null | undefined): string {
  if (price == null) return "—";
  if (price === 0) return "Free";
  return `₹${price.toLocaleString("en-IN")}`;
}

export default function VariantsPage() {
  const [, setLocation] = useLocation();
  const v = useVariants();
  const [masterSearch, setMasterSearch] = useState("");

  // New variant draft row
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [moq, setMoq] = useState("");
  const [unit, setUnit] = useState("pcs");

  const filteredMasters = v.masters.filter(m =>
    m.name.toLowerCase().includes(masterSearch.toLowerCase())
  );

  const submitVariant = async () => {
    await v.addVariant({
      variant_label: label,
      price: price ? parseFloat(price) : null,
      mrp: mrp ? parseFloat(mrp) : null,
      moq: moq ? parseInt(moq) : null,
      unit_of_measure: unit,
    });
    setLabel("");
    setPrice("");
    setMrp("");
    setMoq("");
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-slate-500" />
            <h1 className="text-xl font-bold text-slate-900">Variants</h1>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            Pick a master on the left, manage its size/variant matrix on the
            right. New variants are created as drafts.
          </p>
        </div>
        <button
          onClick={() => v.reloadMasters()}
          disabled={v.loadingMasters}
          title="Reload masters"
          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${v.loadingMasters ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
        {/* Masters list */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search masters…"
                value={masterSearch}
                onChange={e => setMasterSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
              />
            </div>
          </div>
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
            {v.loadingMasters ? (
              <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : filteredMasters.length === 0 ? (
              <p className="py-10 text-center text-xs text-slate-400">
                No masters found.
              </p>
            ) : (
              filteredMasters.map(m => {
                const active = m.id === v.selectedId;
                return (
                  <button
                    key={m.id}
                    onClick={() => v.setSelectedId(m.id)}
                    className={`w-full text-left px-3 py-2.5 border-b border-slate-50 transition-colors ${
                      active
                        ? "bg-red-50 border-l-2 border-l-red-500"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {m.name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {m.categories?.name || "—"}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Variant matrix */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {!v.selectedMaster ? (
            <div className="py-20 text-center text-sm text-slate-400">
              Select a master to manage its variants.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">
                    {v.selectedMaster.name}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {v.variants.length} variant
                    {v.variants.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              {/* Matrix header */}
              <div className="grid grid-cols-[minmax(0,1.4fr)_90px_90px_70px_90px_110px_60px] gap-2 px-4 py-2 bg-slate-50/80 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <div>Variant</div>
                <div>Price</div>
                <div>MRP</div>
                <div>MOQ</div>
                <div>Unit</div>
                <div>Status</div>
                <div />
              </div>

              {v.loadingVariants ? (
                <div className="flex items-center justify-center gap-2 py-12 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading variants…
                </div>
              ) : (
                <div className="max-h-[calc(100vh-380px)] overflow-y-auto">
                  {v.variants.length === 0 ? (
                    <p className="py-10 text-center text-xs text-slate-400">
                      No variants yet. Add one below.
                    </p>
                  ) : (
                    v.variants.map(variant => (
                      <VariantRow
                        key={variant.id}
                        variant={variant}
                        busy={v.busy}
                        onToggleStatus={() =>
                          v.setVariantStatus(
                            variant.id,
                            variant.status === "published"
                              ? "draft"
                              : "published"
                          )
                        }
                        onDelete={() => {
                          if (confirm(`Delete variant "${variant.variant_label}"?`))
                            v.deleteVariant(variant.id);
                        }}
                        onView={() =>
                          setLocation(`/admin-v2/products/${variant.id}`)
                        }
                      />
                    ))
                  )}
                </div>
              )}

              {/* Add-variant row */}
              <div className="grid grid-cols-[minmax(0,1.4fr)_90px_90px_70px_90px_110px_60px] gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50/50 items-center">
                <Input
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. 500ml"
                  className="h-8 text-sm"
                  onKeyDown={e => {
                    if (e.key === "Enter") submitVariant();
                  }}
                />
                <Input
                  type="number"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="₹"
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  value={mrp}
                  onChange={e => setMrp(e.target.value)}
                  placeholder="MRP"
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  value={moq}
                  onChange={e => setMoq(e.target.value)}
                  placeholder="MOQ"
                  className="h-8 text-sm"
                />
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="h-8 text-sm">
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
                <div className="col-span-2">
                  <Button
                    size="sm"
                    disabled={v.busy || !label.trim()}
                    onClick={submitVariant}
                    className="h-8 w-full gap-1 bg-red-600 hover:bg-red-700 text-white text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VariantRow({
  variant,
  busy,
  onToggleStatus,
  onDelete,
  onView,
}: {
  variant: Product;
  busy: boolean;
  onToggleStatus: () => void;
  onDelete: () => void;
  onView: () => void;
}) {
  const published = variant.status === "published";
  return (
    <div className="grid grid-cols-[minmax(0,1.4fr)_90px_90px_70px_90px_110px_60px] gap-2 px-4 py-2.5 border-b border-slate-50 items-center hover:bg-slate-50/60">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">
          {variant.variant_label || "—"}
        </p>
        <p className="text-[10px] text-slate-400 font-mono truncate">
          {variant.sku}
        </p>
      </div>
      <div className="text-sm tabular-nums text-slate-700">
        {formatPrice(variant.price)}
      </div>
      <div className="text-sm tabular-nums text-slate-500">
        {variant.mrp != null ? `₹${variant.mrp.toLocaleString("en-IN")}` : "—"}
      </div>
      <div className="text-sm tabular-nums text-slate-500">
        {variant.moq ?? "—"}
      </div>
      <div className="text-sm text-slate-500">{variant.unit_of_measure}</div>
      <div>
        <button
          type="button"
          disabled={busy}
          onClick={onToggleStatus}
          title="Click to toggle published / draft"
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold transition-colors ${
            published
              ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
              : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
          }`}
        >
          {published ? "Published" : "Draft"}
        </button>
      </div>
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onView}
          title="Open in editor"
          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          title="Delete variant"
          className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
