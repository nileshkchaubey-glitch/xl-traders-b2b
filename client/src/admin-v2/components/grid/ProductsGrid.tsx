import { useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Edit2,
  Images,
  Copy,
  Trash2,
  Power,
  Star,
  ExternalLink,
  ImageIcon,
  Loader2,
  Check,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Product, ProductStatus } from "@/lib/supabase";
import { normalizeImageUrl } from "@/lib/imageUtils";
import { productCompleteness, completenessColor } from "@/lib/catalogHealth";
import type { ProductRowActions } from "@/components/admin/products/ProductsTable";
import InlineCell from "./InlineCell";

const ROW_HEIGHT = 60;

// Fixed grid tracks. Below sm the price/mrp/moq/status/score columns drop out
// (cells are `hidden sm:…`) and price+status fold into the name cell — same
// responsive pattern as the shared /admin list.
const GRID_COLS =
  "grid-cols-[32px_44px_minmax(0,1fr)_40px] " +
  "sm:grid-cols-[40px_56px_minmax(0,1fr)_100px_90px_70px_120px_56px_48px]";

// price/mrp/moq can be set to null (enquiry / unknown), which Partial<Product>
// alone does not express.
export type ProductPatch = Omit<Partial<Product>, "price" | "mrp" | "moq"> & {
  price?: number | null;
  mrp?: number | null;
  moq?: number | null;
};

type EditableField = "name" | "price" | "mrp" | "moq";

export type RowSaveState = "saving" | "saved";

interface ProductsGridProps extends ProductRowActions {
  products: Product[];
  loading: boolean;
  getCategoryName: (categoryId: string) => string;
  // selection (owned by the parent so the bulk logic is reused)
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  allPageSelected: boolean;
  // open the full editor for a row (Enter / mobile tap / row double-click)
  onOpen: (product: Product) => void;
  // inline (optimistic) field edits — parent persists via productService
  onInlineUpdate: (id: string, patch: ProductPatch) => void;
  // per-row save indicator, owned by the parent alongside the save call
  rowStatus: Record<string, RowSaveState>;
}

function formatPrice(price: number | null | undefined): React.ReactNode {
  if (price == null) return <span className="italic text-slate-400">Enquiry</span>;
  if (price === 0) return "Free";
  return `₹${price.toLocaleString("en-IN")}`;
}

const isMobile = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 639px)").matches;

export default function ProductsGrid({
  products,
  loading,
  getCategoryName,
  selected,
  onToggleRow,
  onToggleAll,
  allPageSelected,
  onOpen,
  onInlineUpdate,
  rowStatus,
  ...actions
}: ProductsGridProps) {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [editing, setEditing] = useState<{
    id: string;
    field: EditableField;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const isEditing = (id: string, field: EditableField) =>
    editing?.id === id && editing.field === field;

  // ── Commit helpers (raw string → typed patch; grid owns only validation,
  //    persistence stays with the parent → productService.update) ────────────
  const commitName = (p: Product, raw: string) => {
    setEditing(null);
    const name = raw.trim();
    if (!name) {
      toast.error("Product name is required");
      return;
    }
    if (name !== p.name) onInlineUpdate(p.id, { name });
  };

  const commitNumber = (
    p: Product,
    field: "price" | "mrp" | "moq",
    raw: string
  ) => {
    setEditing(null);
    const trimmed = raw.trim();
    const current = p[field] ?? null;
    if (trimmed === "") {
      if (current !== null) onInlineUpdate(p.id, { [field]: null });
      return;
    }
    const n = field === "moq" ? parseInt(trimmed) : parseFloat(trimmed);
    if (Number.isNaN(n) || n < 0 || (field === "moq" && n < 1)) {
      toast.error(`Invalid ${field === "moq" ? "MOQ" : field.toUpperCase()}`);
      return;
    }
    if (n !== current) onInlineUpdate(p.id, { [field]: n });
  };

  // ── Row interactions ────────────────────────────────────────────────────
  const handleRowClick = (product: Product, index: number) => {
    // Mobile: no double-click/keyboard — tap opens the full editor instead.
    if (isMobile()) {
      onOpen(product);
      return;
    }
    setFocusedIndex(index);
    scrollRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editing) return; // the cell input handles its own keys
    if (!products.length) return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      const next = Math.min(
        products.length - 1,
        Math.max(0, (focusedIndex === -1 ? 0 : focusedIndex + delta))
      );
      setFocusedIndex(next);
      virtualizer.scrollToIndex(next);
      return;
    }
    if (focusedIndex < 0 || focusedIndex >= products.length) return;
    const focused = products[focusedIndex];

    if (e.key === "Enter") {
      e.preventDefault();
      onOpen(focused);
    } else if (e.key.toLowerCase() === "e") {
      e.preventDefault();
      setEditing({ id: focused.id, field: "name" });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className={`grid ${GRID_COLS} items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500`}
      >
        <div className="flex items-center justify-center">
          <Checkbox
            checked={allPageSelected}
            onCheckedChange={onToggleAll}
            aria-label="Select all on page"
          />
        </div>
        <div />
        <div>Product</div>
        <div className="hidden sm:block">Price</div>
        <div className="hidden sm:block">MRP</div>
        <div className="hidden sm:block">MOQ</div>
        <div className="hidden sm:block">Status</div>
        <div className="hidden text-center sm:block">Score</div>
        <div />
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading products…
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 text-center text-sm text-slate-400">
          No products match the current filters.
        </div>
      ) : (
        <div
          ref={scrollRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          aria-label="Products grid — arrow keys move, Enter opens, E edits name"
          className="overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:ring-inset"
          style={{ maxHeight: "calc(100vh - 320px)", minHeight: 240 }}
        >
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualizer.getVirtualItems().map(virtualRow => {
              const index = virtualRow.index;
              const product = products[index];
              const { score, missing } = productCompleteness(product);
              const isSelected = selected.has(product.id);
              const isFocused = index === focusedIndex;
              const img = normalizeImageUrl(product.image_url);
              const moqNA = product.na_fields?.includes("moq") ?? false;
              const save = rowStatus[product.id];

              return (
                <div
                  key={product.id}
                  className={`absolute left-0 top-0 grid ${GRID_COLS} w-full items-center gap-2 border-b border-slate-100 px-3 transition-colors ${
                    isSelected
                      ? "bg-red-50/60"
                      : isFocused
                        ? "bg-red-50/40"
                        : "hover:bg-slate-50"
                  } ${isFocused ? "ring-1 ring-inset ring-red-300" : ""}`}
                  style={{
                    height: ROW_HEIGHT,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={() => handleRowClick(product, index)}
                  onDoubleClick={() => {
                    // Editable cells stopPropagation, so this only fires on
                    // non-editable areas of the row.
                    if (!isMobile()) onOpen(product);
                  }}
                >
                  {/* select */}
                  <div
                    className="flex items-center justify-center"
                    onClick={e => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleRow(product.id)}
                      aria-label={`Select ${product.name}`}
                    />
                  </div>

                  {/* thumbnail */}
                  <div className="flex items-center justify-center">
                    <div className="w-10 h-10 rounded-md border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                      {img ? (
                        <img
                          src={img}
                          alt={product.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                  </div>

                  {/* name (editable) + variant + category */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="min-w-0 flex-1">
                        <InlineCell
                          editing={isEditing(product.id, "name")}
                          value={product.name}
                          placeholder="Product name"
                          inputClassName="h-7 w-full text-sm"
                          display={
                            <span className="block truncate font-medium text-slate-800">
                              {product.name}
                              {product.variant_label && (
                                <span className="ml-1.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 border border-indigo-100">
                                  {product.variant_label}
                                </span>
                              )}
                            </span>
                          }
                          onStartEdit={() =>
                            setEditing({ id: product.id, field: "name" })
                          }
                          onCommit={raw => commitName(product, raw)}
                          onCancel={() => setEditing(null)}
                        />
                      </div>
                    </div>
                    {/* desktop: category · mobile: price + status */}
                    <div className="hidden truncate text-xs text-slate-400 sm:block px-1.5">
                      {getCategoryName(product.category_id)}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 sm:hidden px-1.5">
                      <span className="text-xs tabular-nums text-slate-700">
                        {formatPrice(product.price)}
                      </span>
                      <StatusToggleBadge
                        product={product}
                        onInlineUpdate={onInlineUpdate}
                      />
                    </div>
                  </div>

                  {/* price (dbl-click editable) */}
                  <div className="hidden text-sm tabular-nums text-slate-700 sm:block">
                    <InlineCell
                      editing={isEditing(product.id, "price")}
                      type="number"
                      value={product.price == null ? "" : String(product.price)}
                      placeholder="Enquiry"
                      display={formatPrice(product.price)}
                      onStartEdit={() =>
                        setEditing({ id: product.id, field: "price" })
                      }
                      onCommit={raw => commitNumber(product, "price", raw)}
                      onCancel={() => setEditing(null)}
                    />
                  </div>

                  {/* mrp (dbl-click editable) */}
                  <div className="hidden text-sm tabular-nums text-slate-500 sm:block">
                    <InlineCell
                      editing={isEditing(product.id, "mrp")}
                      type="number"
                      value={product.mrp == null ? "" : String(product.mrp)}
                      placeholder="—"
                      display={
                        product.mrp != null ? (
                          `₹${product.mrp.toLocaleString("en-IN")}`
                        ) : (
                          <span className="text-slate-300">—</span>
                        )
                      }
                      onStartEdit={() =>
                        setEditing({ id: product.id, field: "mrp" })
                      }
                      onCommit={raw => commitNumber(product, "mrp", raw)}
                      onCancel={() => setEditing(null)}
                    />
                  </div>

                  {/* moq (dbl-click editable — unless marked N/A) */}
                  <div className="hidden text-sm tabular-nums text-slate-500 sm:block">
                    {moqNA ? (
                      <span
                        className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500"
                        title="MOQ is marked N/A — clear N/A in the editor to set a value"
                      >
                        N/A
                      </span>
                    ) : (
                      <InlineCell
                        editing={isEditing(product.id, "moq")}
                        type="number"
                        value={product.moq == null ? "" : String(product.moq)}
                        placeholder="—"
                        display={
                          product.moq != null ? (
                            String(product.moq)
                          ) : (
                            <span className="text-slate-300">—</span>
                          )
                        }
                        onStartEdit={() =>
                          setEditing({ id: product.id, field: "moq" })
                        }
                        onCommit={raw => commitNumber(product, "moq", raw)}
                        onCancel={() => setEditing(null)}
                      />
                    )}
                  </div>

                  {/* status toggle + active dot */}
                  <div className="hidden items-center gap-1.5 sm:flex">
                    <StatusToggleBadge
                      product={product}
                      onInlineUpdate={onInlineUpdate}
                    />
                    <span
                      title={product.is_active ? "Active" : "Inactive"}
                      className={`w-1.5 h-1.5 rounded-full ${
                        product.is_active ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                  </div>

                  {/* completeness score */}
                  <div className="hidden justify-center sm:flex">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${completenessColor(score)}`}
                      title={
                        missing.length
                          ? `Missing: ${missing.join(", ")}`
                          : "Complete"
                      }
                    >
                      {score}%
                    </span>
                  </div>

                  {/* save indicator / row menu */}
                  <div
                    className="flex items-center justify-center"
                    onClick={e => e.stopPropagation()}
                  >
                    {save === "saving" ? (
                      <Loader2
                        className="w-4 h-4 animate-spin text-slate-400"
                        aria-label="Saving"
                      />
                    ) : save === "saved" ? (
                      <Check
                        className="w-4 h-4 text-emerald-500"
                        aria-label="Saved"
                      />
                    ) : (
                      <RowMenu product={product} actions={actions} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Draft/Published toggle pill — same behavior as the shared /admin list.
function StatusToggleBadge({
  product,
  onInlineUpdate,
}: {
  product: Product;
  onInlineUpdate: (id: string, patch: ProductPatch) => void;
}) {
  const published = product.status === "published";
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        onInlineUpdate(product.id, {
          status: (published ? "draft" : "published") as ProductStatus,
        });
      }}
      onDoubleClick={e => e.stopPropagation()}
      title="Click to toggle published / draft"
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-bold transition-colors ${
        published
          ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
          : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
      }`}
    >
      {published ? "Published" : "Draft"}
    </button>
  );
}

function RowMenu({
  product,
  actions,
}: {
  product: Product;
  actions: ProductRowActions;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          aria-label="Row actions"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => actions.onEdit(product)}
          className="gap-2"
        >
          <Edit2 className="w-4 h-4 text-slate-500" />
          Edit details
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => actions.onManageImages(product)}
          className="gap-2"
        >
          <Images className="w-4 h-4 text-slate-500" />
          Manage images
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => actions.onDuplicate(product)}
          className="gap-2"
        >
          <Copy className="w-4 h-4 text-slate-500" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {product.status !== "published" && (
          <DropdownMenuItem
            onClick={() => actions.onTogglePublish(product)}
            className="gap-2"
          >
            <Power className="w-4 h-4 text-green-600" />
            Publish
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() =>
            actions.onToggleFeatured(product.id, product.is_featured)
          }
          className="gap-2"
        >
          <Star className="w-4 h-4 text-amber-500" />
          {product.is_featured ? "Unfeature" : "Feature"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => actions.onViewLive(product)}
          className="gap-2"
        >
          <ExternalLink className="w-4 h-4 text-slate-500" />
          View live
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => actions.onDelete(product.id)}
          className="gap-2 text-red-600"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
