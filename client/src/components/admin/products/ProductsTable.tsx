import { useMemo, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
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
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Product, ProductStatus } from "@/lib/supabase";
import { normalizeImageUrl } from "@/lib/imageUtils";
import { productCompleteness, completenessColor } from "@/lib/catalogHealth";
import EditableCell from "@/components/admin/products/EditableCell";

// Row height for the virtualizer. Keep in sync with the row's rendered height.
const ROW_HEIGHT = 60;

// Compact, fixed grid — no horizontal scroll. The name column flexes (min-w-0
// so it truncates); everything else is a fixed track.
//
// Responsive: on phones (< sm) the price / status / score columns are hidden
// (the cells use `hidden sm:…`, so they drop out of the grid flow entirely) and
// the template collapses to 4 tracks — select, image, name, actions. Price and
// status are then folded into a compact second line inside the name cell. This
// keeps the fixed tracks well under a 360px viewport so the name column never
// collapses to zero and the variant chip can no longer spill over the price.
const GRID_COLS =
  "grid-cols-[32px_44px_minmax(0,1fr)_40px] " +
  "sm:grid-cols-[40px_56px_minmax(0,1fr)_120px_140px_72px_48px]";

export interface ProductRowActions {
  onEdit: (product: Product) => void;
  onManageImages: (product: Product) => void;
  onDuplicate: (product: Product) => void;
  onDelete: (id: string) => void;
  onTogglePublish: (product: Product) => void;
  onToggleFeatured: (id: string, isFeatured: boolean) => void;
  onViewLive: (product: Product) => void;
}

interface ProductsTableProps extends ProductRowActions {
  products: Product[];
  loading: boolean;
  getCategoryName: (categoryId: string) => string;
  // selection (owned by the parent so existing bulk logic is reused)
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  allPageSelected: boolean;
  // opening the detail drawer / full editor for a row
  onRowOpen: (product: Product) => void;
  // inline (optimistic) field edits — parent persists via productService
  onInlineUpdate: (id: string, patch: ProductPatch) => void;
}

// price can be set to null (= "Price on enquiry"), which Partial<Product> alone
// (price?: number) does not express.
export type ProductPatch = Omit<Partial<Product>, "price"> & {
  price?: number | null;
};

function formatPrice(price: number): string {
  if (price === 0) return "Free";
  return `₹${price.toLocaleString("en-IN")}`;
}

export default function ProductsTable({
  products,
  loading,
  getCategoryName,
  selected,
  onToggleRow,
  onToggleAll,
  allPageSelected,
  onRowOpen,
  onInlineUpdate,
  ...actions
}: ProductsTableProps) {
  const columnHelper = createColumnHelper<Product>();

  // Column model lives in TanStack Table; cells are rendered by the virtualized
  // row below (we read column meta via the table instance for the header).
  const columns = useMemo(
    () => [
      columnHelper.display({ id: "select", header: "" }),
      columnHelper.display({ id: "image", header: "" }),
      columnHelper.accessor("name", { header: "Product" }),
      columnHelper.accessor("price", { header: "Price" }),
      columnHelper.accessor("status", { header: "Status" }),
      columnHelper.display({ id: "score", header: "Score" }),
      columnHelper.display({ id: "actions", header: "" }),
    ],
    [columnHelper]
  );

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

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
        <div className="hidden sm:block">Status</div>
        <div className="hidden text-center sm:block">Score</div>
        <div />
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading products…
        </div>
      ) : rows.length === 0 ? (
        <div className="py-20 text-center text-sm text-slate-400">
          No products match the current filters.
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 320px)", minHeight: 240 }}
        >
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualizer.getVirtualItems().map(virtualRow => {
              const product = rows[virtualRow.index].original;
              const { score, missing } = productCompleteness(product);
              const isSelected = selected.has(product.id);
              const img = normalizeImageUrl(product.image_url);
              const variantLabel = product.variant_label;

              return (
                <ContextMenu key={product.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`absolute left-0 top-0 grid ${GRID_COLS} w-full items-center gap-2 border-b border-slate-100 px-3 cursor-pointer transition-colors ${
                        isSelected ? "bg-red-50/60" : "hover:bg-slate-50"
                      }`}
                      style={{
                        height: ROW_HEIGHT,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      onClick={() => onRowOpen(product)}
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

                      {/* name + variant + category */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate font-medium text-slate-800">
                            {product.name}
                          </span>
                          {variantLabel && (
                            <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 border border-indigo-100">
                              {variantLabel}
                            </span>
                          )}
                        </div>
                        {/* desktop: category (its own column shows price/status) */}
                        <div className="hidden truncate text-xs text-slate-400 sm:block">
                          {getCategoryName(product.category_id)}
                        </div>
                        {/* mobile: price + status, since those columns are hidden < sm */}
                        <div className="mt-0.5 flex items-center gap-2 sm:hidden">
                          <span className="text-xs tabular-nums text-slate-700">
                            {product.price == null ? (
                              <span className="italic text-slate-400">
                                Enquiry
                              </span>
                            ) : (
                              formatPrice(product.price)
                            )}
                          </span>
                          <StatusToggleBadge
                            product={product}
                            onInlineUpdate={onInlineUpdate}
                          />
                        </div>
                      </div>

                      {/* price — inline editable (desktop column; mobile shows it in the name cell) */}
                      <div className="hidden text-sm tabular-nums text-slate-700 sm:block">
                        <EditableCell
                          type="number"
                          value={
                            product.price == null ? "" : String(product.price)
                          }
                          placeholder="Enquiry"
                          display={
                            product.price == null ? (
                              <span className="text-slate-400 italic">
                                Enquiry
                              </span>
                            ) : (
                              formatPrice(product.price)
                            )
                          }
                          onCommit={raw => {
                            const trimmed = raw.trim();
                            const price =
                              trimmed === "" ? null : Number(trimmed);
                            if (price !== null && Number.isNaN(price)) return;
                            onInlineUpdate(product.id, { price });
                          }}
                        />
                      </div>

                      {/* status — click to toggle draft/published (desktop column) */}
                      <div className="hidden items-center gap-1.5 sm:flex">
                        <StatusToggleBadge
                          product={product}
                          onInlineUpdate={onInlineUpdate}
                        />
                        <span
                          title={product.is_active ? "Active" : "Inactive"}
                          className={`w-1.5 h-1.5 rounded-full ${
                            product.is_active
                              ? "bg-emerald-500"
                              : "bg-slate-300"
                          }`}
                        />
                      </div>

                      {/* score (desktop column) */}
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

                      {/* row menu */}
                      <div
                        className="flex items-center justify-center"
                        onClick={e => e.stopPropagation()}
                      >
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
                            <RowMenuItems
                              product={product}
                              actions={actions}
                              ItemComponent={DropdownMenuItem}
                              SeparatorComponent={DropdownMenuSeparator}
                            />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-48">
                    <RowMenuItems
                      product={product}
                      actions={actions}
                      ItemComponent={ContextMenuItem}
                      SeparatorComponent={ContextMenuSeparator}
                    />
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Draft/Published toggle pill — shared by the desktop status column and the
// mobile compact line inside the name cell so both stay identical.
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

// Shared action list, rendered into either the dropdown or the right-click menu
// so both stay identical (the existing "Right-click PIM menu" capability).
function RowMenuItems({
  product,
  actions,
  ItemComponent,
  SeparatorComponent,
}: {
  product: Product;
  actions: ProductRowActions;
  ItemComponent: React.ElementType;
  SeparatorComponent: React.ElementType;
}) {
  return (
    <>
      <ItemComponent onClick={() => actions.onEdit(product)} className="gap-2">
        <Edit2 className="w-4 h-4 text-slate-500" />
        Edit details
      </ItemComponent>
      <ItemComponent
        onClick={() => actions.onManageImages(product)}
        className="gap-2"
      >
        <Images className="w-4 h-4 text-slate-500" />
        Manage images
      </ItemComponent>
      <ItemComponent
        onClick={() => actions.onDuplicate(product)}
        className="gap-2"
      >
        <Copy className="w-4 h-4 text-slate-500" />
        Duplicate
      </ItemComponent>
      <SeparatorComponent />
      {product.status !== "published" && (
        <ItemComponent
          onClick={() => actions.onTogglePublish(product)}
          className="gap-2"
        >
          <Power className="w-4 h-4 text-green-600" />
          Publish
        </ItemComponent>
      )}
      <ItemComponent
        onClick={() =>
          actions.onToggleFeatured(product.id, product.is_featured)
        }
        className="gap-2"
      >
        <Star className="w-4 h-4 text-amber-500" />
        {product.is_featured ? "Unfeature" : "Feature"}
      </ItemComponent>
      <ItemComponent
        onClick={() => actions.onViewLive(product)}
        className="gap-2"
      >
        <ExternalLink className="w-4 h-4 text-slate-500" />
        View live
      </ItemComponent>
      <SeparatorComponent />
      <ItemComponent
        onClick={() => actions.onDelete(product.id)}
        className="gap-2 text-red-600"
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </ItemComponent>
    </>
  );
}
