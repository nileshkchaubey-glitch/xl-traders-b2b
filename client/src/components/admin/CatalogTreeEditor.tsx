import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearch, useLocation } from "wouter";
import {
  FolderTree,
  ChevronRight,
  ChevronDown,
  Loader2,
  ImageIcon,
  Boxes,
  RefreshCw,
  Columns3,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Category, Product } from "@/lib/supabase";
import {
  productService,
  categoryService,
  AdminStatusFilter,
} from "@/lib/productService";
import {
  healthService,
  CategoryHealth,
  MissingCounts,
} from "@/lib/healthService";
import { normalizeImageUrl } from "@/lib/imageUtils";
import { isPriceOnEnquiry } from "@/lib/priceUtils";
import { productCompleteness, completenessColor } from "@/lib/catalogHealth";

const PAGE_SIZE = 50;

// ── Columns ───────────────────────────────────────────────────────────────────
type ColKey =
  | "sku"
  | "category"
  | "group"
  | "unit"
  | "stock"
  | "price"
  | "description"
  | "status"
  | "score"
  | "updated";

interface ColDef {
  key: ColKey;
  label: string;
  default: boolean;
}

// Name + checkbox are always shown (sticky-left) and so are not toggleable.
const COLUMNS: ColDef[] = [
  { key: "sku", label: "SKU", default: false },
  { key: "category", label: "Category", default: true },
  { key: "group", label: "Group", default: false },
  { key: "unit", label: "Unit / Pack", default: true },
  { key: "stock", label: "Stock", default: true },
  { key: "price", label: "Price", default: true },
  { key: "description", label: "Description", default: true },
  { key: "status", label: "Status", default: true },
  { key: "score", label: "Score", default: false },
  { key: "updated", label: "Updated", default: false },
];
const COL_KEYS = COLUMNS.map(c => c.key);
const DEFAULT_COLS = COLUMNS.filter(c => c.default).map(c => c.key);

// Parse the `cols` URL param into a valid column set (falls back to defaults).
function colsFromParam(raw: string | null): Set<ColKey> {
  if (!raw) return new Set(DEFAULT_COLS);
  const keys = raw.split(",").filter(k => (COL_KEYS as string[]).includes(k));
  return new Set(keys as ColKey[]);
}

// ── Fix-Missing chips ─────────────────────────────────────────────────────────
type ChipKey = "no-price" | "no-description" | "no-image" | "draft";
// The three health-backed chips map to a v_product_health missing_* field
// (via healthService); "draft" is a plain status filter, not a health metric.
const CHIP_FIELD: Record<
  "no-price" | "no-description" | "no-image",
  keyof MissingCounts
> = {
  "no-price": "price",
  "no-description": "description",
  "no-image": "image",
};
const CHIPS: { key: ChipKey; label: string }[] = [
  { key: "no-price", label: "No price" },
  { key: "no-description", label: "No description" },
  { key: "no-image", label: "No image" },
  { key: "draft", label: "Draft" },
];

// ── Inline editing ────────────────────────────────────────────────────────────
type EditField = "name" | "price" | "description";
interface CellEdit {
  productId: string;
  field: EditField;
  value: string;
}

// ── Tree selection ────────────────────────────────────────────────────────────
type TreeSelection =
  | { kind: "all" }
  | { kind: "group"; group: string }
  | { kind: "category"; categoryId: string };

// Categories with no group_name are bucketed under this label so they are still
// reachable in the tree (the storefront hides them; the editor must not).
const UNGROUPED = "Ungrouped";

interface TreeGroup {
  name: string;
  order: number;
  categories: Category[];
}

// Buckets the (already active-filtered) categories by group_name, ordered by
// the smallest group_order among a group's members, then alphabetically.
function buildGroups(categories: Category[]): TreeGroup[] {
  const map = new Map<string, TreeGroup>();
  for (const cat of categories) {
    const name = cat.group_name?.trim() || UNGROUPED;
    const order = cat.group_name ? (cat.group_order ?? 999) : 1000;
    const g = map.get(name);
    if (g) {
      g.categories.push(cat);
      g.order = Math.min(g.order, order);
    } else {
      map.set(name, { name, order, categories: [cat] });
    }
  }
  const groups = Array.from(map.values());
  for (const g of groups) {
    g.categories.sort((a, b) => a.display_order - b.display_order);
  }
  groups.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return groups;
}

// ── Health dot ────────────────────────────────────────────────────────────────
// Colour rule derived from v_product_health (via healthService.getCategoryHealth):
// green = every product complete, red = at least half incomplete, amber between,
// slate = no products yet. All logic stays in the view; this only colours.
function healthTone(h: CategoryHealth | undefined): {
  cls: string;
  title: string;
} {
  if (!h || h.total === 0)
    return { cls: "bg-slate-300", title: "No products" };
  if (h.incomplete === 0)
    return { cls: "bg-emerald-500", title: "All complete" };
  const ratio = h.incomplete / h.total;
  if (ratio >= 0.5)
    return {
      cls: "bg-red-500",
      title: `${h.incomplete}/${h.total} need attention`,
    };
  return {
    cls: "bg-amber-500",
    title: `${h.incomplete}/${h.total} need attention`,
  };
}

function HealthDot({ health }: { health: CategoryHealth | undefined }) {
  const { cls, title } = healthTone(health);
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${cls}`}
      title={title}
    />
  );
}

interface CatalogTreeEditorProps {
  // Lifted from AdminDashboard (shared with the Products/Categories tabs) so
  // edits made elsewhere appear here without a reload.
  categories?: Category[];
}

/**
 * Catalog Tree Editor — an additional catalogue editing surface that sits
 * alongside the existing AdminProducts table (it does NOT replace it). Layout:
 * a left collapsible Group › Category tree with health dots, a main
 * inline-editable product table, and top "Fix Missing" filter chips.
 *
 * Phase 1 of 3. Keyboard navigation is intentionally out of scope here.
 */
export default function CatalogTreeEditor({
  categories = [],
}: CatalogTreeEditorProps) {
  const groups = useMemo(() => buildGroups(categories), [categories]);
  const categoryById = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  // Column visibility — seeded from the `cols` URL param, persisted back to it
  // (in-memory + URL only; localStorage is restricted in our stack).
  const search = useSearch();
  const [, setLocation] = useLocation();
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(() =>
    colsFromParam(new URLSearchParams(search).get("cols"))
  );
  const isCol = useCallback(
    (key: ColKey) => visibleCols.has(key),
    [visibleCols]
  );
  const toggleCol = (key: ColKey) =>
    setVisibleCols(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  // Persist the choice to the URL (merging, so ?tab / ?missing survive).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("cols", COL_KEYS.filter(k => visibleCols.has(k)).join(","));
    setLocation(`/admin?${params.toString()}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCols]);

  // Tree state
  const [selection, setSelection] = useState<TreeSelection>({ kind: "all" });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Per-category / per-group aggregates for the tree.
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [catHealth, setCatHealth] = useState<Record<string, CategoryHealth>>(
    {}
  );

  // Fix-Missing chips: active filter + live counts (scoped to the current node).
  const [activeChip, setActiveChip] = useState<ChipKey | null>(null);
  const [chipCounts, setChipCounts] = useState<Record<ChipKey, number>>({
    "no-price": 0,
    "no-description": 0,
    "no-image": 0,
    draft: 0,
  });

  // Table state
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Resolve the category ids the current tree node covers. `undefined` = the
  // "All Products" root (no category constraint).
  const scopedCategoryIds = useMemo<string[] | undefined>(() => {
    if (selection.kind === "all") return undefined;
    if (selection.kind === "category") return [selection.categoryId];
    const g = groups.find(x => x.name === selection.group);
    return g ? g.categories.map(c => c.id) : [];
  }, [selection, groups]);

  // ── Load tree aggregates once (and on manual refresh) ────────────────────────
  const loadAggregates = useCallback(async () => {
    try {
      const [productCounts, health] = await Promise.all([
        categoryService.getProductCounts(),
        healthService.getCategoryHealth(),
      ]);
      setCounts(productCounts);
      setCatHealth(health);
    } catch {
      // Non-fatal — the tree still renders, just without counts/dots.
    }
  }, []);

  useEffect(() => {
    loadAggregates();
  }, [loadAggregates]);

  // Live chip counts, scoped to the active node (reuses the health view + a
  // status='draft' HEAD count — no missing-logic re-derived here).
  const loadChipCounts = useCallback(async () => {
    try {
      const [mc, draft] = await Promise.all([
        healthService.getMissingCounts(scopedCategoryIds),
        productService.getAllAdmin({
          status: "draft",
          categoryIds: scopedCategoryIds,
          pageSize: 1,
        }),
      ]);
      setChipCounts({
        "no-price": mc.price,
        "no-description": mc.description,
        "no-image": mc.image,
        draft: draft.count,
      });
    } catch {
      // Non-fatal — chips still render, just without counts.
    }
  }, [scopedCategoryIds]);

  useEffect(() => {
    loadChipCounts();
  }, [loadChipCounts]);

  // ── Load the table for the active node + page + chip ──────────────────────────
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      // Missing-field chips intersect with v_product_health ids; "draft" is a
      // plain status filter. Both AND with the node's category scope.
      let ids: string[] | undefined;
      let status: AdminStatusFilter = "all";
      if (activeChip === "draft") {
        status = "draft";
      } else if (activeChip) {
        ids = await healthService.getIdsMissing(
          CHIP_FIELD[activeChip],
          scopedCategoryIds
        );
      }
      const { data, count } = await productService.getAllAdmin({
        page,
        pageSize: PAGE_SIZE,
        categoryIds: scopedCategoryIds,
        ids,
        status,
      });
      setProducts(data);
      setTotalCount(count);
    } catch {
      toast.error("Failed to load products");
      setProducts([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, scopedCategoryIds, activeChip]);

  // ── Inline cell editing ──────────────────────────────────────────────────────
  const [cellEdit, setCellEdit] = useState<CellEdit | null>(null);

  const startEdit = (
    productId: string,
    field: EditField,
    current: string | number | null | undefined
  ) => setCellEdit({ productId, field, value: current == null ? "" : String(current) });
  const cancelEdit = () => setCellEdit(null);

  // Persist one field via productService (service layer only) with an optimistic
  // row patch. Blank price → NULL ("On Enquiry"), never 0. Tree aggregates are
  // refreshed since completeness (and thus a category's health dot) can change.
  const commitEdit = async () => {
    if (!cellEdit) return;
    const { productId, field, value } = cellEdit;
    const prod = products.find(p => p.id === productId);
    if (!prod) {
      setCellEdit(null);
      return;
    }

    const patch: Record<string, unknown> = {};
    if (field === "price") {
      const t = value.trim();
      const n = t === "" ? null : parseFloat(t);
      if (n !== null && isNaN(n)) {
        toast.error("Enter a valid price");
        return;
      }
      // Blank / 0 / negative all mean "on enquiry" → NULL, never a stored ₹0
      // (shared rule with the storefront — see lib/priceUtils.ts).
      patch.price = isPriceOnEnquiry(n) ? null : n;
    } else if (field === "name") {
      const t = value.trim();
      if (!t) {
        toast.error("Name can't be empty");
        return;
      }
      patch.name = t;
    } else {
      patch.description = value.trim() || null;
    }

    // No-op guard
    const current = (prod as unknown as Record<string, unknown>)[field] ?? "";
    const nextVal = patch[field] ?? "";
    if (String(current) === String(nextVal)) {
      setCellEdit(null);
      return;
    }

    setProducts(prev =>
      prev.map(p => (p.id === productId ? { ...p, ...patch } : p))
    );
    setCellEdit(null);
    try {
      await productService.update(productId, patch as Partial<Product>);
      toast.success("Saved");
      loadAggregates();
      loadChipCounts();
    } catch {
      toast.error("Save failed");
      loadProducts();
    }
  };

  // Availability toggles is_active directly (there is no separate stock field).
  const toggleAvailability = async (prod: Product) => {
    const next = !prod.is_active;
    setProducts(prev =>
      prev.map(p => (p.id === prod.id ? { ...p, is_active: next } : p))
    );
    try {
      await productService.update(prod.id, { is_active: next });
    } catch {
      toast.error("Update failed");
      loadProducts();
    }
  };

  // Reset to page 1 whenever the selected node or active chip changes.
  const prevScope = useRef<string>("");
  useEffect(() => {
    const key = JSON.stringify([scopedCategoryIds ?? "all", activeChip]);
    if (prevScope.current !== key) {
      prevScope.current = key;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedCategoryIds, activeChip, page]);

  // ── Tree derived helpers ─────────────────────────────────────────────────────
  const groupCount = (g: TreeGroup) =>
    g.categories.reduce((sum, c) => sum + (counts[c.id] ?? 0), 0);
  const groupHealth = (g: TreeGroup): CategoryHealth =>
    g.categories.reduce(
      (acc, c) => {
        const h = catHealth[c.id];
        if (h) {
          acc.total += h.total;
          acc.incomplete += h.incomplete;
        }
        return acc;
      },
      { total: 0, incomplete: 0 }
    );
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);

  const toggleGroup = (name: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const isSelected = (sel: TreeSelection) => {
    if (sel.kind !== selection.kind) return false;
    if (sel.kind === "group" && selection.kind === "group")
      return sel.group === selection.group;
    if (sel.kind === "category" && selection.kind === "category")
      return sel.categoryId === selection.categoryId;
    return sel.kind === "all";
  };

  const nodeCls = (active: boolean) =>
    `w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-left transition-colors ${
      active
        ? "bg-red-600 text-white font-semibold"
        : "text-slate-600 hover:bg-slate-100"
    }`;

  // Title of the current node for the table header.
  const scopeTitle =
    selection.kind === "all"
      ? "All Products"
      : selection.kind === "group"
        ? selection.group
        : (categoryById.get(selection.categoryId)?.name ?? "Category");

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center flex-shrink-0">
            <FolderTree className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Catalog Editor</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Browse by group &amp; category, edit inline, fix what's missing.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Columns toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                title="Columns"
                className="inline-flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors text-sm"
              >
                <Columns3 className="w-4 h-4" />
                <span className="hidden sm:inline">Columns</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs">
                Show columns
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-1 py-0.5 text-[11px] text-slate-400">
                Name is always shown
              </div>
              {COLUMNS.map(col => (
                <button
                  key={col.key}
                  onClick={e => {
                    e.preventDefault();
                    toggleCol(col.key);
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-slate-100 text-slate-700"
                >
                  {col.label}
                  {isCol(col.key) && (
                    <Check className="w-3.5 h-3.5 text-red-600" />
                  )}
                </button>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={() => {
              loadAggregates();
              loadChipCounts();
              loadProducts();
            }}
            disabled={loading}
            title="Reload"
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Fix-Missing chips ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide mr-1">
          Fix missing
        </span>
        {CHIPS.map(chip => {
          const active = activeChip === chip.key;
          const count = chipCounts[chip.key];
          return (
            <button
              key={chip.key}
              onClick={() => setActiveChip(active ? null : chip.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-red-600 border-red-600 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
              }`}
            >
              {chip.label}
              <span
                className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full px-1 text-[11px] font-semibold ${
                  active
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
        {activeChip && (
          <button
            onClick={() => setActiveChip(null)}
            className="text-xs text-slate-400 hover:text-slate-700 underline underline-offset-2 ml-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Two-pane layout ────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Left: collapsible tree */}
        <aside className="w-full lg:w-64 flex-shrink-0 bg-white border border-slate-200 rounded-xl p-2 lg:sticky lg:top-4 max-h-[75vh] overflow-y-auto">
          <button
            onClick={() => setSelection({ kind: "all" })}
            className={nodeCls(isSelected({ kind: "all" }))}
          >
            <Boxes className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 truncate">All Products</span>
            <span className="text-xs opacity-70">{allCount}</span>
          </button>

          <div className="mt-1 space-y-0.5">
            {groups.map(g => {
              const open = expanded.has(g.name);
              const gActive = isSelected({ kind: "group", group: g.name });
              return (
                <div key={g.name}>
                  <div className="flex items-center">
                    <button
                      onClick={() => toggleGroup(g.name)}
                      className="p-1 text-slate-400 hover:text-slate-700 flex-shrink-0"
                      aria-label={open ? "Collapse" : "Expand"}
                    >
                      {open ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() =>
                        setSelection({ kind: "group", group: g.name })
                      }
                      className={nodeCls(gActive) + " flex-1"}
                    >
                      <HealthDot health={groupHealth(g)} />
                      <span className="flex-1 truncate">{g.name}</span>
                      <span className="text-xs opacity-70">{groupCount(g)}</span>
                    </button>
                  </div>

                  {open && (
                    <div className="ml-5 mt-0.5 space-y-0.5 border-l border-slate-100 pl-1.5">
                      {g.categories.map(cat => {
                        const cActive = isSelected({
                          kind: "category",
                          categoryId: cat.id,
                        });
                        return (
                          <button
                            key={cat.id}
                            onClick={() =>
                              setSelection({
                                kind: "category",
                                categoryId: cat.id,
                              })
                            }
                            className={nodeCls(cActive)}
                          >
                            <HealthDot health={catHealth[cat.id]} />
                            <span className="flex-1 truncate">{cat.name}</span>
                            <span className="text-xs opacity-70">
                              {counts[cat.id] ?? 0}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Right: product table */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-semibold text-slate-700 truncate">
              {scopeTitle}
              <span className="ml-2 text-xs font-normal text-slate-400">
                {totalCount.toLocaleString()} product
                {totalCount === 1 ? "" : "s"}
              </span>
            </h2>
          </div>

          <ProductGrid
            products={products}
            loading={loading}
            categoryById={categoryById}
            visibleCols={visibleCols}
            cellEdit={cellEdit}
            onStartEdit={startEdit}
            onEditChange={v =>
              setCellEdit(prev => (prev ? { ...prev, value: v } : prev))
            }
            onCommit={commitEdit}
            onCancel={cancelEdit}
            onToggleAvailability={toggleAvailability}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mt-3">
              <p className="text-sm text-slate-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, totalCount)} of{" "}
                {totalCount.toLocaleString()}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-white disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-sm font-medium text-slate-700 px-1">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-white disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Product table ─────────────────────────────────────────────────────────────
interface GridEditProps {
  cellEdit: CellEdit | null;
  onStartEdit: (
    productId: string,
    field: EditField,
    current: string | number | null | undefined
  ) => void;
  onEditChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onToggleAvailability: (product: Product) => void;
}

// Sticky-left offsets: checkbox column (40px) then Name column pinned after it.
const STICKY_CHECK = "sticky left-0 z-20 bg-white";
const STICKY_NAME = "sticky z-20 bg-white";
const NAME_LEFT = 40; // px — width of the checkbox column

function ProductGrid({
  products,
  loading,
  categoryById,
  visibleCols,
  ...edit
}: {
  products: Product[];
  loading: boolean;
  categoryById: Map<string, Category>;
  visibleCols: Set<ColKey>;
} & GridEditProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-400 bg-white border border-slate-200 rounded-xl">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading products…
      </div>
    );
  }
  if (products.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-slate-400 bg-white border border-slate-200 rounded-xl">
        No products in this selection.
      </div>
    );
  }

  const cols = COLUMNS.filter(c => visibleCols.has(c.key));

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
      <table className="text-sm border-separate border-spacing-0 min-w-full">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th
              className={`${STICKY_CHECK} w-10 px-3 py-2 border-b border-slate-200`}
              style={{ left: 0 }}
            />
            <th
              className={`${STICKY_NAME} px-2 py-2 min-w-[200px] border-b border-r border-slate-200`}
              style={{ left: NAME_LEFT }}
            >
              Name
            </th>
            {cols.map(c => (
              <th
                key={c.key}
                className="px-3 py-2 whitespace-nowrap border-b border-slate-200"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <ProductRow
              key={p.id}
              product={p}
              categoryById={categoryById}
              visibleCols={visibleCols}
              {...edit}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const RED_CELL = "bg-red-50/70";

// Auto-focusing inline editor: Enter commits, Escape cancels, blur commits.
function InlineInput({
  value,
  onChange,
  onCommit,
  onCancel,
  numeric,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  numeric?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 20);
    return () => clearTimeout(t);
  }, []);
  return (
    <input
      ref={ref}
      type={numeric ? "number" : "text"}
      step={numeric ? "0.01" : undefined}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={e => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      className="w-full h-8 rounded-md border border-red-300 bg-white px-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-200"
    />
  );
}

function ProductRow({
  product,
  categoryById,
  visibleCols,
  cellEdit,
  onStartEdit,
  onEditChange,
  onCommit,
  onCancel,
  onToggleAvailability,
}: {
  product: Product;
  categoryById: Map<string, Category>;
  visibleCols: Set<ColKey>;
} & GridEditProps) {
  const p = product;
  const img = p.image_url ? normalizeImageUrl(p.image_url) : null;
  const naImage = p.na_fields?.includes("image");
  const naDesc = p.na_fields?.includes("description");
  const priceMissing = isPriceOnEnquiry(p.price);
  const descMissing = !p.description?.trim() || p.description.trim().length < 15;
  const cat = categoryById.get(p.category_id);

  const editingHere = (field: EditField) =>
    cellEdit?.productId === p.id && cellEdit.field === field;

  const editorProps = {
    value: cellEdit?.value ?? "",
    onChange: onEditChange,
    onCommit,
    onCancel,
  };

  const cols = COLUMNS.filter(c => visibleCols.has(c.key));

  const renderCell = (key: ColKey) => {
    switch (key) {
      case "sku":
        return (
          <span className="text-xs font-mono text-slate-500">
            {p.sku || "—"}
          </span>
        );
      case "category":
        return (
          <span className="text-xs text-slate-600">{cat?.name ?? "—"}</span>
        );
      case "group":
        return (
          <span className="text-xs text-slate-500">
            {cat?.group_name ?? "—"}
          </span>
        );
      case "unit":
        return (
          <span className="text-xs text-slate-600 whitespace-nowrap">
            {p.unit_of_measure || "pcs"}
            {p.quantity_in_unit ? ` · ${p.quantity_in_unit}/pack` : ""}
          </span>
        );
      case "stock":
        return (
          <button
            onClick={() => onToggleAvailability(p)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-md px-1.5 py-1 hover:bg-slate-100 ${
              p.is_active ? "text-emerald-700" : "text-slate-400"
            }`}
            title="Click to toggle availability"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                p.is_active ? "bg-emerald-500" : "bg-slate-300"
              }`}
            />
            {p.is_active ? "Available" : "Unavailable"}
          </button>
        );
      case "price":
        return editingHere("price") ? (
          <InlineInput {...editorProps} numeric placeholder="blank = enquiry" />
        ) : (
          <button
            onClick={() => onStartEdit(p.id, "price", p.price)}
            className="text-left w-full"
            title="Click to edit price"
          >
            {priceMissing ? (
              <span className="text-amber-700 text-xs font-semibold">
                On Enquiry
              </span>
            ) : (
              <span className="font-semibold text-slate-800">
                ₹{Number(p.price).toLocaleString()}
              </span>
            )}
          </button>
        );
      case "description":
        return editingHere("description") ? (
          <InlineInput {...editorProps} placeholder="Short description" />
        ) : (
          <button
            onClick={() => onStartEdit(p.id, "description", p.description)}
            className="text-left w-full min-w-[180px]"
            title="Click to edit description"
          >
            {p.description?.trim() ? (
              <span className="text-slate-600 text-xs line-clamp-2">
                {p.description}
              </span>
            ) : (
              <span className="text-red-400 text-xs italic">
                {naDesc ? "—" : "Add description"}
              </span>
            )}
          </button>
        );
      case "status":
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              p.status === "published"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {p.status === "published" ? "Published" : "Draft"}
          </span>
        );
      case "score": {
        const { score } = productCompleteness(p);
        return (
          <span
            className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${completenessColor(score)}`}
          >
            {score}
          </span>
        );
      }
      case "updated":
        return (
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {p.updated_at
              ? new Date(p.updated_at).toLocaleDateString()
              : "—"}
          </span>
        );
    }
  };

  // Red-tint helper for the columns that flag missing data.
  const cellTint = (key: ColKey) => {
    if (key === "price" && priceMissing && !editingHere("price"))
      return RED_CELL;
    if (
      key === "description" &&
      descMissing &&
      !naDesc &&
      !editingHere("description")
    )
      return RED_CELL;
    return "";
  };

  return (
    <tr className="hover:bg-slate-50/60 align-middle group/row">
      <td
        className={`${STICKY_CHECK} group-hover/row:bg-slate-50 px-3 py-2 border-b border-slate-100`}
        style={{ left: 0 }}
      >
        <input type="checkbox" disabled className="opacity-40" />
      </td>
      {/* Name — sticky, thumbnail + click-to-edit */}
      <td
        className={`${STICKY_NAME} group-hover/row:bg-slate-50 px-2 py-2 border-b border-r border-slate-100`}
        style={{ left: NAME_LEFT }}
      >
        <div className="flex items-center gap-2 min-w-[190px]">
          <div
            className={`w-8 h-8 flex-shrink-0 rounded-md border border-slate-200 overflow-hidden flex items-center justify-center ${
              img || naImage ? "bg-slate-50" : RED_CELL
            }`}
            title={img || naImage ? undefined : "No image"}
          >
            {img ? (
              <img
                src={img}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <ImageIcon
                className={`w-3.5 h-3.5 ${naImage ? "text-slate-300" : "text-red-400"}`}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {editingHere("name") ? (
              <InlineInput {...editorProps} placeholder="Product name" />
            ) : (
              <button
                onClick={() => onStartEdit(p.id, "name", p.name)}
                className="text-left w-full group"
                title="Click to edit"
              >
                <span className="font-medium text-slate-800 line-clamp-1 group-hover:text-red-600">
                  {p.name}
                </span>
              </button>
            )}
          </div>
        </div>
      </td>
      {cols.map(c => (
        <td
          key={c.key}
          className={`px-3 py-2 border-b border-slate-100 ${cellTint(c.key)}`}
        >
          {renderCell(c.key)}
        </td>
      ))}
    </tr>
  );
}
