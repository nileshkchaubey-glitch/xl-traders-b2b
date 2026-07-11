import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type Column,
  type RowData,
} from "@tanstack/react-table";
import { useSearch, useLocation } from "wouter";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Columns3,
  Check,
  Search as SearchIcon,
  Rows2,
  Rows3,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  }
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
  emptyMessage?: string;
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
   * Save layout to the URL under this key (columns → `${key}Cols`, density →
   * `${key}Density`). Omit to keep layout in-memory only. Never localStorage.
   */
  persistKey?: string;
  /** Notified with the visible column ids (initial + on change). */
  onVisibleColumnsChange?: (visibleIds: string[]) => void;
  defaultDensity?: DataTableDensity;

  /** Spread onto the scroll container (e.g. tabIndex/onKeyDown for grid nav). */
  containerProps?: React.HTMLAttributes<HTMLDivElement>;
  containerRef?: React.Ref<HTMLDivElement>;
}

const STICKY_CELL = "sticky z-20 bg-white";

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
  persistKey,
  onVisibleColumnsChange,
  defaultDensity = "comfortable",
  containerProps,
  containerRef,
}: DataTableProps<T>) {
  const urlSearch = useSearch();
  const [, setLocation] = useLocation();
  const colsParam = persistKey ? `${persistKey}Cols` : undefined;
  const densityParam = persistKey ? `${persistKey}Density` : undefined;

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

  // Persist layout → URL (merge so other params survive). No localStorage.
  useEffect(() => {
    if (!persistKey) return;
    const params = new URLSearchParams(window.location.search);
    if (colsParam) {
      const shown = hideableIds.filter(id => columnVisibility[id] !== false);
      params.set(colsParam, shown.join(","));
    }
    if (densityParam) params.set(densityParam, density);
    setLocation(`${window.location.pathname}?${params.toString()}`, {
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnVisibility, density]);

  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { sorting, columnVisibility },
    onSortingChange: updater => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange?.(next);
    },
    onColumnVisibilityChange: updater => {
      setColumnVisibility(prev =>
        typeof updater === "function" ? updater(prev) : updater
      );
    },
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
  }, [visibleLeafIds, selection]);

  const pad = density === "compact" ? "px-2 py-1.5" : "px-3 py-2.5";
  const visibleCount = table.getVisibleLeafColumns().length + (selection ? 1 : 0);

  const pageCount = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;

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
          className="inline-flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors text-sm"
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
              className="inline-flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors text-sm"
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
                <button
                  key={col.id}
                  onClick={e => {
                    e.preventDefault();
                    col.toggleVisibility();
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-slate-100 text-slate-700"
                >
                  {colMeta(col).toggleLabel ??
                    (typeof col.columnDef.header === "string"
                      ? col.columnDef.header
                      : col.id)}
                  {col.getIsVisible() && (
                    <Check className="w-3.5 h-3.5 text-red-600" />
                  )}
                </button>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        {...containerProps}
        className={`bg-white border border-slate-200 rounded-xl overflow-x-auto focus:outline-none ${containerProps?.className ?? ""}`}
      >
        <table className="text-sm border-separate border-spacing-0 min-w-full">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr
                key={hg.id}
                className="text-left text-[11px] uppercase tracking-wide text-slate-400"
              >
                {selection && (
                  <th
                    className={`${STICKY_CELL} sticky top-0 z-30 w-10 ${pad} border-b border-slate-200`}
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
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={`${pad} whitespace-nowrap border-b border-slate-200 sticky top-0 ${
                        sticky ? `${STICKY_CELL} z-30 border-r` : "z-10 bg-white"
                      } ${meta.align === "center" ? "text-center" : ""} ${meta.headerClassName ?? ""}`}
                      style={sticky ? { left: stickyLeft[header.column.id] } : undefined}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-slate-700"
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
                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-slate-50/60 align-middle group/row ${rowClassName?.(row.original) ?? ""}`}
                  >
                    {selection && (
                      <td
                        className={`${STICKY_CELL} group-hover/row:bg-slate-50 ${pad} border-b border-slate-100 ${checked ? "bg-red-50" : ""}`}
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
                      const extra =
                        typeof meta.cellClassName === "function"
                          ? meta.cellClassName(row.original)
                          : (meta.cellClassName ?? "");
                      return (
                        <td
                          key={cell.id}
                          className={`${pad} border-b border-slate-100 ${
                            sticky
                              ? `${STICKY_CELL} group-hover/row:bg-slate-50 border-r`
                              : ""
                          } ${meta.align === "center" ? "text-center" : ""} ${extra}`}
                          style={sticky ? { left: stickyLeft[cell.column.id] } : undefined}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination footer ───────────────────────────────────────────────── */}
      {pagination && pageCount > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-500">
            Showing {(pagination.page - 1) * pagination.pageSize + 1}–
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
            {pagination.total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))}
              disabled={pagination.page === 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-white disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-sm font-medium text-slate-700 px-1">
              {pagination.page} / {pageCount}
            </span>
            <button
              onClick={() =>
                pagination.onPageChange(Math.min(pageCount, pagination.page + 1))
              }
              disabled={pagination.page >= pageCount}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-white disabled:opacity-40"
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
