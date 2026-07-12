import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  FolderTree,
  ChevronRight,
  ChevronDown,
  Loader2,
  ImageIcon,
  Boxes,
  RefreshCw,
  PanelRightOpen,
  Search,
  Plus,
  X,
  Ban,
  Copy,
  Star,
  Trash2,
  Power,
  PowerOff,
  Globe,
  EyeOff,
  PackageOpen,
  MoreHorizontal,
  ExternalLink,
  Pencil,
  ShoppingBag,
  MessageSquare,
  Layers,
  FileText,
} from "lucide-react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { DataTable, DataTableDensity } from "@/components/ui/DataTable";
import { confirm } from "@/components/ui/confirm-dialog";
import CategoryCombobox from "@/components/admin/CategoryCombobox";
import { Category, Product, ProductStatus } from "@/lib/supabase";
import {
  productService,
  categoryService,
  AdminStatusFilter,
  BulkEditableField,
} from "@/lib/productService";
import { healthService, CategoryHealth } from "@/lib/healthService";
import { normalizeImageUrl } from "@/lib/imageUtils";
import { isPriceOnEnquiry } from "@/lib/priceUtils";
import {
  productCompleteness,
  completenessColor,
  MISSING_FILTERS,
  ATTENTION_LABELS,
  ATTENTION_FIELD,
  MissingFilter,
} from "@/lib/catalogHealth";
import CatalogProductPanel from "@/components/admin/CatalogProductPanel";

const PAGE_SIZE = 50;
const UNITS = ["pcs", "box", "pack", "roll", "kg", "litre", "set"];

// Fields that can be marked "not applicable" (must match the na_fields values
// v_product_health checks). Same list AdminProducts uses. Label → stored key.
const NA_FIELDS: Array<{ key: string; label: string }> = [
  { key: "brand", label: "Brand" },
  { key: "specifications", label: "Specs" },
  { key: "description", label: "Description" },
  { key: "image", label: "Image" },
];
const NA_FIELD_LABELS: Record<string, string> = Object.fromEntries(
  NA_FIELDS.map(f => [f.key, f.label])
);

// Maps a sortable column id → the getAllAdmin sort field (server-side sort).
const SORT_FIELD: Record<string, "name" | "price" | "updated_at"> = {
  name: "name",
  price: "price",
  updated: "updated_at",
};

// ── Fix-Missing quick chips ───────────────────────────────────────────────────
// The three most-common missing dimensions get a one-click chip (with a live
// count). The full 8-dimension set is reachable via the "Missing…" dropdown —
// both drive the same `activeMissing` state, whose truth lives in
// v_product_health (via catalogHealth's ATTENTION_FIELD map — no logic here).
const QUICK_MISSING: MissingFilter[] = ["no-price", "no-description", "no-image"];

// Status filter options — mirrors AdminProducts' StatusFilter exactly.
const STATUS_OPTIONS: { value: AdminStatusFilter; label: string }[] = [
  { value: "all", label: "All status" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "featured", label: "Featured" },
];

// activeMissing widens to this sentinel for the "Needs attention" saved view
// (any missing dimension, not one specific one). It never leaves this
// component — the Overview deep-link contract only knows the 8 specific
// MissingFilter values, so "any" is not reported upstream via onAttentionChange.
type ActiveMissing = MissingFilter | "any" | null;

// ── Saved-view tabs ────────────────────────────────────────────────────────────
// Presets over the EXISTING status/missing filter state — no new filtering
// logic, just one-click combinations a Shopify-style tab strip would offer.
interface SavedView {
  id: string;
  label: string;
  status: AdminStatusFilter;
  missing: ActiveMissing;
}
const SAVED_VIEWS: SavedView[] = [
  { id: "all", label: "All", status: "all", missing: null },
  { id: "published", label: "Published", status: "published", missing: null },
  { id: "draft", label: "Draft", status: "draft", missing: null },
  { id: "unavailable", label: "Unavailable", status: "inactive", missing: null },
  {
    id: "needs-attention",
    label: "Needs attention",
    status: "all",
    missing: "any",
  },
];

// Fields a reversible bulk action can snapshot + restore for Undo. "status" is
// a synthetic key (bulkSetStatus, not bulkUpdateField) alongside the real
// BulkEditableField columns.
type UndoField = BulkEditableField | "status";
// Beyond this many targeted ids, skip the pre-write snapshot (and thus the
// Undo offer) — the action still runs normally, just without the safety net,
// bounding the extra read + in-memory snapshot to a sane size.
const UNDO_SNAPSHOT_CAP = 500;

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
  // Missing-data filter set from outside (Overview chips deep-link with
  // ?tab=catalog-editor&missing=<key>). One-way sync: applied when the prop
  // CHANGES; internal changes report back via onAttentionChange.
  attentionFilter?: MissingFilter | null;
  onAttentionChange?: (filter: MissingFilter | null) => void;
  // Lets the Ctrl+K palette's "Go to X" nav actions switch AdminDashboard's
  // active tab (Orders/Enquiries/Site Content are sibling tabs there, not
  // sub-routes — Masters IS a sub-route and navigates via wouter instead).
  onTabChange?: (tab: string) => void;
}

/**
 * Catalog Tree Editor — THE admin products surface (Phase 2b: it replaced the
 * old AdminProducts table after parity was verified live). Layout: a left
 * collapsible Group › Category tree with health dots, a main inline-editable
 * product table (shared <DataTable>), and top "Fix Missing" filter chips.
 */
export default function CatalogTreeEditor({
  categories = [],
  attentionFilter = null,
  onAttentionChange,
  onTabChange,
}: CatalogTreeEditorProps) {
  const [, setLocation] = useLocation();
  const groups = useMemo(() => buildGroups(categories), [categories]);
  const categoryById = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  // Column visibility + density now live inside <DataTable> (persisted to the
  // URL under the `cat` key). We only mirror the visible column ids here so the
  // keyboard-nav helper knows which editable columns are on screen. Server-side
  // sort state is owned here and passed down.
  const [visibleColIds, setVisibleColIds] = useState<string[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);

  // Tree state
  const [selection, setSelection] = useState<TreeSelection>({ kind: "all" });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Per-category / per-group aggregates for the tree.
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [catHealth, setCatHealth] = useState<Record<string, CategoryHealth>>(
    {}
  );

  // Filters (parity with AdminProducts): global search, status, missing-data.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminStatusFilter>("all");
  const [activeMissing, setActiveMissing] = useState<ActiveMissing>(
    attentionFilter
  );
  // Live counts for the quick chips (scoped to the current node).
  const [chipCounts, setChipCounts] = useState<Record<string, number>>({});
  // Current DataTable density, mirrored here so cell renderers (thumbnail
  // size) can match it — see onDensityChange on <DataTable> below.
  const [density, setDensity] = useState<DataTableDensity>("comfortable");

  // Apply an external attention change (Overview deep-link) without clobbering
  // internal filter changes: only sync when the PROP itself changes.
  const prevAttentionProp = useRef(attentionFilter);
  useEffect(() => {
    if (attentionFilter !== prevAttentionProp.current) {
      prevAttentionProp.current = attentionFilter;
      setActiveMissing(attentionFilter);
    }
  }, [attentionFilter]);

  // All UI changes to the missing filter go through this so the parent
  // (AdminDashboard) stays in sync for future deep-links. "any" (the Needs
  // attention saved view) is a local-only concept — never reported upstream.
  const applyMissing = (f: ActiveMissing) => {
    setActiveMissing(f);
    if (f !== "any") onAttentionChange?.(f);
  };

  // Saved-view tabs — presets over status + missing. A view is "active" when
  // both pieces of state match it exactly; manual combos deselect all tabs.
  const isActiveView = (v: SavedView) =>
    statusFilter === v.status && activeMissing === v.missing;
  const applyView = (v: SavedView) => {
    setStatusFilter(v.status);
    applyMissing(v.missing);
  };

  // Debounce the search box → server-side name/SKU search.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Bulk selection. `selected` = explicitly checked ids; `selectAllMatching`
  // widens the scope to every id matching the active filters (not just the page).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  // Bulk field-setters (brand/MOQ) + the N/A dialog — same behavior as AdminProducts.
  const [bulkBrand, setBulkBrand] = useState("");
  const [bulkMoq, setBulkMoq] = useState("");
  const [naDialogOpen, setNaDialogOpen] = useState(false);
  const [naSelected, setNaSelected] = useState<string[]>([]);
  // Bumped after a one-shot "Set unit" so the Select remounts back to its
  // placeholder instead of sticking on the last picked value.
  const [unitSelectKey, setUnitSelectKey] = useState(0);

  // Table state
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

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
      const mc = await healthService.getMissingCounts(scopedCategoryIds);
      const next: Record<string, number> = {};
      for (const f of QUICK_MISSING) next[f] = mc[ATTENTION_FIELD[f]];
      setChipCounts(next);
    } catch {
      // Non-fatal — chips still render, just without counts.
    }
  }, [scopedCategoryIds]);

  useEffect(() => {
    loadChipCounts();
  }, [loadChipCounts]);

  // ── Load the table for the active node + page + chip ──────────────────────────
  // "any" (Needs attention) pulls every id with missing_count > 0 straight
  // from the view; a specific dimension pulls just that column — both stay
  // pure reads against v_product_health, no missing-logic re-derived here.
  const resolveMissingIds = (m: ActiveMissing): Promise<string[]> | null => {
    if (m === "any") return healthService.getIdsIncomplete(scopedCategoryIds);
    if (m) return healthService.getIdsMissing(ATTENTION_FIELD[m], scopedCategoryIds);
    return null;
  };

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      // A missing-data filter intersects with v_product_health ids; status +
      // search + category scope AND on top (all server-side).
      const ids = (await resolveMissingIds(activeMissing)) ?? undefined;
      const sort = sorting[0];
      const { data, count } = await productService.getAllAdmin({
        page,
        pageSize: PAGE_SIZE,
        categoryIds: scopedCategoryIds,
        ids,
        status: statusFilter,
        search: search || undefined,
        sortField: sort ? SORT_FIELD[sort.id] : undefined,
        sortAscending: sort ? !sort.desc : undefined,
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
  }, [page, scopedCategoryIds, activeMissing, statusFilter, search, sorting]);

  // Side-panel editor — holds the product being edited (null = closed).
  const [panelProduct, setPanelProduct] = useState<Product | null>(null);

  // ── Command palette (Ctrl+K) ──────────────────────────────────────────────────
  // Scoped to this tab rather than lifted app-wide — panelProduct/addNameRef
  // already live here, so this keeps the diff self-contained. A judgement call:
  // documented in the PR rather than a silent gap, since every item in the
  // manual-test checklist is reachable from the Catalog Editor tab already.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteResults, setPaletteResults] = useState<Product[]>([]);
  const [paletteLoading, setPaletteLoading] = useState(false);

  // ── Inline cell editing ──────────────────────────────────────────────────────
  const [cellEdit, setCellEdit] = useState<CellEdit | null>(null);

  // Focused cell for keyboard navigation (independent of the edit state).
  const gridRef = useRef<HTMLDivElement>(null);

  // ── Floating bulk bar height tracking ────────────────────────────────────────
  // The bar is `fixed` (Shopify-style dock at the viewport bottom, see the JSX
  // below) so it no longer occupies space in normal flow; a spacer of matching
  // height is rendered where it used to sit, sized via ResizeObserver since the
  // action row's flex-wrap makes its height vary with viewport width.
  const bulkBarRef = useRef<HTMLDivElement>(null);
  const [bulkBarHeight, setBulkBarHeight] = useState(0);
  const [focused, setFocused] = useState<{ id: string; field: EditField } | null>(
    null
  );
  const editableFields = useMemo<EditField[]>(() => {
    const f: EditField[] = ["name"];
    if (visibleColIds.includes("price")) f.push("price");
    if (visibleColIds.includes("description")) f.push("description");
    return f;
  }, [visibleColIds]);

  const startEdit = (
    productId: string,
    field: EditField,
    current: string | number | null | undefined
  ) => {
    setCellEdit({ productId, field, value: current == null ? "" : String(current) });
    setFocused({ id: productId, field });
  };
  const cancelEdit = () => setCellEdit(null);

  const moveFocus = (dRow: number, dCol: number) =>
    setFocused(cur => {
      if (!products.length) return cur;
      let r = cur ? products.findIndex(p => p.id === cur.id) : 0;
      let c = cur ? editableFields.indexOf(cur.field) : 0;
      if (r < 0) r = 0;
      if (c < 0) c = 0;
      r = Math.min(Math.max(r + dRow, 0), products.length - 1);
      c = Math.min(Math.max(c + dCol, 0), editableFields.length - 1);
      return { id: products[r].id, field: editableFields[c] };
    });

  const fieldValue = (prod: Product, field: EditField) =>
    field === "price"
      ? prod.price
      : field === "name"
        ? prod.name
        : prod.description;

  // Grid-level key handler: arrows move the focus ring, Enter edits (or, while
  // editing, saves and drops down), Tab saves and moves right, Esc cancels.
  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (cellEdit) {
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit();
        moveFocus(1, 0);
        gridRef.current?.focus();
      } else if (e.key === "Tab") {
        e.preventDefault();
        commitEdit();
        moveFocus(0, e.shiftKey ? -1 : 1);
        gridRef.current?.focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
        gridRef.current?.focus();
      }
      return;
    }
    const navKeys = [
      "ArrowDown",
      "ArrowUp",
      "ArrowLeft",
      "ArrowRight",
      "Enter",
    ];
    if (!navKeys.includes(e.key)) return;
    e.preventDefault();
    if (!focused) {
      if (products[0]) setFocused({ id: products[0].id, field: "name" });
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        moveFocus(1, 0);
        break;
      case "ArrowUp":
        moveFocus(-1, 0);
        break;
      case "ArrowRight":
        moveFocus(0, 1);
        break;
      case "ArrowLeft":
        moveFocus(0, -1);
        break;
      case "Enter": {
        const prod = products.find(p => p.id === focused.id);
        if (prod) startEdit(prod.id, focused.field, fieldValue(prod, focused.field));
        break;
      }
    }
  };

  // Global Ctrl+K / Cmd+K toggle. Guarded the same way handleGridKeyDown guards
  // its own nav keys — while a cell is mid-edit, Enter/Tab/Esc belong to that
  // editor, so the palette must not engage (its own Escape would otherwise race
  // the cell's).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (cellEdit) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(open => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cellEdit]);

  useEffect(() => {
    if (!paletteOpen) {
      setPaletteQuery("");
      setPaletteResults([]);
      return;
    }
    const q = paletteQuery.trim();
    if (!q) {
      setPaletteResults([]);
      return;
    }
    setPaletteLoading(true);
    const t = setTimeout(async () => {
      try {
        const results = await productService.searchAdmin(q);
        setPaletteResults(results);
      } catch {
        setPaletteResults([]);
      } finally {
        setPaletteLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [paletteQuery, paletteOpen]);

  // Re-fetches the full row before opening the side panel — searchAdmin only
  // returns id/name/sku/image_url/status/variant_label, and handing that
  // partial shape straight to useProductForm would silently blank every other
  // field on the next save.
  const handlePaletteSelectProduct = async (id: string) => {
    setPaletteOpen(false);
    try {
      const full = await productService.getById(id, { includeUnpublished: true });
      if (full) setPanelProduct(full);
      else toast.error("Product not found");
    } catch {
      toast.error("Couldn't open product");
    }
  };

  const handlePaletteGoTo = (tab: string) => {
    setPaletteOpen(false);
    onTabChange?.(tab);
  };

  const handlePaletteGoToMasters = () => {
    setPaletteOpen(false);
    setLocation("/admin/masters");
  };

  const handlePaletteAddProduct = () => {
    setPaletteOpen(false);
    setTimeout(() => addNameRef.current?.focus(), 50);
  };

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

  // ── Bulk selection ────────────────────────────────────────────────────────────
  const clearSelection = () => {
    setSelected(new Set());
    setSelectAllMatching(false);
  };
  const allPageSelected =
    products.length > 0 && products.every(p => selected.has(p.id));
  const selectionCount = selectAllMatching ? totalCount : selected.size;
  const canSelectAllMatching =
    allPageSelected && !selectAllMatching && totalCount > products.length;

  useEffect(() => {
    const el = bulkBarRef.current;
    if (!el || selectionCount === 0) {
      setBulkBarHeight(0);
      return;
    }
    const observer = new ResizeObserver(entries => {
      setBulkBarHeight(entries[0].contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [selectionCount > 0]);

  const toggleAll = () => {
    if (allPageSelected) clearSelection();
    else setSelected(new Set(products.map(p => p.id)));
  };
  const toggleRow = (id: string) => {
    if (selectAllMatching) setSelectAllMatching(false);
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Bulk actions (reuse the exact same services AdminProducts uses) ────────────
  const resolveTargetIds = async (): Promise<string[]> => {
    if (!selectAllMatching) return Array.from(selected);
    // Same filter set as loadProducts so "all matching" never drifts.
    const ids = (await resolveMissingIds(activeMissing)) ?? undefined;
    return productService.getAdminMatchingIds({
      categoryIds: scopedCategoryIds,
      ids,
      status: statusFilter,
      search: search || undefined,
    });
  };

  // ── Undo support for reversible bulk actions ────────────────────────────────
  // Snapshots the CURRENT value of `field` for the given ids fresh from the
  // server (not from local state) — correct regardless of whether the target
  // set spans multiple pages or "select all matching". Capped so a huge bulk
  // action just skips the Undo offer rather than snapshotting thousands of rows.
  const snapshotField = async (
    ids: string[],
    field: UndoField
  ): Promise<{ id: string; prevValue: unknown }[] | null> => {
    if (!ids.length || ids.length > UNDO_SNAPSHOT_CAP) return null;
    try {
      const { data } = await productService.getAllAdmin({
        ids,
        pageSize: ids.length,
      });
      return data.map(p => ({
        id: p.id,
        prevValue: (p as unknown as Record<string, unknown>)[field],
      }));
    } catch {
      return null;
    }
  };

  // Groups snapshot rows by their previous value so a mixed starting state
  // (e.g. some already published, some draft, before "Publish" ran) restores
  // correctly with the minimum number of writes — one per distinct value.
  const groupByPrevValue = (snap: { id: string; prevValue: unknown }[]) => {
    const map = new Map<string, { value: unknown; ids: string[] }>();
    for (const { id, prevValue } of snap) {
      const key = JSON.stringify(prevValue);
      if (!map.has(key)) map.set(key, { value: prevValue, ids: [] });
      map.get(key)!.ids.push(id);
    }
    return Array.from(map.values());
  };

  const undoField = async (
    field: UndoField,
    snap: { id: string; prevValue: unknown }[]
  ) => {
    try {
      for (const g of groupByPrevValue(snap)) {
        if (field === "status") {
          await productService.bulkSetStatus(g.ids, g.value as ProductStatus);
        } else {
          await productService.bulkUpdateField(
            g.ids,
            field,
            g.value as string | number | boolean | null
          );
        }
      }
      toast.success("Undone");
      loadProducts();
      loadAggregates();
      loadChipCounts();
    } catch {
      toast.error("Undo failed");
    }
  };

  // Shared flow (mirrors AdminProducts): resolve ids → optional transform (e.g.
  // skip variants) → confirm (AlertDialog) with the EXACT final count → snapshot
  // (when undoField given) → run → success toast, with an Undo action when a
  // snapshot was captured. Returns true only when the action actually ran
  // (false on empty targets, a cancelled confirm, or an error) so callers know
  // whether to clear their input.
  const runBulk = async (
    confirmTitle: (n: number) => string,
    run: (ids: string[]) => Promise<number>,
    opts?: {
      transform?: (ids: string[]) => Promise<{ ids: string[]; note?: string }>;
      undoField?: UndoField;
      destructive?: boolean;
    }
  ): Promise<boolean> => {
    if (bulkBusy) return false;
    setBulkBusy(true);
    try {
      let ids = await resolveTargetIds();
      let note = "";
      if (opts?.transform) {
        const t = await opts.transform(ids);
        ids = t.ids;
        note = t.note ?? "";
      }
      if (!ids.length) {
        toast.error("No matching products");
        return false;
      }
      const ok = await confirm({
        title: confirmTitle(ids.length),
        description: note || undefined,
        destructive: opts?.destructive,
      });
      if (!ok) return false;

      const snapshot = opts?.undoField
        ? await snapshotField(ids, opts.undoField)
        : null;

      const n = await run(ids);
      toast.success(
        `Updated ${n} product${n === 1 ? "" : "s"}`,
        snapshot
          ? {
              action: {
                label: "Undo",
                onClick: () => undoField(opts!.undoField!, snapshot),
              },
            }
          : undefined
      );
      clearSelection();
      loadProducts();
      loadAggregates();
      loadChipCounts();
      return true;
    } catch {
      toast.error("Bulk action failed");
      return false;
    } finally {
      setBulkBusy(false);
    }
  };

  const doPublish = () =>
    runBulk(
      n => `Publish ${n} product${n === 1 ? "" : "s"} to the website?`,
      ids => productService.bulkSetStatus(ids, "published"),
      { undoField: "status" }
    );
  const doUnpublish = () =>
    runBulk(
      n => `Unpublish ${n} product${n === 1 ? "" : "s"}?`,
      ids => productService.bulkSetStatus(ids, "draft"),
      { undoField: "status" }
    );
  const doDelete = () =>
    runBulk(
      n => `Delete ${n} product${n === 1 ? "" : "s"}?`,
      ids => productService.bulkDelete(ids),
      {
        destructive: true,
        // No undoField — a hard delete can't be snapshotted-and-restored via
        // the update-based services; the destructive confirm is the safety net.
      }
    );

  // ── Bulk field setters (same service methods AdminProducts uses) ───────────────
  const doSetBrand = async () => {
    const value = bulkBrand.trim();
    if (!value) {
      toast.error("Enter a brand first");
      return;
    }
    const ok = await runBulk(
      n => `Set brand to "${value}" for ${n} products?`,
      ids => productService.bulkUpdateField(ids, "brand", value),
      { undoField: "brand" }
    );
    if (ok) setBulkBrand("");
  };

  const doSetMoq = async () => {
    const n = parseInt(bulkMoq);
    if (isNaN(n) || n < 1) {
      toast.error("Enter a valid MOQ");
      return;
    }
    const ok = await runBulk(
      c => `Set MOQ to ${n} for ${c} products?`,
      ids => productService.bulkUpdateField(ids, "moq", n),
      { undoField: "moq" }
    );
    if (ok) setBulkMoq("");
  };

  const doSetUnit = async (unit: string) => {
    await runBulk(
      c => `Set unit to "${unit}" for ${c} products?`,
      ids => productService.bulkUpdateField(ids, "unit_of_measure", unit),
      { undoField: "unit_of_measure" }
    );
    // One-shot: reset the picker back to "Set unit…".
    setUnitSelectKey(k => k + 1);
  };

  const doSetCategory = (categoryId: string) => {
    const catName =
      categories.find(c => c.id === categoryId)?.name ?? "category";
    return runBulk(
      c => `Set category to "${catName}" for ${c} products?`,
      ids => productService.bulkUpdateField(ids, "category_id", categoryId),
      {
        undoField: "category_id",
        // Variants inherit their master's category — skip them (same as AdminProducts).
        transform: async ids => {
          const variants = await productService.getVariantIds(ids);
          const standalone = ids.filter(id => !variants.has(id));
          const skipped = ids.length - standalone.length;
          return {
            ids: standalone,
            note: skipped
              ? `${skipped} variant${skipped > 1 ? "s" : ""} skipped — variants inherit their master's category.`
              : "",
          };
        },
      }
    );
  };

  const doSetActive = (activate: boolean) =>
    runBulk(
      c => `${activate ? "Activate" : "Deactivate"} ${c} products?`,
      ids => productService.bulkUpdateField(ids, "is_active", activate),
      { undoField: "is_active" }
    );

  // N/A undo is intentionally NOT offered: bulkSetNA adds/removes fields from
  // each row's existing na_fields array (set semantics), so a naive "toggle
  // back" could clear a field a row had marked N/A for unrelated reasons
  // before this action ever ran — a real correctness risk, not just missing
  // polish. The AlertDialog confirm below is the safety net for this one.
  const doSetNA = (on: boolean) => {
    if (!naSelected.length) {
      toast.error("Pick at least one field");
      return;
    }
    const labels = naSelected.map(f => NA_FIELD_LABELS[f] ?? f).join(", ");
    setNaDialogOpen(false);
    runBulk(c => `${on ? "Mark" : "Clear"} N/A (${labels}) for ${c} products?`, ids =>
      productService.bulkSetNA(ids, naSelected, on)
    ).then(ok => {
      if (ok) setNaSelected([]);
    });
  };

  // ── Per-row: duplicate + feature toggle (same service methods as AdminProducts) ─
  const handleDuplicate = async (product: Product) => {
    try {
      // Drop identity + lineage fields: the copy is a fresh standalone product.
      // Keeping master_id/variant_label would drop the copy back into the same
      // master group under the same label (a duplicate variant).
      const {
        id,
        created_at,
        updated_at,
        sku,
        master_id,
        variant_label,
        ...fields
      } = product;
      void id;
      void created_at;
      void updated_at;
      void sku;
      void master_id;
      void variant_label;
      await productService.create({
        ...fields,
        name: `${product.name} (Copy)`,
        sku: undefined,
        master_id: null,
        variant_label: null,
        is_active: false,
        status: "draft",
      } as Omit<Product, "id" | "created_at" | "updated_at">);
      toast.success("Product duplicated");
      loadProducts();
      loadAggregates();
    } catch {
      toast.error("Failed to duplicate");
    }
  };

  const handleToggleFeatured = async (prod: Product) => {
    const next = !prod.is_featured;
    setProducts(prev =>
      prev.map(p => (p.id === prod.id ? { ...p, is_featured: next } : p))
    );
    try {
      await productService.toggleFeatured(prod.id, next);
    } catch {
      toast.error("Failed to update");
      loadProducts();
    }
  };

  // ── Row menu: publish toggle, view live, copy, delete ───────────────────────────
  // Same optimistic-update-via-productService.update() pattern toggleAvailability
  // already uses (just a different field) — no new service method, no new logic,
  // only the single-row status flip AdminProducts used to expose didn't survive
  // Phase 2b's removal, so it's re-added here the same way.
  const handleTogglePublish = async (prod: Product) => {
    const next: ProductStatus = prod.status === "published" ? "draft" : "published";
    setProducts(prev =>
      prev.map(p => (p.id === prod.id ? { ...p, status: next } : p))
    );
    try {
      await productService.update(prod.id, { status: next });
      toast.success(next === "published" ? "Published" : "Unpublished");
      loadAggregates();
      loadChipCounts();
    } catch {
      toast.error("Failed to update");
      loadProducts();
    }
  };

  const handleViewLive = (prod: Product) => {
    window.open(`${window.location.origin}/product/${prod.id}`, "_blank", "noopener,noreferrer");
  };

  const handleCopyName = async (prod: Product) => {
    try {
      await navigator.clipboard.writeText(prod.name);
      toast.success("Name copied");
    } catch {
      toast.error("Couldn't copy — clipboard access denied");
    }
  };

  const handleCopySku = async (prod: Product) => {
    if (!prod.sku) return;
    try {
      await navigator.clipboard.writeText(prod.sku);
      toast.success("SKU copied");
    } catch {
      toast.error("Couldn't copy — clipboard access denied");
    }
  };

  // Per-row delete — same confirm() dialog as every other destructive action
  // in this file, same productService.delete() the removed AdminProducts used
  // (its bulk sibling, bulkDelete, is already reused by the bulk bar).
  const handleDeleteOne = async (prod: Product) => {
    const ok = await confirm({
      title: `Delete "${prod.name}"?`,
      destructive: true,
    });
    if (!ok) return;
    try {
      await productService.delete(prod.id);
      toast.success("Product deleted");
      loadProducts();
      loadAggregates();
      loadChipCounts();
    } catch {
      toast.error("Failed to delete");
    }
  };

  // ── Add product (quick draft row) ─────────────────────────────────────────────
  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);
  const addNameRef = useRef<HTMLInputElement>(null);
  const handleAddProduct = async () => {
    const name = addName.trim();
    if (!name) {
      addNameRef.current?.focus();
      return;
    }
    setAdding(true);
    try {
      // Category defaults to the selected category node, else Uncategorized.
      let categoryId =
        selection.kind === "category" ? selection.categoryId : "";
      if (!categoryId) {
        categoryId = (await categoryService.getOrCreateUncategorized()) ?? "";
        if (!categoryId) {
          toast.error("Could not assign a category");
          return;
        }
      }
      await productService.create({
        name,
        category_id: categoryId,
        unit_of_measure: "pcs",
        is_active: true,
        is_featured: false,
        status: "draft",
        sku: `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      } as Omit<Product, "id" | "created_at" | "updated_at">);
      toast.success(`"${name}" added as draft`);
      setAddName("");
      loadProducts();
      loadAggregates();
      setTimeout(() => addNameRef.current?.focus(), 50);
    } catch {
      toast.error("Failed to add product");
    } finally {
      setAdding(false);
    }
  };

  // Reset to page 1 (and drop stale selection) whenever a filter changes.
  const prevScope = useRef<string>("");
  useEffect(() => {
    const key = JSON.stringify([
      scopedCategoryIds ?? "all",
      activeMissing,
      statusFilter,
      search,
      sorting,
    ]);
    if (prevScope.current !== key) {
      prevScope.current = key;
      clearSelection();
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedCategoryIds, activeMissing, statusFilter, search, sorting, page]);

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
    `w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${
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

  // Richer, Shopify-style empty state: a true "nothing here yet" (All
  // Products, no filters, zero rows) gets a CTA; a filtered-to-zero result
  // gets a "clear filters" escape hatch instead.
  const hasActiveFilters = !!(activeMissing || statusFilter !== "all" || search);
  const emptyState =
    selection.kind === "all" && !hasActiveFilters ? (
      <div className="flex flex-col items-center gap-3 py-6">
        <PackageOpen className="w-9 h-9 text-slate-300" />
        <div>
          <p className="font-medium text-slate-700">No products yet</p>
          <p className="text-sm text-slate-400 mt-0.5">
            Add your first product to get started.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => addNameRef.current?.focus()}
          className="bg-red-600 hover:bg-red-700 text-white gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add product
        </Button>
      </div>
    ) : (
      <div className="flex flex-col items-center gap-2 py-6">
        <p className="text-slate-400 text-sm">
          No products match this selection.
        </p>
        {hasActiveFilters && (
          <button
            onClick={() => {
              applyMissing(null);
              setStatusFilter("all");
              setSearchInput("");
            }}
            className="text-xs text-red-600 hover:text-red-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 rounded"
          >
            Clear filters
          </button>
        )}
      </div>
    );

  // ── Column definitions for <DataTable> ────────────────────────────────────────
  // Rebuilt each render so cell closures see the current edit/focus state (page
  // size is 50, so recreation is cheap and keeps inline editing correct).
  const editingHere = (id: string, field: EditField) =>
    cellEdit?.productId === id && cellEdit.field === field;
  const isFocusedHere = (id: string, field: EditField) =>
    focused?.id === id && focused.field === field;
  const focusRing = (id: string, field: EditField) =>
    isFocusedHere(id, field) && !editingHere(id, field)
      ? "ring-2 ring-red-400 ring-inset rounded-md"
      : "";
  const descMissing = (p: Product) =>
    !p.description?.trim() || p.description.trim().length < 15;
  const editorProps = {
    value: cellEdit?.value ?? "",
    onChange: (v: string) =>
      setCellEdit(prev => (prev ? { ...prev, value: v } : prev)),
    onCommit: commitEdit,
    onCancel: cancelEdit,
    managed: true,
  };

  // ── Row menu (right-click + "⋯" button) ──────────────────────────────────────
  // Same item list rendered into both a ContextMenu (right-click, desktop) and a
  // DropdownMenu (⋯ button, touch/discoverable everywhere) — `Item`/`Separator`
  // are injected so the JSX below doesn't fork between the two menu families.
  // Every action calls the EXACT existing handler already wired elsewhere in
  // this file (Open/Duplicate/Feature/N/A dialog etc.); only Publish-toggle,
  // View live, Copy, and per-row Delete are new — and those are thin wrappers
  // around productService.update()/.delete(), the same service methods already
  // used by toggleAvailability and the bulk bar (see the handlers above).
  type MenuItemComp = React.ComponentType<{
    onClick?: () => void;
    variant?: "default" | "destructive";
    disabled?: boolean;
    className?: string;
    children?: React.ReactNode;
  }>;
  type MenuSeparatorComp = React.ComponentType<Record<string, never>>;
  const renderRowMenuItems = (
    p: Product,
    Item: MenuItemComp,
    Separator: MenuSeparatorComp
  ) => (
    <>
      <Item onClick={() => setPanelProduct(p)} className="gap-2">
        <PanelRightOpen className="w-3.5 h-3.5" /> Open
      </Item>
      <Item
        onClick={() => setLocation(`/admin/products/${p.id}`)}
        className="gap-2"
      >
        <Pencil className="w-3.5 h-3.5" /> Edit full
      </Item>
      <Item onClick={() => handleDuplicate(p)} className="gap-2">
        <Copy className="w-3.5 h-3.5" /> Duplicate
      </Item>
      <Separator />
      <Item onClick={() => handleToggleFeatured(p)} className="gap-2">
        <Star className="w-3.5 h-3.5" />
        {p.is_featured ? "Unfeature" : "Feature"}
      </Item>
      <Item onClick={() => handleTogglePublish(p)} className="gap-2">
        {p.status === "published" ? (
          <EyeOff className="w-3.5 h-3.5" />
        ) : (
          <Globe className="w-3.5 h-3.5" />
        )}
        {p.status === "published" ? "Unpublish" : "Publish"}
      </Item>
      <Item onClick={() => handleViewLive(p)} className="gap-2">
        <ExternalLink className="w-3.5 h-3.5" /> View live
      </Item>
      <Separator />
      <Item onClick={() => handleCopyName(p)} className="gap-2">
        <Copy className="w-3.5 h-3.5" /> Copy name
      </Item>
      <Item onClick={() => handleCopySku(p)} disabled={!p.sku} className="gap-2">
        <Copy className="w-3.5 h-3.5" /> Copy SKU
      </Item>
      <Separator />
      <Item
        onClick={() => handleDeleteOne(p)}
        variant="destructive"
        className="gap-2"
      >
        <Trash2 className="w-3.5 h-3.5" /> Delete
      </Item>
    </>
  );

  const columns: ColumnDef<Product>[] = [
    {
      id: "name",
      accessorFn: p => p.name,
      header: "Name",
      enableSorting: true,
      size: 240,
      meta: { sticky: true, hideable: false },
      cell: ({ row }) => {
        const p = row.original;
        const img = p.image_url ? normalizeImageUrl(p.image_url) : null;
        const naImage = p.na_fields?.includes("image");
        // Comfortable rows get a bigger, more scannable thumbnail (Shopify-
        // style ~40-44px); compact stays tight for power entry.
        const thumbSize = density === "compact" ? "w-8 h-8" : "w-10 h-10";
        return (
          <div className="flex items-center gap-2 min-w-[190px]">
            <div
              className={`${thumbSize} flex-shrink-0 rounded-md border border-slate-200 overflow-hidden flex items-center justify-center ${
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
            <div className={`min-w-0 flex-1 ${focusRing(p.id, "name")}`}>
              {editingHere(p.id, "name") ? (
                <InlineInput {...editorProps} placeholder="Product name" />
              ) : (
                <button
                  onClick={() => startEdit(p.id, "name", p.name)}
                  className="text-left w-full group px-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                  title="Click to edit"
                >
                  <span className="font-medium text-slate-800 line-clamp-1 group-hover:text-red-600">
                    {p.name}
                  </span>
                </button>
              )}
            </div>
            {/* Feature toggle — always visible (star reflects state) */}
            <button
              onClick={() => handleToggleFeatured(p)}
              className={`flex-shrink-0 p-1 rounded-md hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${
                p.is_featured ? "text-amber-500" : "text-slate-300 hover:text-slate-400"
              }`}
              title={p.is_featured ? "Featured — click to unfeature" : "Feature"}
            >
              <Star
                className="w-3.5 h-3.5"
                fill={p.is_featured ? "currentColor" : "none"}
              />
            </button>
            {/* Duplicate — hover reveal */}
            <button
              onClick={() => handleDuplicate(p)}
              className="flex-shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              title="Duplicate product"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPanelProduct(p)}
              className="flex-shrink-0 inline-flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-1 text-[11px] font-medium text-slate-500 hover:border-red-300 hover:text-red-600 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              title="Open editor panel"
            >
              <PanelRightOpen className="w-3.5 h-3.5" />
              Open
            </button>
            {/* "⋯" menu — always visible (not hover-reveal) so the same actions
                the right-click context menu offers are reachable on touch. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={e => e.stopPropagation()}
                  className="flex-shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                  title="More actions"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {renderRowMenuItems(p, DropdownMenuItem, DropdownMenuSeparator)}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
    {
      id: "sku",
      header: "SKU",
      enableSorting: false,
      meta: { defaultHidden: true },
      cell: ({ row }) => (
        <span className="text-xs font-mono text-slate-500">
          {row.original.sku || "—"}
        </span>
      ),
    },
    {
      id: "category",
      header: "Category",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-xs text-slate-600">
          {categoryById.get(row.original.category_id)?.name ?? "—"}
        </span>
      ),
    },
    {
      id: "group",
      header: "Group",
      enableSorting: false,
      meta: { defaultHidden: true },
      cell: ({ row }) => (
        <span className="text-xs text-slate-500">
          {categoryById.get(row.original.category_id)?.group_name ?? "—"}
        </span>
      ),
    },
    {
      id: "unit",
      header: "Unit / Pack",
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <span className="text-xs text-slate-600 whitespace-nowrap">
            {p.unit_of_measure || "pcs"}
            {p.quantity_in_unit ? ` · ${p.quantity_in_unit}/pack` : ""}
          </span>
        );
      },
    },
    {
      id: "stock",
      header: "Stock",
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <button
            onClick={() => toggleAvailability(p)}
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
      },
    },
    {
      id: "price",
      accessorFn: p => p.price ?? null,
      header: "Price",
      enableSorting: true,
      meta: {
        cellClassName: (p: Product) =>
          `${isPriceOnEnquiry(p.price) && !editingHere(p.id, "price") ? RED_CELL : ""} ${focusRing(p.id, "price")}`,
      },
      cell: ({ row }) => {
        const p = row.original;
        return editingHere(p.id, "price") ? (
          <InlineInput {...editorProps} numeric placeholder="blank = enquiry" />
        ) : (
          <button
            onClick={() => startEdit(p.id, "price", p.price)}
            className="text-left w-full"
            title="Click to edit price"
          >
            {isPriceOnEnquiry(p.price) ? (
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
      },
    },
    {
      id: "description",
      header: "Description",
      enableSorting: false,
      meta: {
        cellClassName: (p: Product) =>
          `${descMissing(p) && !p.na_fields?.includes("description") && !editingHere(p.id, "description") ? RED_CELL : ""} ${focusRing(p.id, "description")}`,
      },
      cell: ({ row }) => {
        const p = row.original;
        const naDesc = p.na_fields?.includes("description");
        return editingHere(p.id, "description") ? (
          <InlineInput {...editorProps} placeholder="Short description" />
        ) : (
          <button
            onClick={() => startEdit(p.id, "description", p.description)}
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
      },
    },
    {
      id: "status",
      header: "Status",
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original;
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
      },
    },
    {
      id: "score",
      header: "Score",
      enableSorting: false,
      meta: { align: "center", defaultHidden: true },
      cell: ({ row }) => {
        const { score } = productCompleteness(row.original);
        return (
          <span
            className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${completenessColor(score)}`}
          >
            {score}
          </span>
        );
      },
    },
    {
      id: "updated",
      accessorFn: p => p.updated_at,
      header: "Updated",
      enableSorting: true,
      meta: { defaultHidden: true },
      cell: ({ row }) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {row.original.updated_at
            ? new Date(row.original.updated_at).toLocaleDateString()
            : "—"}
        </span>
      ),
    },
  ];

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
        <button
          onClick={() => {
            loadAggregates();
            loadChipCounts();
            loadProducts();
          }}
          disabled={loading}
          title="Reload"
          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── Saved views ────────────────────────────────────────────────────── */}
      {/* Presets over the status/missing filters above — one click to jump to
          a common view, Shopify-tab style. Not a new filter dimension. */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {SAVED_VIEWS.map(v => {
          const active = isActiveView(v);
          return (
            <button
              key={v.id}
              onClick={() => applyView(v)}
              aria-current={active ? "true" : undefined}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 rounded-t ${
                active
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200"
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {/* ── Toolbar: search · status · missing · add ───────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm">
        <div className="flex-1 min-w-[180px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search name or SKU…"
            className="pl-9 h-9 bg-slate-50 border-slate-200 text-sm"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={v => setStatusFilter(v as AdminStatusFilter)}
        >
          <SelectTrigger className="w-36 h-9 bg-slate-50 border-slate-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Full 8-dimension "Missing…" filter (parity with AdminProducts).
            "any" (Needs attention tab) has no single matching item here — it
            falls back to the placeholder rather than a phantom selection. */}
        <Select
          value={activeMissing && activeMissing !== "any" ? activeMissing : "none"}
          onValueChange={v =>
            applyMissing(v === "none" ? null : (v as MissingFilter))
          }
        >
          <SelectTrigger
            className={`w-40 h-9 border-slate-200 text-sm ${activeMissing && activeMissing !== "any" ? "bg-amber-50 border-amber-200 text-amber-800 font-semibold" : "bg-slate-50"}`}
          >
            <SelectValue placeholder="Missing…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Missing… (all)</SelectItem>
            {MISSING_FILTERS.map(f => (
              <SelectItem key={f} value={f}>
                {ATTENTION_LABELS[f]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        {/* Quick add — name auto-focused, saves as draft */}
        <div className="flex items-center gap-1">
          <Input
            ref={addNameRef}
            value={addName}
            onChange={e => setAddName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddProduct();
              }
            }}
            placeholder="New product name…"
            className="h-9 w-44 text-sm"
            disabled={adding}
          />
          <button
            onClick={handleAddProduct}
            disabled={adding}
            className="inline-flex items-center gap-1 h-9 rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 text-sm font-medium disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-1"
          >
            {adding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            Add
          </button>
        </div>
      </div>

      {/* ── Fix-Missing quick chips (with live counts) ─────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide mr-1">
          Fix missing
        </span>
        {QUICK_MISSING.map(f => {
          const active = activeMissing === f;
          const count = chipCounts[f] ?? 0;
          return (
            <button
              key={f}
              onClick={() => applyMissing(active ? null : f)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${
                active
                  ? "bg-red-600 border-red-600 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600"
              }`}
            >
              {ATTENTION_LABELS[f]}
              <span
                className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full px-1 text-[11px] font-semibold ${
                  active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
        {(activeMissing || statusFilter !== "all" || search) && (
          <button
            onClick={() => {
              applyMissing(null);
              setStatusFilter("all");
              setSearchInput("");
            }}
            className="text-xs text-slate-400 hover:text-slate-700 underline underline-offset-2 ml-1"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Bulk action bar ────────────────────────────────────────────────────────
          Docked to the viewport bottom (Shopify pattern) instead of pushing the
          table down — the same actions/handlers/icons as before, layout only.
          bottom-16 clears MobileAdminShell's 64px bottom tab bar below `md`;
          lg:left-[220px] clears AdminDashboard's static sidebar at that width. */}
      {selectionCount > 0 && (
        <div style={{ height: bulkBarHeight }} aria-hidden="true" />
      )}
      {selectionCount > 0 && (
        <div
          ref={bulkBarRef}
          className="fixed z-40 left-0 right-0 bottom-16 md:bottom-0 lg:left-[220px] bg-white border-t border-slate-300 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] px-4 py-3 space-y-3"
        >
          {/* Selection scope */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-slate-800">
              {selectAllMatching ? (
                <>
                  All{" "}
                  <span className="text-red-600">
                    {totalCount.toLocaleString()}
                  </span>{" "}
                  matching selected
                </>
              ) : (
                `${selected.size} selected`
              )}
            </span>
            {canSelectAllMatching && (
              <>
                <span className="text-slate-300">·</span>
                <button
                  onClick={() => setSelectAllMatching(true)}
                  className="font-semibold text-red-600 hover:text-red-700 underline underline-offset-2"
                >
                  Select all {totalCount.toLocaleString()} matching
                </button>
              </>
            )}
            <div className="flex-1" />
            {bulkBusy && (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            )}
            <button
              onClick={clearSelection}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          </div>

          {/* Actions — each confirms with the exact target count before writing */}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-1">
              <Input
                value={bulkBrand}
                onChange={e => setBulkBrand(e.target.value)}
                placeholder="Brand…"
                className="h-8 w-28 text-sm"
                disabled={bulkBusy}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={bulkBusy}
                onClick={doSetBrand}
              >
                Set
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="1"
                value={bulkMoq}
                onChange={e => setBulkMoq(e.target.value)}
                placeholder="MOQ…"
                className="h-8 w-20 text-sm"
                disabled={bulkBusy}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={bulkBusy}
                onClick={doSetMoq}
              >
                Set
              </Button>
            </div>
            <Select
              key={unitSelectKey}
              onValueChange={v => doSetUnit(v)}
              disabled={bulkBusy}
            >
              <SelectTrigger className="h-8 w-28 text-sm bg-slate-50">
                <SelectValue placeholder="Set unit…" />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map(u => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="w-44">
              <CategoryCombobox
                categories={categories}
                value=""
                onChange={id => {
                  if (id) doSetCategory(id);
                }}
                placeholder="Set category…"
                className="h-8 text-sm"
              />
            </div>
            <span className="w-px h-6 bg-slate-200" />
            <Button
              size="sm"
              className="h-8 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
              disabled={bulkBusy}
              onClick={doPublish}
            >
              <Globe className="w-3.5 h-3.5" /> Publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              disabled={bulkBusy}
              onClick={doUnpublish}
            >
              <EyeOff className="w-3.5 h-3.5" /> Unpublish
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              disabled={bulkBusy}
              onClick={() => doSetActive(true)}
            >
              <Power className="w-3.5 h-3.5" /> Activate
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              disabled={bulkBusy}
              onClick={() => doSetActive(false)}
            >
              <PowerOff className="w-3.5 h-3.5" /> Deactivate
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              disabled={bulkBusy}
              onClick={() => {
                setNaSelected([]);
                setNaDialogOpen(true);
              }}
            >
              <Ban className="w-3.5 h-3.5" /> N/A
            </Button>
            <span className="w-px h-6 bg-slate-200" />
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-xs gap-1"
              disabled={bulkBusy}
              onClick={doDelete}
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          </div>
        </div>
      )}

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

          <DataTable<Product>
            data={products}
            columns={columns}
            getRowId={p => p.id}
            loading={loading}
            emptyMessage={emptyState}
            persistKey="cat"
            onVisibleColumnsChange={setVisibleColIds}
            onDensityChange={setDensity}
            sorting={sorting}
            onSortingChange={setSorting}
            selection={{
              isSelected: id => selected.has(id),
              allPageSelected,
              onToggleRow: toggleRow,
              onToggleAll: toggleAll,
            }}
            pagination={{
              page,
              pageSize: PAGE_SIZE,
              total: totalCount,
              onPageChange: setPage,
            }}
            containerRef={gridRef}
            containerProps={{ tabIndex: 0, onKeyDown: handleGridKeyDown }}
            rowContextMenu={p =>
              renderRowMenuItems(p, ContextMenuItem, ContextMenuSeparator)
            }
          />
        </div>
      </div>

      {/* Side-panel editor */}
      <CatalogProductPanel
        product={panelProduct}
        open={!!panelProduct}
        categories={categories}
        onClose={() => setPanelProduct(null)}
        onSaved={updated => {
          setProducts(prev =>
            prev.map(p => (p.id === updated.id ? { ...p, ...updated } : p))
          );
          loadAggregates();
          loadChipCounts();
        }}
      />

      {/* ── Command palette (Ctrl+K) ─────────────────────────────────────────── */}
      <CommandDialog
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        shouldFilter={false}
      >
        <CommandInput
          placeholder="Search products by name or SKU…"
          value={paletteQuery}
          onValueChange={setPaletteQuery}
        />
        <CommandList>
          {paletteQuery.trim() && !paletteLoading && paletteResults.length === 0 && (
            <CommandEmpty>No products found.</CommandEmpty>
          )}
          {paletteResults.length > 0 && (
            <CommandGroup heading="Products">
              {paletteResults.map(p => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => handlePaletteSelectProduct(p.id)}
                  className="gap-2"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="flex-1 truncate">
                    {p.name}
                    {p.variant_label ? ` — ${p.variant_label}` : ""}
                  </span>
                  {p.sku && (
                    <span className="text-xs font-mono text-slate-400">{p.sku}</span>
                  )}
                  {p.status === "draft" && (
                    <span className="text-[10px] uppercase font-semibold text-amber-600">
                      Draft
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem onSelect={handlePaletteAddProduct} className="gap-2">
              <Plus className="w-3.5 h-3.5" /> Add product
            </CommandItem>
            <CommandItem
              onSelect={() => handlePaletteGoTo("orders")}
              className="gap-2"
            >
              <ShoppingBag className="w-3.5 h-3.5" /> Go to Orders
            </CommandItem>
            <CommandItem
              onSelect={() => handlePaletteGoTo("enquiries")}
              className="gap-2"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Go to Enquiries
            </CommandItem>
            <CommandItem onSelect={handlePaletteGoToMasters} className="gap-2">
              <Layers className="w-3.5 h-3.5" /> Go to Masters
            </CommandItem>
            <CommandItem
              onSelect={() => handlePaletteGoTo("site-content")}
              className="gap-2"
            >
              <FileText className="w-3.5 h-3.5" /> Go to Site Content
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* ── Bulk "Not applicable" dialog (same behavior as AdminProducts) ─────── */}
      <Dialog
        open={naDialogOpen}
        onOpenChange={open => {
          if (!open) {
            setNaDialogOpen(false);
            setNaSelected([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark fields “Not applicable”</DialogTitle>
            <DialogDescription>
              Pick which fields don’t apply to {selectionCount.toLocaleString()}{" "}
              selected product{selectionCount === 1 ? "" : "s"}. Marking N/A stops
              these from showing as “missing data”.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {NA_FIELDS.map(f => {
              const checked = naSelected.includes(f.key);
              return (
                <label
                  key={f.key}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() =>
                      setNaSelected(prev =>
                        prev.includes(f.key)
                          ? prev.filter(k => k !== f.key)
                          : [...prev, f.key]
                      )
                    }
                  />
                  <span className="text-sm text-slate-700">{f.label}</span>
                </label>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={bulkBusy}
              onClick={() => {
                setNaDialogOpen(false);
                setNaSelected([]);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkBusy || !naSelected.length}
              onClick={() => doSetNA(false)}
            >
              Clear N/A
            </Button>
            <Button
              size="sm"
              className="bg-slate-800 hover:bg-slate-900 text-white gap-1"
              disabled={bulkBusy || !naSelected.length}
              onClick={() => doSetNA(true)}
            >
              <Ban className="w-3.5 h-3.5" /> Mark N/A
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const RED_CELL = "bg-red-50/70";

// Auto-focusing inline editor. Blur always commits. In `managed` mode the
// enclosing grid owns Enter/Tab/Escape (so it can save-and-move); otherwise the
// input handles Enter (commit) / Escape (cancel) itself.
function InlineInput({
  value,
  onChange,
  onCommit,
  onCancel,
  numeric,
  placeholder,
  managed,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  numeric?: boolean;
  placeholder?: string;
  managed?: boolean;
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
      onKeyDown={
        managed
          ? undefined
          : e => {
              if (e.key === "Enter") {
                e.preventDefault();
                onCommit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }
      }
      className="w-full h-8 rounded-md border border-red-300 bg-white px-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-200"
    />
  );
}
