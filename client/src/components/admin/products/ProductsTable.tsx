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
import { Product } from "@/lib/supabase";
import { normalizeImageUrl } from "@/lib/imageUtils";
import { productCompleteness, completenessColor } from "@/lib/catalogHealth";

// Row height for the virtualizer. Keep in sync with the row's rendered height.
const ROW_HEIGHT = 60;

// Compact, fixed grid — no horizontal scroll. The name column flexes (min-w-0
// so it truncates); everything else is a fixed track.
const GRID_COLS = "grid-cols-[40px_56px_minmax(0,1fr)_120px_140px_72px_48px]";

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
}

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
        <div>Price</div>
        <div>Status</div>
        <div className="text-center">Score</div>
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
                        <div className="truncate text-xs text-slate-400">
                          {getCategoryName(product.category_id)}
                        </div>
                      </div>

                      {/* price */}
                      <div className="text-sm tabular-nums text-slate-700">
                        {product.price == null ? (
                          <span className="text-slate-400 italic">Enquiry</span>
                        ) : (
                          formatPrice(product.price)
                        )}
                      </div>

                      {/* status */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                            product.status === "published"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {product.status === "published"
                            ? "Published"
                            : "Draft"}
                        </span>
                        <span
                          title={product.is_active ? "Active" : "Inactive"}
                          className={`w-1.5 h-1.5 rounded-full ${
                            product.is_active
                              ? "bg-emerald-500"
                              : "bg-slate-300"
                          }`}
                        />
                      </div>

                      {/* score */}
                      <div className="flex justify-center">
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
