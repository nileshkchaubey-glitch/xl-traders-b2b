import { useLocation } from "wouter";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import { productService } from "@/lib/productService";
import { Product } from "@/lib/supabase";
import {
  MISSING_FILTERS,
  ATTENTION_LABELS,
} from "@/lib/catalogHealth";
import ProductsTable, {
  ProductPatch,
} from "@/components/admin/products/ProductsTable";
import {
  useProductGrid,
  GridSortField,
} from "../hooks/useProductGrid";
import { useBulkSelection } from "../hooks/useBulkSelection";
import BulkActionBar from "../components/bulk/BulkActionBar";

const SORT_OPTIONS: { value: GridSortField; label: string }[] = [
  { value: "created_at", label: "Newest" },
  { value: "name", label: "Name" },
  { value: "price", label: "Price" },
];

export default function ProductGridPage() {
  const [, setLocation] = useLocation();
  const grid = useProductGrid();

  const bulk = useBulkSelection({
    pageIds: grid.products.map(p => p.id),
    totalCount: grid.totalCount,
    getMatchingIds: grid.getMatchingIds,
    onChanged: grid.reload,
  });

  const getCategoryName = (id: string) =>
    grid.categories.find(c => c.id === id)?.name || "—";

  const handleInlineUpdate = async (id: string, patch: ProductPatch) => {
    grid.setProducts(prev =>
      prev.map(p => (p.id === id ? { ...p, ...(patch as Partial<Product>) } : p))
    );
    try {
      await productService.update(id, patch as Partial<Product>);
    } catch {
      toast.error("Update failed");
      grid.reload();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      await productService.delete(id);
      grid.reload();
      toast.success("Product deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleDuplicate = async (product: Product) => {
    try {
      const { id, created_at, updated_at, sku, ...fields } = product;
      await productService.create({
        ...fields,
        name: `${product.name} (Copy)`,
        sku: undefined,
        is_active: false,
        status: "draft",
      } as any);
      toast.success("Product duplicated");
      grid.reload();
    } catch {
      toast.error("Failed to duplicate");
    }
  };

  const handlePublish = async (product: Product) => {
    try {
      await productService.publishProducts([product.id]);
      grid.setProducts(prev =>
        prev.map(p => (p.id === product.id ? { ...p, status: "published" } : p))
      );
      toast.success("Published to website");
    } catch {
      toast.error("Failed to publish");
    }
  };

  const handleToggleFeatured = async (id: string, isFeatured: boolean) => {
    try {
      await productService.toggleFeatured(id, !isFeatured);
      grid.setProducts(prev =>
        prev.map(p => (p.id === id ? { ...p, is_featured: !isFeatured } : p))
      );
    } catch {
      toast.error("Failed to update");
    }
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">Products</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
              {grid.totalCount.toLocaleString()}
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            Page {grid.page} of {grid.totalPages}
          </p>
        </div>
        <button
          onClick={() => grid.reload()}
          disabled={grid.loading}
          title="Reload"
          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${grid.loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Search by name…"
            value={grid.search}
            onChange={e => grid.setSearch(e.target.value)}
            className="pl-9 h-9 bg-slate-50 border-slate-200 text-sm"
          />
        </div>
        <Select value={grid.categoryId} onValueChange={grid.setCategoryId}>
          <SelectTrigger className="w-44 h-9 bg-slate-50 border-slate-200 text-sm">
            <SelectValue placeholder="All catalogues" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All catalogues</SelectItem>
            {grid.categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={grid.status} onValueChange={grid.setStatus}>
          <SelectTrigger className="w-36 h-9 bg-slate-50 border-slate-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="featured">Featured ⭐</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={grid.attention ?? "none"}
          onValueChange={v => grid.setAttention(v === "none" ? null : (v as any))}
        >
          <SelectTrigger
            className={`w-44 h-9 border-slate-200 text-sm ${grid.attention ? "bg-amber-50 border-amber-200 text-amber-800 font-semibold" : "bg-slate-50"}`}
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
        <Select
          value={grid.sortField}
          onValueChange={v => grid.setSort(v as GridSortField, grid.sortAscending)}
        >
          <SelectTrigger className="w-36 h-9 bg-slate-50 border-slate-200 text-sm">
            <ArrowUpDown className="w-3.5 h-3.5 mr-1 text-slate-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-sm"
          onClick={() => grid.setSort(grid.sortField, !grid.sortAscending)}
          title="Toggle sort direction"
        >
          {grid.sortAscending ? "Asc" : "Desc"}
        </Button>
      </div>

      {bulk.hasSelection && (
        <BulkActionBar
          categories={grid.categories}
          totalCount={grid.totalCount}
          selectionCount={bulk.selectionCount}
          selectAllMatching={bulk.selectAllMatching}
          canSelectAllMatching={bulk.canSelectAllMatching}
          busy={bulk.busy}
          onSelectAllMatching={() => bulk.setSelectAllMatching(true)}
          onClear={bulk.clear}
          actions={bulk.actions}
        />
      )}

      <ProductsTable
        products={grid.products}
        loading={grid.loading}
        getCategoryName={getCategoryName}
        selected={bulk.selected}
        onToggleRow={bulk.toggleRow}
        onToggleAll={bulk.toggleAllOnPage}
        allPageSelected={bulk.allPageSelected}
        onRowOpen={product => setLocation(`/admin-v2/products/${product.id}`)}
        onInlineUpdate={handleInlineUpdate}
        onEdit={product => setLocation(`/admin-v2/products/${product.id}`)}
        onManageImages={() => setLocation("/admin-v2/images")}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onTogglePublish={handlePublish}
        onToggleFeatured={handleToggleFeatured}
        onViewLive={product => window.open(`/product/${product.id}`, "_blank")}
      />

      {grid.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-500">
            Showing {(grid.page - 1) * grid.pageSize + 1}–
            {Math.min(grid.page * grid.pageSize, grid.totalCount)} of{" "}
            {grid.totalCount.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => grid.setPage(p => Math.max(1, p - 1))}
              disabled={grid.page === 1}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </Button>
            <span className="text-sm font-medium text-slate-700 px-2">
              {grid.page} / {grid.totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => grid.setPage(p => Math.min(grid.totalPages, p + 1))}
              disabled={grid.page >= grid.totalPages}
              className="gap-1"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
