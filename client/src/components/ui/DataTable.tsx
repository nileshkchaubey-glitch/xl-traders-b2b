import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ColumnSizingState,
  type Column,
  type RowData,
} from "@tanstack/react-table";
import { useSearch, useLocation } from "wouter";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Columns3,
  Search as SearchIcon,
  Rows2,
  Rows3,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

// ─────────────────────────────────────────────────────────────────────────────
// Shared <DataTable> — the single admin table primitive (docs/DESIGN_SYSTEM.md).
// Headless foundation on @tanstack/react-table; styling is Phase A tokens only.
//
// Phase 1 features: per-column sort, column hide/show, multi-select, sticky
// header, sticky first column(s), search hook, server-side (.range()) pagination,
// save-layout to URL params (no localStorage), loading skeleton, density toggle.
// Cell editing + keyboard nav stay in the consumer via cell render props +
// `containerProps` (so the Catalog Editor keeps its inline edit / arrow-key nav).
// ─────────────────────────────────────────────────────────────────────────────

export type DataTableDensity = "compact" | "comfortable";

// Per-column extras, declared on `columnDef.meta`. Augments TanStack's
// ColumnMeta so consumers get typed `meta: { sticky: true, … }` with no casts.
// All fields optional, so this never breaks other react-table consumers.
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Pin this column to the left (after the selection checkbox). */
    sticky?: boolean;
    /**
     * Pin this column to the right edge (e.g. Status, row actions) — mirror
     * of `sticky`. Multiple stickyRight columns stack right-to-left in
     * column order, so the last one sits flush against the edge.
     */
    stickyRight?: boolean;
    /** Show in the Columns menu. Defaults to true; false = always visible. */
    hideable?: boolean;
    /** Hidden by default when there is no saved layout in the URL. */
    defaultHidden?: boolean;
    /** Extra classes on each body cell (string or per-row). */
    cellClassName?: string | ((row: TData) => string);
    headerClassName?: string;
    align?: "left" | "center" | "right";
    /** Label in the Columns menu (defaults to the header text). */
    toggleLabel?: string;
    /**
     * Absorbs leftover width when the visible columns' sizes sum to less
     * than the container (rather than leaving it as dead space to the
     * right). At most one column should set this — the first visible one
     * found wins. Falls back to distributing proportionally across all
     * non-sticky columns when none is marked.
     */
    flex?: boolean;
  }
}

// Sets a ref value regardless of whether it's a callback ref or a RefObject —
// lets DataTable measure the scroll container internally (for the fill-width
// calculation below) while still forwarding a consumer's own `containerRef`.
function setRef<T>(ref: React.Ref<T> | undefined, node: T | null) {
  if (!ref) return;
  if (typeof ref === "function") ref(node);
  else (ref as React.MutableRefObject<T | null>).current = node;
}

function colMeta<T>(col: Column<T, unknown>) {
  return col.columnDef.meta ?? {};
}

export interface DataTableSelection {
  isSelected: (id: string) => boolean;
  allPageSelected: boolean;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
}

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  getRowId: (row: T) => string;

  loading?: boolean;
  emptyMessage?: React.ReactNode;
  rowClassName?: (row: T) => string;

  /** Server-side (manual) sorting — DataTable only renders indicators. */
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;

  /** Selection is controlled by the consumer (supports select-all-matching). */
  selection?: DataTableSelection;

  /** Renders a search box in the toolbar when provided. */
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };

  /** Server-side pagination footer. */
  pagination?: DataTablePagination;

  /** Extra toolbar controls (right of search, left of Columns/Density). */
  toolbarActions?: React.ReactNode;

  /**
   * When provided, wraps each row in a right-click context menu — the render
   * prop returns the menu's contents (e.g. a list of <ContextMenuItem>s) for
   * that row. Right-click anywhere on the row opens it; DataTable itself
   * doesn't render a trigger button (a per-row "⋯" button is a consumer
   * concern, typically placed in one of the cell renderers, sharing the same
   * item list for touch/discoverability).
   */
  rowContextMenu?: (row: T) => React.ReactNode;

  /**
   * Save layout to the URL under this key (columns → `${key}Cols`, density →
   * `${key}Density`). Omit to keep layout in-memory only. Never localStorage.
   */
  persistKey?: string;
  /** Notified with the visible column ids (initial + on change). */
  onVisibleColumnsChange?: (visibleIds: string[]) => void;
  /** Notified with the current density (initial + on toggle) — lets a
   * consumer's cell renderers scale things like thumbnails to match. */
  onDensityChange?: (density: DataTableDensity) => void;
  defaultDensity?: DataTableDensity;

  /** Spread onto the scroll container (e.g. tabIndex/onKeyDown for grid nav). */
  containerProps?: React.HTMLAttributes<HTMLDivElement>;
  containerRef?: React.Ref<HTMLDivElement>;
}

// Background is added per use-site: body cells stay white, header cells share
// the quiet-gray header band (Dukaan-style), so it can't live in this constant.
const STICKY_CELL = "sticky z-20";

// Numbered-page window for the footer: always 1 and last, current ±1, "…" for
// gaps — e.g. page 7 of 20 → [1, …, 6, 7, 8, …, 20]. Small totals list fully.
function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...pages]
    .filter(n => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  loading,
  emptyMessage = "No rows.",
  rowClassName,
  sorting = [],
  onSortingChange,
  selection,
  search,
  pagination,
  toolbarActions,
  rowContextMenu,
  persistKey,
  onVisibleColumnsChange,
  onDensityChange,
  defaultDensity = "comfortable",
  containerProps,
  containerRef,
}: DataTableProps<T>) {
  const urlSearch = useSearch();
  const [, setLocation] = useLocation();
  const colsParam = persistKey ? `${persistKey}Cols` : undefined;
  const densityParam = persistKey ? `${persistKey}Density` : undefined;
  const sizingParam = persistKey ? `${persistKey}Sizing` : undefined;

  // Which columns are hideable (appear in the Columns menu).
  const hideableIds = useMemo(
    () =>
      columns
        .filter(c => c.id && c.meta?.hideable !== false)
        .map(c => c.id as string),
    [columns]
  );

  // ── Column visibility ───────────────────────────────────────────────────────
  // Seeded from the URL layout when present; otherwise from each column's
  // `meta.defaultHidden`.
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const raw = colsParam
      ? new URLSearchParams(urlSearch).get(colsParam)
      : null;
    const vis: VisibilityState = {};
    if (raw != null) {
      const shown = new Set(raw ? raw.split(",") : []);
      for (const c of columns) {
        if (c.id && c.meta?.hideable !== false) vis[c.id] = shown.has(c.id);
      }
    } else {
      for (const c of columns) {
        if (c.id && c.meta?.defaultHidden) vis[c.id] = false;
      }
    }
    return vis;
  });

  // ── Density (seeded from URL when persisted) ────────────────────────────────
  const [density, setDensity] = useState<DataTableDensity>(() => {
    if (!densityParam) return defaultDensity;
    const raw = new URLSearchParams(urlSearch).get(densityParam);
    return raw === "compact" || raw === "comfortable" ? raw : defaultDensity;
  });

  useEffect(() => {
    onDensityChange?.(density);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density]);

  // ── Column resize widths (seeded from URL when persisted) ──────────────────
  // Format: "colId:widthPx,colId:widthPx,…". Only columns the user has
  // actually dragged appear here — everything else falls back to its
  // columnDef default size.
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    if (!sizingParam) return {};
    const raw = new URLSearchParams(urlSearch).get(sizingParam);
    if (!raw) return {};
    const sizing: ColumnSizingState = {};
    for (const pair of raw.split(",")) {
      const [id, w] = pair.split(":");
      const n = Number(w);
      if (id && Number.isFinite(n) && n > 0) sizing[id] = n;
    }
    return sizing;
  });

  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { sorting, columnVisibility, columnSizing },
    onSortingChange: updater => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange?.(next);
    },
    onColumnVisibilityChange: updater => {
      setColumnVisibility(prev =>
        typeof updater === "function" ? updater(prev) : updater
      );
    },
    onColumnSizingChange: updater => {
      setColumnSizing(prev =>
        typeof updater === "function" ? updater(prev) : updater
      );
    },
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    defaultColumn: { size: 160, minSize: 60, maxSize: 800 },
    manualSorting: true,
    manualPagination: true,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
  });

  // Notify the consumer of the visible column ids (for e.g. keyboard nav).
  const visibleLeafIds = table
    .getVisibleLeafColumns()
    .map(c => c.id)
    .join(",");
  useEffect(() => {
    onVisibleColumnsChange?.(visibleLeafIds ? visibleLeafIds.split(",") : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleLeafIds]);

  // Sticky-left offsets: checkbox (40px) then each sticky data column in order.
  // Depends on columnSizing too — resizing an earlier sticky column shifts the
  // offset of every sticky column after it.
  const stickyLeft = useMemo(() => {
    const map: Record<string, number> = {};
    let running = selection ? 40 : 0;
    for (const col of table.getVisibleLeafColumns()) {
      if (colMeta(col).sticky) {
        map[col.id] = running;
        running += col.getSize();
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleLeafIds, selection, columnSizing]);

  // Sticky-right offsets: mirror of stickyLeft, walked from the right edge
  // inward. Only stickyRight columns accumulate into `running` — any regular
  // (scrolling) columns between two pinned ones don't affect the offset,
  // since position:sticky positions each pinned column relative to the
  // container's right edge regardless of what's between them in the DOM.
  const stickyRightOffsets = useMemo(() => {
    const map: Record<string, number> = {};
    let running = 0;
    const cols = table.getVisibleLeafColumns();
    for (let i = cols.length - 1; i >= 0; i--) {
      const col = cols[i];
      if (colMeta(col).stickyRight) {
        map[col.id] = running;
        running += col.getSize();
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleLeafIds, columnSizing]);

  // Drag-in-progress column id (if any) — gates URL persistence below so a
  // resize drag doesn't write to history on every pixel of movement.
  const resizingColumnId = table.getState().columnSizingInfo.isResizingColumn;

  // Persist layout → URL (merge so other params survive). No localStorage.
  useEffect(() => {
    if (!persistKey) return;
    if (resizingColumnId) return;
    const params = new URLSearchParams(window.location.search);
    if (colsParam) {
      const shown = hideableIds.filter(id => columnVisibility[id] !== false);
      params.set(colsParam, shown.join(","));
    }
    if (densityParam) params.set(densityParam, density);
    if (sizingParam) {
      const entries = Object.entries(columnSizing).filter(
        (e): e is [string, number] => typeof e[1] === "number"
      );
      if (entries.length) {
        params.set(
          sizingParam,
          entries.map(([id, w]) => `${id}:${Math.round(w)}`).join(",")
        );
      } else {
        params.delete(sizingParam);
      }
    }
    setLocation(`${window.location.pathname}?${params.toString()}`, {
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnVisibility, density, columnSizing, resizingColumnId]);

  // Comfortable targets a Shopify-like ~56-64px row (with a 40-44px thumbnail
  // in the Name cell, sized by the consumer via onDensityChange). The header
  // stays a bit shorter than data rows even in comfortable mode.
  const pad = density === "compact" ? "px-2 py-1.5" : "px-3.5 py-3";
  const headPad = density === "compact" ? "px-2 py-1.5" : "px-3.5 py-2.5";
  const visibleCount = table.getVisibleLeafColumns().length + (selection ? 1 : 0);

  const pageCount = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;

  // ── Fill-width: absorb leftover space instead of leaving it empty ──────────
  // table.getTotalSize() is the columns' natural (resized/default) width sum.
  // When the scroll container is wider than that, the difference used to sit
  // as dead space to the right of the table (min-w-full was removed in the
  // resize PR for the opposite reason — it silently ate INTO a drag). Instead,
  // measure the container and hand any extra pixels to one flexible column
  // (meta.flex, e.g. Description) so the table always fills the available
  // width; when columns genuinely need more room than the container has, nothing
  // changes here and the container's overflow-x-auto scrolls as before.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const visibleLeafColumns = table.getVisibleLeafColumns();
  const naturalTotal = table.getTotalSize() + (selection ? 40 : 0);
  const extraWidth = Math.max(0, containerWidth - naturalTotal);
  // True horizontal overflow (columns need more room than the container has)
  // — gates the sticky bottom scrollbar below. The +1 absorbs sub-pixel
  // ResizeObserver rounding so it doesn't flicker in at the exact boundary.
  const hasHorizontalOverflow = naturalTotal > containerWidth + 1;

  // ── Sticky bottom scrollbar ─────────────────────────────────────────────────
  // A 50-row table only exposes its native horizontal scrollbar at the very
  // bottom of the table — reaching a mid-scroll column meant scrolling the
  // whole page down first. This mirrors the real scrollbar in a thin bar
  // pinned to the bottom of the viewport (via position:sticky on a sibling of
  // the scroll container, so it's naturally bounded to the table's own
  // height — see the JSX below) and keeps scrollLeft in sync both ways.
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const syncingFrom = useRef<"main" | "bottom" | null>(null);
  const handleMainScroll = () => {
    if (syncingFrom.current === "bottom") {
      syncingFrom.current = null;
      return;
    }
    const bottom = bottomScrollRef.current;
    if (!wrapRef.current || !bottom) return;
    syncingFrom.current = "main";
    bottom.scrollLeft = wrapRef.current.scrollLeft;
  };
  const handleBottomScroll = () => {
    if (syncingFrom.current === "main") {
      syncingFrom.current = null;
      return;
    }
    const bottom = bottomScrollRef.current;
    if (!wrapRef.current || !bottom) return;
    syncingFrom.current = "bottom";
    wrapRef.current.scrollLeft = bottom.scrollLeft;
  };

  // Prefer a column the consumer marked meta.flex (Description, typically);
  // otherwise spread the extra proportionally across non-sticky columns so a
  // consumer that hasn't opted in still gets a filled-out table.
  // Once the user manually resizes the flex column, its dragged width must
  // win: extraWidth already includes that column's own base size, so keeping
  // it in the auto-fill would algebraically cancel the drag (the column
  // snaps back to the same on-screen width no matter where it's dropped).
  const flexColumnId = useMemo(
    () => {
      const id = visibleLeafColumns.find(c => colMeta(c).flex)?.id ?? null;
      return id && columnSizing[id] == null ? id : null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleLeafIds, columnSizing]
  );

  // Cap how far the flex column may auto-grow — on a very wide screen with
  // few other columns visible, handing it ALL the leftover space made it
  // balloon past readable width and crowd everything else out. 480px (or 40%
  // of the container on narrower screens, whichever is smaller) keeps it
  // proportionate; any leftover past the cap flows to the proportional
  // distribution below instead of being lost.
  const FLEX_MAX_PX = 480;
  const flexColumnBase = flexColumnId
    ? (visibleLeafColumns.find(c => c.id === flexColumnId)?.getSize() ?? 0)
    : 0;
  const flexCap = Math.max(
    flexColumnBase,
    Math.min(FLEX_MAX_PX, containerWidth * 0.4)
  );
  const flexGrowth = flexColumnId
    ? Math.min(extraWidth, flexCap - flexColumnBase)
    : 0;
  const leftoverWidth = extraWidth - flexGrowth;

  // Fixed-width utility columns (e.g. a row-actions icon cluster) opt out via
  // enableResizing: false — they shouldn't stretch to soak up leftover space
  // any more than a pinned column should. Manually-resized columns are
  // likewise excluded (same drag-cancellation as the flex column above), and
  // the flex column itself is excluded here since it already got its share
  // (capped) above — so any leftover past that cap goes only to columns the
  // user hasn't touched and that aren't pinned to either edge.
  const proportionalBase = useMemo(() => {
    return visibleLeafColumns
      .filter(
        c =>
          c.id !== flexColumnId &&
          !colMeta(c).sticky &&
          !colMeta(c).stickyRight &&
          c.getCanResize() &&
          columnSizing[c.id] == null
      )
      .reduce((sum, c) => sum + c.getSize(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleLeafIds, columnSizing, flexColumnId]);

  function fillWidth(
    columnId: string,
    base: number,
    sticky: boolean | undefined,
    stickyRight: boolean | undefined,
    canResize: boolean
  ) {
    if (extraWidth <= 0) return base;
    if (columnSizing[columnId] != null) return base;
    if (columnId === flexColumnId) return base + flexGrowth;
    if (leftoverWidth <= 0) return base;
    if (sticky || stickyRight || !canResize || proportionalBase <= 0) return base;
    return base + leftoverWidth * (base / proportionalBase);
  }

  return (
    <div className="space-y-2">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {search && (
          <div className="flex-1 min-w-[180px] relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              value={search.value}
              onChange={e => search.onChange(e.target.value)}
              placeholder={search.placeholder ?? "Search…"}
              className="pl-9 h-9 bg-slate-50 border-slate-200 text-sm"
            />
          </div>
        )}
        {!search && <div className="flex-1" />}
        {toolbarActions}

        {/* Density toggle */}
        <button
          onClick={() =>
            setDensity(d => (d === "compact" ? "comfortable" : "compact"))
          }
          title={density === "compact" ? "Comfortable rows" : "Compact rows"}
          className="inline-flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        >
          {density === "compact" ? (
            <Rows3 className="w-4 h-4" />
          ) : (
            <Rows2 className="w-4 h-4" />
          )}
        </button>

        {/* Columns menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              title="Columns"
              className="inline-flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              <Columns3 className="w-4 h-4" />
              <span className="hidden sm:inline">Columns</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs">Show columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllLeafColumns()
              .filter(c => colMeta(c).hideable !== false && c.id !== "__select__")
              .map(col => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  // Stay open across multiple toggles — picking several
                  // columns shouldn't mean reopening the menu after each
                  // click (and a raw <button> here previously meant a
                  // slightly-off click could dismiss the menu without
                  // registering the toggle at all).
                  onSelect={e => {
                    e.preventDefault();
                    col.toggleVisibility();
                  }}
                  className="text-sm text-slate-700"
                >
                  {colMeta(col).toggleLabel ??
                    (typeof col.columnDef.header === "string"
                      ? col.columnDef.header
                      : col.id)}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      {/* The relative wrapper is the sticky bottom scrollbar's containing
          block — its height equals the scroll container's height, so the bar
          sticks to the viewport bottom only while the table itself is still
          in view (see the bar below), the same way sticky columns/header
          bound themselves to this component rather than the whole page. */}
      <div className="relative">
        <div
          ref={node => {
            wrapRef.current = node;
            setRef(containerRef, node);
          }}
          {...containerProps}
          onScroll={e => {
            containerProps?.onScroll?.(e);
            handleMainScroll();
          }}
          className={`bg-white border border-slate-200 overflow-x-auto focus:outline-none ${
            hasHorizontalOverflow ? "rounded-t-xl border-b-0" : "rounded-xl"
          } ${containerProps?.className ?? ""}`}
        >
        {/* Width = max(natural column-size sum, container width) — never
            min-w-full (which let auto layout silently redistribute a dragged
            width away, see the resize PR) and never a bare sum either (which
            left dead space when the container is wider — see fillWidth
            above). Only scrolls when columns genuinely need more room than
            the container has. */}
        <table
          className="text-sm border-separate border-spacing-0"
          style={{ width: Math.max(naturalTotal, containerWidth) }}
        >
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr
                key={hg.id}
                className="text-left text-[11px] uppercase tracking-wide text-slate-400"
              >
                {selection && (
                  <th
                    className={`${STICKY_CELL} bg-slate-50 sticky top-0 z-30 w-10 ${headPad} border-b border-slate-200`}
                    style={{ left: 0 }}
                  >
                    <input
                      type="checkbox"
                      checked={selection.allPageSelected}
                      onChange={selection.onToggleAll}
                      className="align-middle accent-red-600"
                      aria-label="Select all on page"
                    />
                  </th>
                )}
                {hg.headers.map(header => {
                  const meta = colMeta(header.column);
                  const sticky = meta.sticky;
                  const stickyRight = meta.stickyRight;
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  const canResize = header.column.getCanResize();
                  const isResizing = header.column.getIsResizing();
                  return (
                    <th
                      key={header.id}
                      className={`${headPad} relative whitespace-nowrap border-b border-slate-200 sticky top-0 bg-slate-50 ${
                        sticky
                          ? `${STICKY_CELL} z-30 border-r border-r-slate-100`
                          : stickyRight
                            ? `${STICKY_CELL} z-30 border-l border-l-slate-100`
                            : "z-10"
                      } ${meta.align === "center" ? "text-center" : ""} ${meta.headerClassName ?? ""}`}
                      style={{
                        width: fillWidth(
                          header.column.id,
                          header.getSize(),
                          sticky,
                          stickyRight,
                          canResize
                        ),
                        ...(sticky ? { left: stickyLeft[header.column.id] } : {}),
                        ...(stickyRight
                          ? { right: stickyRightOffsets[header.column.id] }
                          : {}),
                      }}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 rounded"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {sorted === "asc" ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : sorted === "desc" ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronsUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
                      )}
                      {canResize && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onDoubleClick={() => header.column.resetSize()}
                          title="Drag to resize — double-click to reset"
                          className={`absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize touch-none select-none ${
                            isResizing ? "bg-red-400" : "hover:bg-slate-300"
                          }`}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, r) => (
                <tr key={r}>
                  {Array.from({ length: visibleCount }).map((__, c) => (
                    <td key={c} className={`${pad} border-b border-slate-100`}>
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleCount}
                  className="py-16 text-center text-sm text-slate-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => {
                const id = getRowId(row.original);
                const checked = selection?.isSelected(id) ?? false;
                const tr = (
                  <tr
                    key={rowContextMenu ? undefined : row.id}
                    className={`hover:bg-slate-50/60 align-middle group/row ${rowClassName?.(row.original) ?? ""}`}
                  >
                    {selection && (
                      <td
                        className={`${STICKY_CELL} bg-white group-hover/row:bg-slate-50 ${pad} border-b border-slate-100 ${checked ? "bg-red-50" : ""}`}
                        style={{ left: 0 }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => selection.onToggleRow(id)}
                          className="align-middle accent-red-600"
                          aria-label="Select row"
                        />
                      </td>
                    )}
                    {row.getVisibleCells().map(cell => {
                      const meta = colMeta(cell.column);
                      const sticky = meta.sticky;
                      const stickyRight = meta.stickyRight;
                      const extra =
                        typeof meta.cellClassName === "function"
                          ? meta.cellClassName(row.original)
                          : (meta.cellClassName ?? "");
                      return (
                        <td
                          key={cell.id}
                          className={`${pad} border-b border-slate-100 ${
                            sticky
                              ? `${STICKY_CELL} bg-white group-hover/row:bg-slate-50 border-r border-r-slate-100`
                              : stickyRight
                                ? `${STICKY_CELL} bg-white group-hover/row:bg-slate-50 border-l border-l-slate-100`
                                : ""
                          } ${meta.align === "center" ? "text-center" : ""} ${extra}`}
                          style={{
                            width: fillWidth(
                              cell.column.id,
                              cell.column.getSize(),
                              sticky,
                              stickyRight,
                              cell.column.getCanResize()
                            ),
                            ...(sticky ? { left: stickyLeft[cell.column.id] } : {}),
                            ...(stickyRight
                              ? { right: stickyRightOffsets[cell.column.id] }
                              : {}),
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
                if (!rowContextMenu) return tr;
                // asChild forwards ref + onContextMenu straight onto the <tr>
                // (no extra wrapping DOM node, so table layout stays valid).
                return (
                  <ContextMenu key={row.id}>
                    <ContextMenuTrigger asChild>{tr}</ContextMenuTrigger>
                    <ContextMenuContent className="w-52">
                      {rowContextMenu(row.original)}
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })
            )}
          </tbody>
        </table>
        </div>
        {hasHorizontalOverflow && (
          <div
            ref={bottomScrollRef}
            onScroll={handleBottomScroll}
            aria-hidden="true"
            className="sticky bottom-0 z-20 h-4 overflow-x-auto overflow-y-hidden rounded-b-xl border border-slate-200 bg-white"
          >
            <div style={{ width: Math.max(naturalTotal, containerWidth), height: 1 }} />
          </div>
        )}
      </div>

      {/* ── Pagination footer (Dukaan-style: results text left, Previous /
             numbered pages / Next right) — same pagination state, visual only. */}
      {pagination && pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
          <p className="text-sm text-slate-500">
            Viewing {(pagination.page - 1) * pagination.pageSize + 1}–
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
            {pagination.total.toLocaleString()} results
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))}
              disabled={pagination.page === 1}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            {pageNumbers(pagination.page, pageCount).map((n, i) =>
              n === "…" ? (
                <span key={`gap-${i}`} className="px-1.5 text-sm text-slate-400">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  onClick={() => pagination.onPageChange(n)}
                  aria-current={n === pagination.page ? "page" : undefined}
                  className={`min-w-[32px] px-2 py-1.5 rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${
                    n === pagination.page
                      ? "bg-red-600 text-white font-semibold"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {n}
                </button>
              )
            )}
            <button
              onClick={() =>
                pagination.onPageChange(Math.min(pageCount, pagination.page + 1))
              }
              disabled={pagination.page >= pageCount}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
