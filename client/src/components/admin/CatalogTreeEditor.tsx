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
  PanelLeftOpen,
  PanelLeftClose,
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
  Eye,
  EyeOff,
  PackageOpen,
  MoreHorizontal,
  ExternalLink,
  Pencil,
  ShoppingBag,
  MessageSquare,
  Layers,
  FileText,
  Rows3,
  Images,
} from "lucide-react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import {
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
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
import BrandCombobox from "@/components/admin/BrandCombobox";
import { Brand, Category, Product, ProductStatus } from "@/lib/supabase";
import { brandsService } from "@/lib/brandsService";
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
import CatalogWorkbench from "@/components/admin/CatalogWorkbench";
import { validateEdit } from "@/lib/productValidation";
import {
  type PriceEntryMode,
  PRICE_MODE_PARAM,
  DEFAULT_PRICE_MODE,
  parsePriceMode,
  packDivisor,
  packFromPiece,
  pieceFromPack,
  perPieceRate,
  formatPerPiece,
} from "@/lib/priceEntryMode";
import { useSaveFeedback } from "@/hooks/useSaveFeedback";
import { useIsMobile } from "@/hooks/useMobile";

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
const QUICK_MISSING: MissingFilter[] = [
  "no-price",
  "no-description",
  "no-image",
];

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
  {
    id: "unavailable",
    label: "Unavailable",
    status: "inactive",
    missing: null,
  },
  {
    id: "needs-attention",
    label: "Needs attention",
    status: "all",
    missing: "any",
  },
];

// Fields a reversible bulk action can snapshot + restore for Undo. "status" is
// a synthetic key (bulkSetStatus, not bulkUpdateField) alongside the real
// BulkEditableField columns. "brand_pair" is likewise synthetic: the PIM P1
// dual-write sets brand_id AND the legacy brand text in one update
// (bulkSetBrand), so its snapshot/restore must carry both columns together —
// restoring either alone would desync the pair.
type UndoField = BulkEditableField | "status" | "brand_pair";
interface BrandPairValue {
  brand_id: string | null;
  brand: string;
}
// Beyond this many targeted ids, skip the pre-write snapshot (and thus the
// Undo offer) — the action still runs normally, just without the safety net,
// bounding the extra read + in-memory snapshot to a sane size.
const UNDO_SNAPSHOT_CAP = 500;

// ── Editing mode ──────────────────────────────────────────────────────────────
// "table"     — the spreadsheet-style DataTable (unchanged).
// "workbench" — image-first entry: product queue | large image | fields.
// Both are the SAME surface, filters and tree selection: only the right pane
// swaps. This is a mode, not a second admin (CODEX §6).
type EditorMode = "table" | "workbench";
const MODE_PARAM = "catMode";

// ── Inline editing ────────────────────────────────────────────────────────────
type EditField = "name" | "price" | "description";
interface CellEdit {
  productId: string;
  field: EditField;
  value: string;
  /**
   * Pieces per pack, set only when this price is being TYPED as a per-piece
   * rate. Captured once at startEdit rather than read live, so editing the
   * pack quantity elsewhere can't shift the multiplier under a half-typed
   * value. `undefined` = the value in the box is already a pack price, which
   * is what every non-price edit and every pack-mode edit is.
   */
  pieceDivisor?: number;
  /**
   * The stored pack price exactly as it was when this edit opened, and the
   * per-piece string first shown in the box.
   *
   * These exist because `pieceFromPack`/`packFromPiece` are not a lossless
   * pair (display rounds to 4 dp, storage to 2). ₹4897 over a pack of 480
   * displays as 10.2021 and converts back to ₹4897.01 — so simply opening a
   * price cell and pressing Enter would have written a value nobody typed,
   * and the no-op guard compares strings so it would not have caught it.
   * When the box still reads what it was seeded with, the original string is
   * reused verbatim and no conversion happens at all. (Same class as DE-01:
   * a silent data change, which is the thing this whole surface exists to
   * prevent.)
   */
  originalPack?: string;
  seededPiece?: string;
}

// ── Tree selection ────────────────────────────────────────────────────────────
type TreeSelection =
  | { kind: "all" }
  | { kind: "group"; group: string }
  | { kind: "category"; categoryId: string };

// The selected node persists to the URL so a refresh — or a shared link —
// reopens the same scope. Encoded as `all` | `g:<group name>` | `c:<uuid>`;
// URLSearchParams handles the escaping, so group names with spaces are fine.
const NODE_PARAM = "catNode";
/** Tree collapsed state — URL, not localStorage, like every other layout bit. */
const TREE_PARAM = "catTree";

function serializeNode(sel: TreeSelection): string | null {
  if (sel.kind === "all") return null;
  return sel.kind === "group" ? `g:${sel.group}` : `c:${sel.categoryId}`;
}

function parseNode(raw: string | null): TreeSelection {
  if (!raw) return { kind: "all" };
  if (raw.startsWith("g:")) return { kind: "group", group: raw.slice(2) };
  if (raw.startsWith("c:"))
    return { kind: "category", categoryId: raw.slice(2) };
  return { kind: "all" };
}

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
  if (!h || h.total === 0) return { cls: "bg-slate-300", title: "No products" };
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

  // Tree state. The selected node is the ONE scope filter — the tree (table
  // mode) and the Workbench's category picker both drive this same state, so
  // there is no parallel filtering system.
  const [selection, setSelection] = useState<TreeSelection>(() =>
    parseNode(new URLSearchParams(window.location.search).get(NODE_PARAM))
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Collapsing the tree hands ~230px to the table — the difference between the
  // Name column wrapping comfortably and clipping at 1366. Default expanded.
  const [treeCollapsed, setTreeCollapsed] = useState(
    () => new URLSearchParams(window.location.search).get(TREE_PARAM) === "0"
  );

  // ── Price entry mode ────────────────────────────────────────────────────────
  // Shared by the inline price cell here and the Workbench's price field: it
  // changes what the operator TYPES, never what is stored. `products.price`
  // stays the price of one selling unit in every path (lib/priceEntryMode.ts).
  // URL-persisted like every other layout/preference bit in this editor, so a
  // whole entry session keeps the mode across products, pages and modes.
  const [priceMode, setPriceMode] = useState<PriceEntryMode>(() =>
    parsePriceMode(
      new URLSearchParams(window.location.search).get(PRICE_MODE_PARAM)
    )
  );
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (priceMode === DEFAULT_PRICE_MODE) params.delete(PRICE_MODE_PARAM);
    else params.set(PRICE_MODE_PARAM, priceMode);
    setLocation(`${window.location.pathname}?${params.toString()}`, {
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceMode]);

  // Per-category / per-group aggregates for the tree.
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [catHealth, setCatHealth] = useState<Record<string, CategoryHealth>>(
    {}
  );

  // Filters (parity with AdminProducts): global search, status, missing-data.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminStatusFilter>("all");
  const [activeMissing, setActiveMissing] =
    useState<ActiveMissing>(attentionFilter);
  // Live counts for the quick chips (scoped to the current node).
  const [chipCounts, setChipCounts] = useState<Record<string, number>>({});

  // ── Editing mode: the table, or the image-first Workbench ────────────────────
  // Same tab, same data, same filters — only the right pane swaps. Persisted to
  // the URL alongside the DataTable's own layout params (no localStorage).
  const [mode, setMode] = useState<EditorMode>(() => {
    const raw = new URLSearchParams(window.location.search).get(MODE_PARAM);
    return raw === "workbench" ? "workbench" : "table";
  });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (mode === "workbench") params.set(MODE_PARAM, mode);
    else params.delete(MODE_PARAM);
    setLocation(`${window.location.pathname}?${params.toString()}`, {
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Same pattern for the selected node. Separate effects are safe because
  // history.replaceState updates window.location synchronously, so whichever
  // runs second reads the first one's write.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (treeCollapsed) params.set(TREE_PARAM, "0");
    else params.delete(TREE_PARAM);
    setLocation(`${window.location.pathname}?${params.toString()}`, {
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeCollapsed]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = serializeNode(selection);
    if (encoded) params.set(NODE_PARAM, encoded);
    else params.delete(NODE_PARAM);
    setLocation(`${window.location.pathname}?${params.toString()}`, {
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  // Ids the health view considers incomplete, scoped to the current node —
  // drives the Workbench list's per-product readiness marker. Straight from
  // v_product_health via healthService; no missing-logic re-derived here.
  // (The loader lives further down, after `scopedCategoryIds` is declared.)
  const [incompleteIds, setIncompleteIds] = useState<Set<string>>(new Set());
  // Current DataTable density, mirrored here so cell renderers (thumbnail
  // size) can match it — see onDensityChange on <DataTable> below.
  const [density, setDensity] = useState<DataTableDensity>("comfortable");

  // Lock the editor to the viewport (and hand the table body its own vertical
  // scroller) only on the desktop admin, whose <main> is a definite-height flex
  // column. MobileAdminShell renders its children inside a plain block in a
  // scrolling <main>, where `flex-1` has nothing to resolve against — the
  // table would flex-basis to 0 and collapse. Mobile keeps page scrolling.
  const isMobile = useIsMobile();
  const lockHeight = !isMobile;

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
  // bulkBrandId: "" = nothing picked yet; "none" = the explicit "No brand"
  // choice (distinct so an untouched picker can't accidentally clear brands).
  const [bulkBrandId, setBulkBrandId] = useState("");
  const [bulkMoq, setBulkMoq] = useState("");
  // Brand list for the bulk picker + the (hidden-by-default) Brand column.
  const [brands, setBrands] = useState<Brand[]>([]);
  useEffect(() => {
    brandsService
      .getAllAdmin()
      .then(setBrands)
      .catch(() => {});
  }, []);
  // PIM P1 assignment filter — canonical definition: brand_id IS NULL.
  const [unbrandedOnly, setUnbrandedOnly] = useState(false);
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

  // Readiness markers for the Workbench queue (see the state declaration above).
  // Only fetched in workbench mode — the table doesn't use it, and it is a
  // separate round-trip against v_product_health.
  const loadIncompleteIds = useCallback(async () => {
    try {
      const ids = await healthService.getIdsIncomplete(scopedCategoryIds);
      setIncompleteIds(new Set(ids));
    } catch {
      // Non-fatal — the list just renders without readiness markers.
    }
  }, [scopedCategoryIds]);

  useEffect(() => {
    if (mode === "workbench") loadIncompleteIds();
  }, [mode, loadIncompleteIds]);

  // ── Load the table for the active node + page + chip ──────────────────────────
  // "any" (Needs attention) pulls every id with missing_count > 0 straight
  // from the view; a specific dimension pulls just that column — both stay
  // pure reads against v_product_health, no missing-logic re-derived here.
  const resolveMissingIds = (m: ActiveMissing): Promise<string[]> | null => {
    if (m === "any") return healthService.getIdsIncomplete(scopedCategoryIds);
    if (m)
      return healthService.getIdsMissing(ATTENTION_FIELD[m], scopedCategoryIds);
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
        unbranded: unbrandedOnly || undefined,
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
  }, [
    page,
    scopedCategoryIds,
    activeMissing,
    statusFilter,
    unbrandedOnly,
    search,
    sorting,
  ]);

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

  // Save-feedback mechanics (re-entry guard + row pulse) now live in
  // hooks/useSaveFeedback.ts, shared with the Catalog Workbench.
  //
  // committingRef still exists for the same reason it did in PR-A: Enter/Tab
  // call commitEdit() and then move DOM focus to the grid, and that focus change
  // fires the editor's onBlur → a second commit from the same render's closure,
  // where `cellEdit` is still set and `products` is still pre-patch, so neither
  // the null-check nor the no-op guard catches it. Two productService.update()
  // calls and two toasts per keyboard commit without it.
  const { committingRef, flashRows, flashSaved } = useSaveFeedback();

  // Focused cell for keyboard navigation (independent of the edit state).
  const gridRef = useRef<HTMLDivElement>(null);

  // ── Floating bulk bar height tracking ────────────────────────────────────────
  // The bar is `fixed` (Shopify-style dock at the viewport bottom, see the JSX
  // below) so it no longer occupies space in normal flow; a spacer of matching
  // height is rendered where it used to sit, sized via ResizeObserver since the
  // action row's flex-wrap makes its height vary with viewport width.
  const bulkBarRef = useRef<HTMLDivElement>(null);
  const [bulkBarHeight, setBulkBarHeight] = useState(0);
  const [focused, setFocused] = useState<{
    id: string;
    field: EditField;
  } | null>(null);
  const editableFields = useMemo<EditField[]>(() => {
    const f: EditField[] = ["name"];
    if (visibleColIds.includes("price")) f.push("price");
    if (visibleColIds.includes("description")) f.push("description");
    return f;
  }, [visibleColIds]);

  // Takes the product rather than a raw value because the price cell needs the
  // row's pack quantity to seed a per-piece edit.
  const startEdit = (prod: Product, field: EditField) => {
    const current = fieldValue(prod, field);
    const raw = current == null ? "" : String(current);
    // Per-piece entry is offered only where it means something: price cells on
    // rows that actually declare a pack size (packDivisor rejects blank, junk
    // and 1). Every other cell is edited exactly as before.
    const divisor =
      field === "price" && priceMode === "piece"
        ? packDivisor(prod.quantity_in_unit)
        : null;
    const seededPiece =
      divisor == null ? undefined : pieceFromPack(raw, divisor);
    setCellEdit({
      productId: prod.id,
      field,
      value: divisor == null ? raw : seededPiece!,
      pieceDivisor: divisor ?? undefined,
      originalPack: divisor == null ? undefined : raw,
      seededPiece,
    });
    setFocused({ id: prod.id, field });
  };

  /**
   * The value an in-progress edit would actually store — a per-piece entry
   * multiplied back up to the pack price. Everything downstream (validateEdit,
   * the no-op guard, productService.update) sees only this, so the storage
   * contract is untouched by the entry mode.
   */
  const packValueOf = (edit: CellEdit) => {
    if (edit.pieceDivisor == null) return edit.value;
    // Displayed rate untouched (or typed back to exactly what it was): reuse
    // the stored string verbatim rather than round-tripping it through a
    // conversion pair that isn't lossless. See CellEdit.originalPack.
    if (edit.originalPack != null && edit.value === edit.seededPiece) {
      return edit.originalPack;
    }
    return packFromPiece(edit.value, edit.pieceDivisor);
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
      // Validate before advancing. commitEdit() is fired without awaiting so the
      // cursor moves at typing speed rather than at network speed, but a value
      // the grid would refuse must hold the cursor in place for correction —
      // otherwise Enter looks like it saved and quietly moved on.
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        // packValueOf, not cellEdit.value: in per-piece mode the box holds a
        // rate, and it is the pack price the validator must judge (and the
        // pack price the operator must be told about if it's refused).
        const result = validateEdit(cellEdit.field, packValueOf(cellEdit));
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        commitEdit();
        if (e.key === "Enter") moveFocus(1, 0);
        else moveFocus(0, e.shiftKey ? -1 : 1);
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
        if (prod) startEdit(prod, focused.field);
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
      const full = await productService.getById(id, {
        includeUnpublished: true,
      });
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

  // Restores one field to a prior value — backs the Undo action on every inline
  // save toast. Writes through the same service method the save did, so an undo
  // is just another tracked edit rather than a special path.
  const undoCellEdit = async (
    productId: string,
    field: keyof Product,
    previous: unknown
  ) => {
    setProducts(prev =>
      prev.map(p => (p.id === productId ? { ...p, [field]: previous } : p))
    );
    try {
      await productService.update(productId, {
        [field]: previous,
      } as Partial<Product>);
      toast.success("Undone");
      loadAggregates();
      loadChipCounts();
    } catch {
      toast.error("Undo failed");
      loadProducts();
    }
  };

  // Validation now lives in lib/productValidation.ts so this table and the
  // Catalog Workbench share one copy of the PR-A safety rules (blank price
  // refused, Number() not parseFloat, price > 0). It is still called BEFORE the
  // save round-trip by the grid's Enter/Tab handler, so a rejected value keeps
  // the cursor in the editor for correction rather than looking like it saved,
  // and the error toast fires once rather than once per path.

  // Persist one field via productService (service layer only) with an optimistic
  // row patch. Tree aggregates are refreshed since completeness (and thus a
  // category's health dot) can change.
  //
  // An invalid value here means the editor is being dismissed by blur (a click
  // elsewhere) rather than by Enter/Tab — the keyboard path validates first and
  // never gets this far. In that case the input is discarded and the stored
  // value is left untouched, which is the whole point: a typo must never
  // overwrite a real price.
  const commitEdit = async () => {
    if (!cellEdit || committingRef.current) return;
    const { productId, field } = cellEdit;
    // A per-piece entry becomes the pack price HERE, before anything else sees
    // it: validation, the no-op guard, the optimistic patch and the service
    // call all operate on the stored unit, exactly as they did before.
    const value = packValueOf(cellEdit);
    const prod = products.find(p => p.id === productId);
    if (!prod) {
      setCellEdit(null);
      return;
    }

    const result = validateEdit(field, value);
    if ("error" in result) {
      toast.error(result.error, { description: "Nothing was saved." });
      setCellEdit(null);
      return;
    }
    const { patch } = result;

    // No-op guard
    const current = (prod as unknown as Record<string, unknown>)[field] ?? "";
    const nextVal = patch[field] ?? "";
    if (String(current) === String(nextVal)) {
      setCellEdit(null);
      return;
    }

    const previous =
      (prod as unknown as Record<string, unknown>)[field] ?? null;
    setProducts(prev =>
      prev.map(p => (p.id === productId ? { ...p, ...patch } : p))
    );
    setCellEdit(null);
    committingRef.current = true;
    try {
      await productService.update(productId, patch as Partial<Product>);
      flashSaved(productId);
      toast.success("Saved", {
        action: {
          label: "Undo",
          onClick: () => undoCellEdit(productId, field, previous),
        },
      });
      loadAggregates();
      loadChipCounts();
    } catch {
      // Revert just this row. A full loadProducts() here would also throw away
      // every other edit still in flight elsewhere on the page.
      setProducts(prev =>
        prev.map(p => (p.id === productId ? { ...p, [field]: previous } : p))
      );
      toast.error("Save failed — change reverted");
    } finally {
      committingRef.current = false;
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
      flashSaved(prod.id);
      // Same Undo-on-toast pattern handleTogglePublish uses — a one-click
      // reversible flip needs feedback, not a confirm dialog.
      toast.success(next ? "Marked available" : "Marked unavailable", {
        action: {
          label: "Undo",
          onClick: () => undoCellEdit(prod.id, "is_active", !next),
        },
      });
    } catch {
      setProducts(prev =>
        prev.map(p => (p.id === prod.id ? { ...p, is_active: !next } : p))
      );
      toast.error("Update failed — change reverted");
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
      unbranded: unbrandedOnly || undefined,
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
        prevValue:
          field === "brand_pair"
            ? ({
                brand_id: p.brand_id ?? null,
                brand: p.brand ?? "",
              } satisfies BrandPairValue)
            : (p as unknown as Record<string, unknown>)[field],
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
        } else if (field === "brand_pair") {
          const pair = g.value as BrandPairValue;
          await productService.bulkSetBrand(g.ids, pair.brand_id, pair.brand);
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
  // PIM P1: brand is now picked from the brands table (BrandCombobox), not
  // typed free-text, and writes brand_id + the legacy text column together
  // (bulkSetBrand). Undo restores both via the "brand_pair" snapshot.
  const doSetBrand = async () => {
    if (!bulkBrandId) {
      toast.error("Pick a brand first");
      return;
    }
    const clearing = bulkBrandId === "none";
    const brand = clearing ? null : brands.find(b => b.id === bulkBrandId);
    if (!clearing && !brand) {
      toast.error("Pick a brand first");
      return;
    }
    const ok = await runBulk(
      n =>
        clearing
          ? `Clear brand on ${n} product${n === 1 ? "" : "s"}?`
          : `Set brand to "${brand!.name}" for ${n} product${n === 1 ? "" : "s"}?`,
      ids =>
        productService.bulkSetBrand(
          ids,
          clearing ? null : brand!.id,
          clearing ? "" : brand!.name
        ),
      { undoField: "brand_pair" }
    );
    if (ok) setBulkBrandId("");
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
    runBulk(
      c => `${on ? "Mark" : "Clear"} N/A (${labels}) for ${c} products?`,
      ids => productService.bulkSetNA(ids, naSelected, on)
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
    const next: ProductStatus =
      prod.status === "published" ? "draft" : "published";
    setProducts(prev =>
      prev.map(p => (p.id === prod.id ? { ...p, status: next } : p))
    );
    try {
      await productService.update(prod.id, { status: next });
      // Same Undo-on-toast pattern the reversible bulk actions use (Phase A) —
      // a one-click switch flip shouldn't need a confirm, just an easy way back.
      toast.success(next === "published" ? "Published" : "Unpublished", {
        action: {
          label: "Undo",
          onClick: async () => {
            setProducts(prev =>
              prev.map(p =>
                p.id === prod.id ? { ...p, status: prod.status } : p
              )
            );
            try {
              await productService.update(prod.id, { status: prod.status });
              toast.success("Undone");
            } catch {
              toast.error("Undo failed");
              loadProducts();
            }
            loadAggregates();
            loadChipCounts();
          },
        },
      });
      loadAggregates();
      loadChipCounts();
    } catch {
      toast.error("Failed to update");
      loadProducts();
    }
  };

  const handleViewLive = (prod: Product) => {
    window.open(
      `${window.location.origin}/product/${prod.id}`,
      "_blank",
      "noopener,noreferrer"
    );
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
      unbrandedOnly,
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
  }, [
    scopedCategoryIds,
    activeMissing,
    statusFilter,
    unbrandedOnly,
    search,
    sorting,
    page,
  ]);

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
  const hasActiveFilters = !!(
    activeMissing ||
    statusFilter !== "all" ||
    unbrandedOnly ||
    search
  );
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
              setUnbrandedOnly(false);
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
      <Item
        onClick={() => handleCopySku(p)}
        disabled={!p.sku}
        className="gap-2"
      >
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
      size: 300,
      minSize: 220,
      // Name is the flex column now (it was Description): it is the primary
      // identifier, so leftover width belongs to it rather than to a field
      // that is hidden by default.
      meta: { sticky: true, hideable: false, flex: true },
      cell: ({ row }) => {
        const p = row.original;
        const img = p.image_url ? normalizeImageUrl(p.image_url) : null;
        const naImage = p.na_fields?.includes("image");
        // Comfortable rows get a bigger, more scannable thumbnail (Dukaan/
        // Shopify-style ~40-44px); compact stays tight for power entry.
        const thumbSize = density === "compact" ? "w-8 h-8" : "w-11 h-11";
        // Dukaan-style subtitle under the name — surfaces category/SKU inline
        // when their dedicated column is hidden (the Columns menu default hides
        // SKU); when a column is shown, its own cell keeps the job.
        const subtitle = [
          !visibleColIds.includes("category") &&
            categoryById.get(p.category_id)?.name,
          !visibleColIds.includes("sku") && p.sku,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <div className="flex items-center gap-2.5 min-w-[190px] w-full">
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
                  onClick={() => startEdit(p, "name")}
                  className="text-left w-full px-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                  title="Click to edit"
                >
                  {/* Link-look (brand red), but the click stays inline-edit —
                      re-skin only; opening the panel lives in the actions
                      column / row menu. */}
                  {/* No clamp at all: the name is the primary identifier, so
                      it wraps to as many lines as it needs rather than
                      truncating. Rows keep a 64px floor and only grow past it
                      when a genuinely long name is in a narrow column — which
                      is the honest trade against hiding half the name. */}
                  <span
                    className="font-medium text-red-600 hover:underline leading-snug break-words"
                    title={p.name}
                  >
                    {p.name}
                  </span>
                  {subtitle && (
                    <span className="block text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      {subtitle}
                    </span>
                  )}
                </button>
              )}
            </div>
            {/* Featured is now an indicator, not a control: the toggle lives
                in the row menu (and the context menu), and the always-on
                button was costing the Name column ~28px of text width — the
                one column that must not run out of room. */}
            {p.is_featured && (
              <Star
                className="w-3.5 h-3.5 flex-shrink-0 text-amber-500"
                fill="currentColor"
                aria-label="Featured"
              />
            )}
          </div>
        );
      },
    },
    {
      id: "sku",
      header: "SKU",
      enableSorting: false,
      size: 120,
      minSize: 90,
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
      size: 145,
      minSize: 110,
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
      size: 170,
      minSize: 100,
      meta: { defaultHidden: true },
      cell: ({ row }) => (
        <span className="text-xs text-slate-500">
          {categoryById.get(row.original.category_id)?.group_name ?? "—"}
        </span>
      ),
    },
    {
      id: "brand",
      header: "Brand",
      enableSorting: false,
      size: 130,
      minSize: 100,
      meta: { defaultHidden: true },
      cell: ({ row }) => {
        const p = row.original;
        // brand_id is canonical; a text-only value (legacy, no id link — e.g.
        // 'Generic') is shown amber so unmigrated rows are visible at a glance.
        const linked = p.brand_id
          ? brands.find(b => b.id === p.brand_id)
          : null;
        if (linked)
          return (
            <span className="text-xs text-slate-600">
              {linked.name}
              {!linked.is_active && (
                <span className="text-slate-400"> (inactive)</span>
              )}
            </span>
          );
        return p.brand ? (
          <span className="text-xs text-amber-700" title="Text only — no brand link">
            {p.brand}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        );
      },
    },
    {
      id: "unit",
      header: "Unit / Pack",
      enableSorting: false,
      size: 112,
      minSize: 95,
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
      // Hidden by default (still in the Columns menu): with it and Description
      // on, the default set was 1330px wide and could not fit a 1366 laptop
      // beside the tree, which is what DE-07's horizontal scrollbar was.
      enableSorting: false,
      size: 140,
      minSize: 100,
      meta: { defaultHidden: true },
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
      // The header carries the entry mode because the cell is where the
      // consequence lands: a bare "Price" box that silently multiplies by 480
      // would be the worst possible surprise. Sortable headers wrap their
      // content in a <button>, so this is a label, not a second toggle — the
      // real control sits in the toolbar directly below.
      header: () =>
        priceMode === "piece" ? (
          <span
            className="inline-flex items-baseline gap-1"
            // Sorting stays on the STORED pack price: the sort runs in
            // Postgres over the price column, and a per-piece ordering would
            // need price/quantity_in_unit computed there. Rows with different
            // pack sizes will therefore not appear in per-piece order.
            title="Showing price per piece (price ÷ pack qty). Sorting still uses the stored pack price."
          >
            Price
            <span className="text-[10px] font-semibold text-red-600 normal-case">
              /pc
            </span>
          </span>
        ) : (
          <>Price</>
        ),
      enableSorting: true,
      size: 108,
      minSize: 90,
      meta: {
        // The header is a node now, so the Columns menu needs the plain label.
        toggleLabel: "Price",
        cellClassName: (p: Product) =>
          `${isPriceOnEnquiry(p.price) && !editingHere(p.id, "price") ? RED_CELL : ""} ${focusRing(p.id, "price")}`,
      },
      cell: ({ row }) => {
        const p = row.original;
        if (editingHere(p.id, "price")) {
          const divisor = cellEdit?.pieceDivisor;
          const packPreview = divisor != null ? packValueOf(cellEdit!) : "";
          const previewNum = Number(packPreview);
          return (
            <div className="relative">
              <InlineInput
                {...editorProps}
                numeric
                placeholder={divisor != null ? "e.g. 10.20" : "e.g. 4450"}
              />
              {/* Per-piece entry shows what it is about to store, live. The
                  operator is typing one number and saving another; that has
                  to be visible before Enter, not discovered afterwards. */}
              {divisor != null ? (
                <span className="block mt-0.5 text-[10px] leading-tight text-slate-500 whitespace-nowrap">
                  {packPreview === "" ? (
                    "/pc → pack price"
                  ) : Number.isFinite(previewNum) ? (
                    <>
                      = ₹
                      <strong className="font-semibold">
                        {previewNum.toLocaleString()}
                      </strong>
                      /pack of {divisor}
                    </>
                  ) : (
                    <span className="text-red-600">not a number</span>
                  )}
                </span>
              ) : (
                // Per-piece is on, but this row has no pack size to divide by,
                // so it falls back to pack entry. Saying so beats a "/pc"
                // column header quietly not applying to this one cell.
                priceMode === "piece" && (
                  <span className="block mt-0.5 text-[10px] leading-tight text-amber-700 whitespace-nowrap">
                    per pack — no pack qty
                  </span>
                )
              )}
            </div>
          );
        }
        // Read state follows the mode. It used to always render the stored
        // pack price on the theory that the entry mode was "an input
        // transform, not a display one" — but under a "/pc" column header
        // that shows ₹12 for a ₹12/pack-of-480 row, i.e. it states a
        // per-piece rate that is 480x too high, and an operator retyping
        // against that baseline would be working from a wrong number.
        // Display and editing now agree: what the cell shows is what
        // clicking it lets you type.
        const rate =
          priceMode === "piece"
            ? perPieceRate(p.price, p.quantity_in_unit)
            : null;
        return (
          <button
            onClick={() => startEdit(p, "price")}
            className="text-left w-full"
            title={
              rate != null
                ? `₹${Number(p.price).toLocaleString()} per pack of ${p.quantity_in_unit} — click to edit as a per-piece rate`
                : "Click to edit price"
            }
          >
            {isPriceOnEnquiry(p.price) ? (
              <span className="text-amber-700 text-xs font-semibold">
                On Enquiry
              </span>
            ) : rate != null ? (
              <span className="font-semibold text-slate-800">
                ₹{formatPerPiece(rate)}
              </span>
            ) : (
              <span className="font-semibold text-slate-800">
                ₹{Number(p.price).toLocaleString()}
                {/* Per-piece is on but this row has no pack qty to divide by,
                    so it is still a pack figure under a "/pc" header. Marked
                    per-row because the two kinds of row sit side by side. */}
                {priceMode === "piece" && (
                  <span className="ml-1 text-[10px] font-semibold text-amber-700">
                    /pack
                  </span>
                )}
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
      size: 260,
      minSize: 160,
      meta: {
        // Hidden by default; Name took over as the flex column.
        defaultHidden: true,
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
            onClick={() => startEdit(p, "description")}
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
      id: "score",
      header: "Score",
      enableSorting: false,
      size: 90,
      minSize: 70,
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
      size: 110,
      minSize: 90,
      meta: { defaultHidden: true },
      cell: ({ row }) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {row.original.updated_at
            ? new Date(row.original.updated_at).toLocaleDateString()
            : "—"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      enableSorting: false,
      size: 126,
      minSize: 120,
      // Pinned to the right (with the actions column) so the publish toggle
      // stays reachable without scrolling all the way across a wide table.
      // Kept immediately before "actions" in column order (score/updated
      // were moved ahead of it) — CSS sticky can only hold a pinned column
      // flush against another pinned one up to how far you've actually
      // scrolled, so any non-sticky column sitting between two stickyRight
      // columns can leave a gap on a table that doesn't overflow by much.
      // Keeping the two stickyRight columns adjacent sidesteps that.
      meta: { stickyRight: true },
      cell: ({ row }) => {
        const p = row.original;
        const published = p.status === "published";
        // Dukaan-style one-click toggle — same handleTogglePublish the row
        // menu uses (optimistic flip + Undo toast), just a switch instead of
        // a static badge.
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={published}
              onCheckedChange={() => handleTogglePublish(p)}
              className="data-[state=checked]:bg-emerald-500"
              aria-label={published ? "Unpublish" : "Publish to website"}
              title={published ? "Click to unpublish" : "Click to publish"}
            />
            <span
              className={`text-xs font-medium ${
                published ? "text-emerald-600" : "text-slate-400"
              }`}
            >
              {published ? "Published" : "Draft"}
            </span>
          </div>
        );
      },
    },
    {
      // Dukaan-style quiet row-end icon set. Replaces the name cell's old
      // hover-reveal Duplicate/Open buttons and its "⋯" — always visible so
      // everything stays reachable on touch. Same handlers as before.
      id: "actions",
      header: "",
      enableSorting: false,
      enableResizing: false,
      size: 96,
      minSize: 96,
      // Rightmost pinned column — always reachable regardless of how many
      // columns are visible or how far the table scrolls.
      meta: { hideable: false, align: "right", stickyRight: true },
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center justify-end gap-0.5">
            <button
              onClick={() => setPanelProduct(p)}
              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              title="Open editor panel"
            >
              <PanelRightOpen className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleViewLive(p)}
              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              title="View live on website"
            >
              <Eye className="w-4 h-4" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={e => e.stopPropagation()}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                  title="More actions"
                >
                  <MoreHorizontal className="w-4 h-4" />
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
  ];

  const workbenchMode = mode === "workbench";

  // Scope picker — Workbench's replacement for the category tree. Writes the
  // SAME `selection` state the tree does, so there is no parallel filter.
  const scopeSelect = (
    <Select
      value={serializeNode(selection) ?? "all"}
      onValueChange={v => setSelection(parseNode(v === "all" ? null : v))}
    >
      <SelectTrigger
        className={`w-56 h-9 border-slate-200 text-sm transition-colors duration-150 focus:ring-2 focus:ring-red-300 ${
          selection.kind === "all"
            ? "bg-slate-50"
            : "bg-red-50 border-red-200 text-red-800 font-semibold"
        }`}
        title="Scope the queue to one group or category"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        <SelectItem value="all">
          All products ({allCount.toLocaleString()})
        </SelectItem>
        {groups.map(g => (
          <SelectGroup key={g.name}>
            <SelectLabel>{g.name}</SelectLabel>
            <SelectItem value={`g:${g.name}`}>
              Everything in {g.name} ({groupCount(g)})
            </SelectItem>
            {g.categories.map(c => (
              <SelectItem key={c.id} value={`c:${c.id}`}>
                {c.name} ({counts[c.id] ?? 0})
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );

  const refreshButton = (
    <button
      onClick={() => {
        loadAggregates();
        loadChipCounts();
        loadProducts();
        if (workbenchMode) loadIncompleteIds();
      }}
      disabled={loading}
      title="Reload"
      className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
    >
      <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
    </button>
  );

  // Mode toggle — same tab, same filters, only the right pane swaps.
  const modeToggle = (
    <div
      role="group"
      aria-label="Editing mode"
      className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5"
    >
      {(
        [
          { id: "table", label: "Table", Icon: Rows3 },
          { id: "workbench", label: "Workbench", Icon: Images },
        ] as const
      ).map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={mode === id}
          title={`${label} mode`}
          onClick={() => setMode(id)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${
            mode === id
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Icon className="w-4 h-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );

  // Price entry mode. Reads as a sentence rather than two icons because it
  // changes the MEANING of a number the operator is about to type — the one
  // control here that is worth spelling out.
  const priceModeToggle = (
    <div
      role="group"
      aria-label="Price entry unit"
      title="Changes what you type. The stored price is always the price of one pack."
      className="inline-flex items-center gap-1.5"
    >
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
        Enter ₹
      </span>
      <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
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
            onClick={() => setPriceMode(id)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${
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
  );

  // Fix-Missing quick chips + the price-entry toggle, handed to <DataTable>'s
  // own toolbar row rather than rendered above it. That row already existed
  // and held nothing but the density/Columns buttons on its right — reusing it
  // saves a whole band of chrome at 1366x768, where every ~32px is a product
  // row that would otherwise be below the fold.
  const tableToolbarActions = (
    <>
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
          Fix
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
        {(activeMissing ||
          statusFilter !== "all" ||
          unbrandedOnly ||
          search) && (
          <button
            onClick={() => {
              applyMissing(null);
              setStatusFilter("all");
              setUnbrandedOnly(false);
              setSearchInput("");
            }}
            className="text-xs text-slate-400 hover:text-slate-700 underline underline-offset-2"
          >
            Clear filters
          </button>
        )}
      </div>
      {priceModeToggle}
    </>
  );

  return (
    // Both modes are a flex column that claims the viewport (see the height
    // chain documented in CatalogWorkbench). Table mode joined them so the
    // table body — not the page — is the vertical scroller, which is the only
    // way its column header can stick: `overflow-x: auto` on the table's
    // viewport forces `overflow-y: auto` too, so the header was pinning to a
    // box that itself scrolled off the page. The cost is that the chrome above
    // (title, tabs, toolbar, chips) no longer scrolls away; the upside is that
    // it, and the pagination footer, stay reachable at row 100.
    <div
      className={
        workbenchMode
          ? "flex flex-col gap-3 flex-1 min-h-0"
          : lockHeight
            ? "flex flex-col gap-2 flex-1 min-h-0"
            : "space-y-2"
      }
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {workbenchMode ? (
        // One compact line. The full header + saved-view tabs + search toolbar
        // + Fix-Missing chips came to ~380px of chrome, which came straight out
        // of the image pane — the one thing this mode exists to make big. Those
        // controls all belong to the table; the queue's own readiness markers
        // cover what the chips were for here.
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <div className="w-7 h-7 rounded-md bg-red-600 flex items-center justify-center flex-shrink-0">
            <FolderTree className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-base font-bold text-slate-900">Catalog Editor</h1>
          <span className="text-xs text-slate-400" aria-live="polite">
            {totalCount.toLocaleString()} product{totalCount === 1 ? "" : "s"}
            {selection.kind !== "all" && " in scope"}
          </span>
          <div className="flex-1" />
          {scopeSelect}
          {/* Refresh and the mode switch move into an overflow menu here: in
              Workbench mode the header is one line and the scope picker is the
              control that earns its place on it. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="More actions"
                aria-label="More actions"
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                disabled={loading}
                onClick={() => {
                  loadAggregates();
                  loadChipCounts();
                  loadProducts();
                  loadIncompleteIds();
                }}
                className="gap-2"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setMode("table")}
                className="gap-2"
              >
                <Rows3 className="w-3.5 h-3.5" /> Switch to Table
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
          {/* One line, like Workbench mode: the strapline was costing ~40px
              above the fold on every load without telling the operator
              anything they don't already know by the second visit. The icon
              and title match the Workbench header's size for the same
              reason — every row here is a row of products lost at 768px. */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-red-600 flex items-center justify-center flex-shrink-0">
              <FolderTree className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base font-bold text-slate-900">
              Catalog Editor
            </h1>
            <span className="text-xs text-slate-400">
              {totalCount.toLocaleString()} product
              {totalCount === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {modeToggle}
            {refreshButton}
          </div>
        </div>
      )}

      {/* Everything from here to the panes is table-mode chrome. */}
      {!workbenchMode && (
        <>
          {/* ── Saved views ──────────────────────────────────────────────── */}
          {/* Presets over the status/missing filters above — one click to jump to
          a common view, Shopify-tab style. Not a new filter dimension. */}
          <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto flex-shrink-0">
            {SAVED_VIEWS.map(v => {
              const active = isActiveView(v);
              return (
                <button
                  key={v.id}
                  onClick={() => applyView(v)}
                  aria-current={active ? "true" : undefined}
                  className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 rounded-t ${
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
          <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-sm flex-shrink-0">
            <div className="flex-1 min-w-[180px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search name or SKU…"
                className="pl-9 h-8 bg-slate-50 border-slate-200 text-sm"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={v => setStatusFilter(v as AdminStatusFilter)}
            >
              <SelectTrigger className="w-32 h-8 data-[size=default]:h-8 bg-slate-50 border-slate-200 text-sm">
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
              value={
                activeMissing && activeMissing !== "any"
                  ? activeMissing
                  : "none"
              }
              onValueChange={v =>
                applyMissing(v === "none" ? null : (v as MissingFilter))
              }
            >
              <SelectTrigger
                className={`w-36 h-8 data-[size=default]:h-8 border-slate-200 text-sm ${activeMissing && activeMissing !== "any" ? "bg-amber-50 border-amber-200 text-amber-800 font-semibold" : "bg-slate-50"}`}
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
            {/* PIM P1 assignment filter. Deliberately separate from Missing…
            (which is v_product_health over the legacy text column): this is
            the canonical brand_id IS NULL, the set that actually needs
            assignment work. Toggle chip, ANDs with every other filter. */}
            <button
              type="button"
              onClick={() => setUnbrandedOnly(v => !v)}
              className={`h-8 px-3 rounded-md border text-sm font-medium transition ${
                unbrandedOnly
                  ? "bg-amber-50 border-amber-200 text-amber-800 font-semibold"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
              aria-pressed={unbrandedOnly}
            >
              Unbranded
            </button>
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
                className="h-8 w-44 text-sm"
                disabled={adding}
              />
              <button
                onClick={handleAddProduct}
                disabled={adding}
                className="inline-flex items-center gap-1 h-8 rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 text-sm font-medium disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-1"
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
        </>
      )}

      {/* ── Bulk action bar ────────────────────────────────────────────────────────
          Docked to the viewport bottom (Shopify pattern) instead of pushing the
          table down — the same actions/handlers/icons as before, layout only.
          bottom-16 clears MobileAdminShell's 64px bottom tab bar below `md`;
          lg:left-[220px] clears AdminDashboard's static sidebar at that width. */}
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
              <BrandCombobox
                brands={brands}
                value={bulkBrandId === "none" ? "" : bulkBrandId}
                onChange={id => setBulkBrandId(id === "" ? "none" : id)}
                // "" doubles as untouched AND the explicit No-brand choice in
                // the underlying picker, so reflect which one this is.
                placeholder={bulkBrandId === "none" ? "No brand" : "Brand…"}
                className="h-8 w-36 text-xs"
                openOnFocus={false}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={bulkBusy || !bulkBrandId}
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
      <div
        className={
          workbenchMode
            ? "flex flex-1 min-h-0"
            : // lg:items-stretch so the table pane is as tall as the row and can
              // cap its own scroller; below lg the panes stack and the tree keeps
              // its natural height above the table.
              `flex flex-col lg:flex-row gap-4 items-start lg:items-stretch ${
                lockHeight ? "flex-1 min-h-0" : ""
              }`
        }
      >
        {/* Left: collapsible tree — TABLE MODE ONLY.
            The Workbench has three panes of its own (queue | image | fields);
            rendering the tree beside them made four, and at 1280px the fields
            pane was crushed to the point of truncating "480" to "48(" (DE-08
            reappearing). The Workbench's queue header already names the active
            scope, so the tree is redundant there. Selection state is shared, so
            switching to Table mode, picking a category, and switching back
            carries the scope across. */}
        {mode === "table" && treeCollapsed && (
          <aside className="hidden lg:flex flex-shrink-0 w-10 flex-col items-center gap-2 bg-white border border-slate-200 rounded-xl py-2">
            <button
              onClick={() => setTreeCollapsed(false)}
              title="Show categories"
              aria-label="Show categories"
              aria-expanded={false}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
            <FolderTree className="w-4 h-4 text-slate-300" />
            {selection.kind !== "all" && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-red-500"
                title={`Scoped to ${scopeTitle}`}
              />
            )}
          </aside>
        )}
        {mode === "table" && !treeCollapsed && (
          <aside className="w-full lg:w-56 flex-shrink-0 bg-white border border-slate-200 rounded-xl p-2 max-h-[75vh] lg:max-h-none overflow-y-auto">
            <div className="flex items-center justify-between gap-1 px-1 pb-1.5 mb-1 border-b border-slate-100">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Categories
              </span>
              <button
                onClick={() => setTreeCollapsed(true)}
                title="Hide categories"
                aria-label="Hide categories"
                aria-expanded
                className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
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
                        <span className="text-xs opacity-70">
                          {groupCount(g)}
                        </span>
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
                              <span className="flex-1 truncate">
                                {cat.name}
                              </span>
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
        )}

        {/* Right: product table (Table mode) or the Workbench (Workbench mode) */}
        <div
          className={`flex-1 min-w-0 w-full ${
            workbenchMode || lockHeight ? "flex flex-col min-h-0" : ""
          }`}
        >
          {/* The Workbench's queue pane already carries the scope title and the
              N / total counter, and every row above it costs the locked shell
              image height — so this header is table-mode only. */}
          {mode === "table" && treeCollapsed && selection.kind !== "all" && (
            // Only when the tree is hidden — otherwise the selected node is
            // already highlighted two inches to the left.
            <div className="flex items-center gap-2 mb-1.5">
              <h2 className="text-xs font-semibold text-slate-500 truncate">
                {scopeTitle}
              </h2>
              <button
                onClick={() => setSelection({ kind: "all" })}
                className="text-xs text-slate-400 hover:text-slate-700 underline underline-offset-2"
              >
                clear
              </button>
            </div>
          )}

          {mode === "workbench" ? (
            <CatalogWorkbench
              products={products}
              loading={loading}
              categories={categories}
              totalCount={totalCount}
              pageOffset={(page - 1) * PAGE_SIZE + 1}
              incompleteIds={incompleteIds}
              scopeTitle={scopeTitle}
              priceMode={priceMode}
              onPriceModeChange={setPriceMode}
              hasNextPage={page * PAGE_SIZE < totalCount}
              onRequestNextPage={() => setPage(p => p + 1)}
              onProductSaved={updated => {
                setProducts(prev =>
                  prev.map(p =>
                    p.id === updated.id ? { ...p, ...updated } : p
                  )
                );
              }}
              onAfterSave={() => {
                loadAggregates();
                loadChipCounts();
                loadIncompleteIds();
              }}
              // The queue's overflow menu IS the table's row menu — same
              // items, same handlers, passed down rather than rebuilt.
              rowMenuItems={renderRowMenuItems}
              onOpenInTable={p => {
                setMode("table");
                setSearchInput(p.sku || p.name);
              }}
            />
          ) : (
            <DataTable<Product>
              data={products}
              columns={columns}
              getRowId={p => p.id}
              loading={loading}
              emptyMessage={emptyState}
              // The table body scrolls, not the page — that's what pins the
              // column header. See DataTable's `fillHeight`.
              fillHeight={lockHeight}
              toolbarActions={tableToolbarActions}
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
              rowClassName={p =>
                flashRows.has(p.id)
                  ? "bg-emerald-50/70 transition-colors duration-500"
                  : "transition-colors duration-500"
              }
              rowContextMenu={p =>
                renderRowMenuItems(p, ContextMenuItem, ContextMenuSeparator)
              }
            />
          )}
        </div>
      </div>

      {/* Spacer for the fixed bulk bar above.
          It belongs AFTER the panes, not before them: the root is a flex
          column, so a spacer rendered above the two-pane row pushed the whole
          table down by the bar's height the moment a row was ticked — ~120px
          of dead space between the Fix chips and the table, which is exactly
          the gap the bar is supposed to be reserving at the BOTTOM. Here it
          shortens the panes instead, keeping the pagination footer clear.
          flex-shrink-0 because an empty div's automatic minimum is 0 in a
          flex column, and it would otherwise collapse to nothing. */}
      {selectionCount > 0 && (
        <div
          style={{ height: bulkBarHeight }}
          className="flex-shrink-0"
          aria-hidden="true"
        />
      )}

      {/* Side-panel editor */}
      <CatalogProductPanel
        product={panelProduct}
        open={!!panelProduct}
        categories={categories}
        priceMode={priceMode}
        onPriceModeChange={setPriceMode}
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
          {paletteQuery.trim() &&
            !paletteLoading &&
            paletteResults.length === 0 && (
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
                    <span className="text-xs font-mono text-slate-400">
                      {p.sku}
                    </span>
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
              selected product{selectionCount === 1 ? "" : "s"}. Marking N/A
              stops these from showing as “missing data”.
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
//
// `numeric` is deliberately NOT `type="number"`. A number input reports
// `value === ""` for anything the browser can't parse, so typing "abc" into a
// price cell arrived at commitEdit as blank — indistinguishable from a
// deliberately cleared field, which means "On Enquiry". The typo silently wiped
// a real price and commitEdit's isNaN guard could never fire. Plain text +
// inputMode="decimal" keeps the numeric keypad on mobile while letting the raw
// string reach commitEdit, where it can actually be rejected.
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
  return (
    <input
      // autoFocus lands before the browser paints. The previous
      // setTimeout(focus, 20) left the input mounted-but-unfocused for ~20ms,
      // so keystrokes in that window went to the document instead of the cell.
      autoFocus
      type="text"
      inputMode={numeric ? "decimal" : undefined}
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
