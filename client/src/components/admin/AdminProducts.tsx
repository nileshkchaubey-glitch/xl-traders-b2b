import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus, Edit2, Trash2, Search, X, Star, Copy, Loader2,
  ChevronLeft, ChevronRight, ImageIcon, Zap, Images, Check, RefreshCw, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { productService } from '@/lib/productService';
import { normalizeImageUrl } from '@/lib/imageUtils';
import { Product, Category } from '@/lib/supabase';
import { productCompleteness, completenessColor, AttentionFilter, ATTENTION_LABELS } from '@/lib/catalogHealth';
import AdminImageGallery from '@/components/admin/AdminImageGallery';
import CategoryCombobox from '@/components/admin/CategoryCombobox';
import AISmartPasteDialog from '@/components/admin/AISmartPasteDialog';
import AdminImageLibrary from '@/components/admin/AdminImageLibrary';
import { ParsedProduct } from '@/lib/aiService';
import KeyboardShortcutsDialog from '@/components/admin/KeyboardShortcutsDialog';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

const PAGE_SIZE = 50;
const UNITS = ['pcs', 'box', 'pack', 'roll', 'kg', 'litre', 'set'];

type StatusFilter = 'all' | 'active' | 'inactive' | 'featured';

interface AdminGetAllResult { data: Product[]; count: number; }

async function adminGetAllProducts(
  page: number, search: string, categoryId: string, status: StatusFilter,
  attention: AttentionFilter = null,
): Promise<AdminGetAllResult> {
  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (search.trim()) query = query.ilike('name', `%${search.trim()}%`);
  if (categoryId !== 'all') query = query.eq('category_id', categoryId);
  if (status === 'active') query = query.eq('is_active', true);
  else if (status === 'inactive') query = query.eq('is_active', false);
  else if (status === 'featured') query = query.eq('is_featured', true);
  if (attention === 'no-image') query = query.or('image_url.is.null,image_url.eq.');
  else if (attention === 'no-price') query = query.or('price.is.null,price.eq.0');
  else if (attention === 'no-slug') query = query.or('slug.is.null,slug.eq.');
  query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data as Product[]) ?? [], count: count ?? 0 };
}

// ── Inline cell editor ────────────────────────────────────────────────────────
interface CellEditState {
  productId: string;
  field: string;
  value: string;
}

// ── Quick-add row state ───────────────────────────────────────────────────────
interface QuickAdd {
  name: string;
  category_id: string;
  price: string;
  mrp: string;
  unit_of_measure: string;
  quantity_in_unit: string;
  brand: string;
}

const QUICK_ADD_DEFAULTS: QuickAdd = {
  name: '', category_id: '', price: '', mrp: '', unit_of_measure: 'pcs', quantity_in_unit: '', brand: '',
};

interface AdminProductsProps {
  keyboardShortcutsEnabled?: boolean;
  // "Needs Attention" filter, set from the Overview tab's quick action queue.
  attentionFilter?: AttentionFilter;
  onAttentionChange?: (filter: AttentionFilter) => void;
  // Lifted to AdminDashboard so the Categories tab's changes appear here
  // without a reload.
  categories?: Category[];
}

export default function AdminProducts({
  keyboardShortcutsEnabled = true,
  attentionFilter = null,
  onAttentionChange,
  categories = [],
}: AdminProductsProps = {}) {
  const [, setLocation] = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters + pagination
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Inline cell editing
  const [cellEdit, setCellEdit] = useState<CellEditState | null>(null);
  const [cellSaving, setCellSaving] = useState(false);
  const cellInputRef = useRef<HTMLInputElement>(null);

  // Quick-add row — open by default for fast catalogue entry
  const [quickAdd, setQuickAdd] = useState<QuickAdd>(QUICK_ADD_DEFAULTS);
  const [quickAdding, setQuickAdding] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(true);
  const quickNameRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Image gallery
  const [galleryProduct, setGalleryProduct] = useState<Product | null>(null);

  // AI Smart Paste states
  const [smartPasteOpen, setSmartPasteOpen] = useState(false);

  // Autofill handler for AI Smart Paste
  const handleAutofill = (parsedData: ParsedProduct) => {
    let categoryId = '';
    if (parsedData.category_name) {
      const match = categories.find(
        (c) => c.name.toLowerCase() === parsedData.category_name!.toLowerCase()
      );
      if (match) {
        categoryId = match.id;
      }
    }

    const draft = {
      name: parsedData.name || '',
      category_id: categoryId || '',
      description: parsedData.description || '',
      price: parsedData.price != null ? parsedData.price.toString() : '',
      mrp: parsedData.mrp != null ? parsedData.mrp.toString() : '',
      unit_of_measure: parsedData.unit_of_measure || 'pcs',
      quantity_in_unit: parsedData.quantity_in_unit != null ? parsedData.quantity_in_unit.toString() : '',
      discount_percent: '0',
      brand: parsedData.brand || '',
      is_active: true,
      is_featured: false,
      sku: '',
      barcode: '',
      moq: '1',
      image_url: '',
    };

    sessionStorage.setItem('admin-product-draft:new', JSON.stringify(draft));
    setLocation('/admin/products/new');
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setSelected(new Set());
      const result = await adminGetAllProducts(page, debouncedSearch, selectedCategory, status, attentionFilter);
      setProducts(result.data);
      setTotalCount(result.count);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, selectedCategory, status, attentionFilter]);

  // One-time initial fetch. With forceMount the component never unmounts, so
  // switching tabs away and back must NOT re-hit Supabase — hasFetched guards
  // against that (and against React StrictMode's double-invoke on mount).
  const hasFetched = useRef(false);
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to filter / pagination changes only — skip the very first render so
  // we don't double-fetch alongside the initial load above. Tab switches don't
  // change these deps, so revisiting the tab serves cached data.
  const skipFilterEffect = useRef(true);
  const prevAttention = useRef(attentionFilter);
  useEffect(() => {
    if (skipFilterEffect.current) { skipFilterEffect.current = false; return; }
    if (prevAttention.current !== attentionFilter) {
      prevAttention.current = attentionFilter;
      // Jump back to page 1 on attention change; the page update re-runs this
      // effect, which then fetches.
      if (page !== 1) { setPage(1); return; }
    }
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, selectedCategory, status, attentionFilter]);

  // Focus cell input when editing starts
  useEffect(() => {
    if (cellEdit) setTimeout(() => cellInputRef.current?.focus(), 30);
  }, [cellEdit]);

  // Focus quick-add name when row opens
  useEffect(() => {
    if (showQuickAdd) setTimeout(() => quickNameRef.current?.focus(), 30);
  }, [showQuickAdd]);

  // ── Selection ───────────────────────────────────────────────────────────────
  const allSelected = products.length > 0 && products.every((p) => selected.has(p.id));
  const someSelected = selected.size > 0;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)));
  const toggleOne = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // ── Bulk actions ────────────────────────────────────────────────────────────
  const bulkActivate = async (activate: boolean) => {
    const ids = Array.from(selected);
    try {
      await Promise.all(ids.map((id) => productService.update(id, { is_active: activate })));
      toast.success(`${ids.length} products ${activate ? 'activated' : 'deactivated'}`);
      loadProducts();
    } catch { toast.error('Bulk update failed'); }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (!confirm(`Delete ${ids.length} products? This cannot be undone.`)) return;
    try {
      await Promise.all(ids.map((id) => productService.delete(id)));
      toast.success(`${ids.length} products deleted`);
      loadProducts();
    } catch { toast.error('Bulk delete failed'); }
  };

  // ── Inline cell save ────────────────────────────────────────────────────────
  // Returns false when the edit could not be saved (validation/network error)
  // so Tab navigation knows not to move on and discard the user's input.
  const saveCellEdit = async (): Promise<boolean> => {
    if (!cellEdit || cellSaving) return true;
    const { productId, field, value } = cellEdit;
    const product = products.find((p) => p.id === productId);
    if (!product) return true;

    // Validate
    if (field === 'price') {
      const n = parseFloat(value);
      if (isNaN(n) || n < 0) { toast.error('Invalid price'); return false; }
    }
    if (field === 'mrp') {
      if (value && isNaN(parseFloat(value))) { toast.error('Invalid MRP'); return false; }
    }
    if (field === 'quantity_in_unit') {
      if (value && (isNaN(parseInt(value)) || parseInt(value) <= 0)) { toast.error('Invalid quantity'); return false; }
    }

    // No change?
    const currentVal = String((product as any)[field] ?? '');
    if (value.trim() === currentVal.trim()) { setCellEdit(null); return true; }

    setCellSaving(true);
    try {
      const update: Record<string, any> = {};
      if (field === 'price') update.price = parseFloat(value);
      else if (field === 'mrp') update.mrp = value ? parseFloat(value) : null;
      else if (field === 'quantity_in_unit') update.quantity_in_unit = value ? parseInt(value) : null;
      else update[field] = value || null;

      await productService.update(productId, update);
      setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, ...update } : p));
      setCellEdit(null);
      return true;
    } catch { toast.error('Failed to save'); return false; }
    finally { setCellSaving(false); }
  };

  const startCellEdit = (productId: string, field: string, value: string | number | null | undefined) => {
    setCellEdit({ productId, field, value: String(value ?? '') });
  };

  const cancelCellEdit = () => setCellEdit(null);

  // Spreadsheet-style Tab navigation across inline-editable cells.
  const CELL_FIELDS = ['name', 'category_id', 'price', 'mrp', 'unit_of_measure', 'quantity_in_unit', 'brand'];

  const getAdjacentCell = (backward: boolean) => {
    if (!cellEdit) return null;
    const fieldIdx = CELL_FIELDS.indexOf(cellEdit.field);
    const rowIdx = products.findIndex((p) => p.id === cellEdit.productId);
    if (fieldIdx === -1 || rowIdx === -1) return null;
    let nextField = fieldIdx + (backward ? -1 : 1);
    let nextRow = rowIdx;
    if (nextField >= CELL_FIELDS.length) { nextField = 0; nextRow++; }
    if (nextField < 0) { nextField = CELL_FIELDS.length - 1; nextRow--; }
    if (nextRow < 0 || nextRow >= products.length) return null;
    const target = products[nextRow];
    const field = CELL_FIELDS[nextField];
    return { productId: target.id, field, value: (target as any)[field] as string | number | null | undefined };
  };

  const handleCellKey = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { saveCellEdit(); return; }
    if (e.key === 'Escape') { cancelCellEdit(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      // Resolve the target before saving — saveCellEdit clears cellEdit.
      const next = getAdjacentCell(e.shiftKey);
      const saved = await saveCellEdit();
      if (saved && next) startCellEdit(next.productId, next.field, next.value);
    }
  };

  // Category inline select
  const saveCategoryEdit = async (productId: string, newCategoryId: string) => {
    setCellSaving(true);
    try {
      await productService.update(productId, { category_id: newCategoryId });
      setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, category_id: newCategoryId } : p));
      setCellEdit(null);
    } catch { toast.error('Failed to save category'); }
    finally { setCellSaving(false); }
  };

  // Unit inline select
  const saveUnitEdit = async (productId: string, newUnit: string) => {
    setCellSaving(true);
    try {
      await productService.update(productId, { unit_of_measure: newUnit });
      setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, unit_of_measure: newUnit } : p));
      setCellEdit(null);
    } catch { toast.error('Failed to save unit'); }
    finally { setCellSaving(false); }
  };

  // ── Quick-add ───────────────────────────────────────────────────────────────
  const handleQuickAdd = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!quickAdd.name.trim()) { toast.error('Product name is required'); return; }
    if (!quickAdd.category_id) { toast.error('Please select a category'); return; }
    if (!quickAdd.price || isNaN(parseFloat(quickAdd.price))) { toast.error('Please enter a valid price'); return; }
    setQuickAdding(true);
    try {
      const sku = `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const created = await productService.create({
        name: quickAdd.name.trim(),
        category_id: quickAdd.category_id,
        price: parseFloat(quickAdd.price),
        mrp: quickAdd.mrp ? parseFloat(quickAdd.mrp) : undefined,
        unit_of_measure: quickAdd.unit_of_measure,
        quantity_in_unit: quickAdd.quantity_in_unit ? parseInt(quickAdd.quantity_in_unit) : undefined,
        brand: quickAdd.brand.trim() || undefined,
        is_active: true,
        is_featured: false,
        sku,
      } as any);
      toast.success(`"${quickAdd.name.trim()}" added`);
      // Keep category, unit, qty and brand for the next entry — bulk entry is
      // usually many products in the same category/brand. Reset the rest.
      setQuickAdd((q) => ({ ...q, name: '', price: '', mrp: '' }));
      // Optimistic insert instead of a full refetch: the new product sorts to
      // the top (created_at desc), so on page 1 with no active filters we can
      // just prepend it. Keeps rapid bulk entry flicker-free. Otherwise the
      // filtered view might not include it, so fall back to a refetch.
      const onCleanFirstPage =
        page === 1 && !debouncedSearch.trim() && selectedCategory === 'all'
        && status === 'all' && !attentionFilter;
      if (created && onCleanFirstPage) {
        setProducts((prev) => [created, ...prev].slice(0, PAGE_SIZE));
        setTotalCount((c) => c + 1);
      } else {
        loadProducts();
      }
      // Re-focus name for the next entry (after the disabled state clears)
      setTimeout(() => quickNameRef.current?.focus(), 50);
    } catch { toast.error('Failed to add product'); }
    finally { setQuickAdding(false); }
  };

  useKeyboardShortcuts({
    enabled: keyboardShortcutsEnabled,
    focusQuickAdd: () => {
      setShowQuickAdd(true);
      setTimeout(() => quickNameRef.current?.focus(), 0);
    },
    focusSearch: () => searchRef.current?.focus(),
    save: () => handleQuickAdd(),
    cancel: () => {
      if (shortcutsOpen) {
        setShortcutsOpen(false);
        return;
      }
      const hasQuickAddValues = Object.entries(quickAdd).some(([key, value]) => {
        if (key === 'unit_of_measure') return value !== QUICK_ADD_DEFAULTS.unit_of_measure;
        return value !== '';
      });
      if (hasQuickAddValues && !window.confirm('Discard the current quick-add entry?')) return;
      setQuickAdd(QUICK_ADD_DEFAULTS);
      quickNameRef.current?.blur();
    },
    showHelp: () => setShortcutsOpen(true),
  });

  // ── Toggle helpers ──────────────────────────────────────────────────────────
  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await productService.toggleActive(id, !isActive);
      setProducts((prev) => prev.map((p) => p.id === id ? { ...p, is_active: !isActive } : p));
    } catch { toast.error('Failed to update'); }
  };

  const handleToggleFeatured = async (id: string, isFeatured: boolean) => {
    try {
      await productService.toggleFeatured(id, !isFeatured);
      setProducts((prev) => prev.map((p) => p.id === id ? { ...p, is_featured: !isFeatured } : p));
    } catch { toast.error('Failed to update'); }
  };

  const handleDuplicate = async (product: Product) => {
    try {
      const { id, created_at, updated_at, sku, ...fields } = product;
      await productService.create({ ...fields, name: `${product.name} (Copy)`, sku: undefined, is_active: false } as any);
      toast.success('Product duplicated');
      loadProducts();
    } catch { toast.error('Failed to duplicate'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      await productService.delete(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setTotalCount((c) => c - 1);
      toast.success('Product deleted');
    } catch { toast.error('Failed to delete'); }
  };

  // Open the route editor for products that need images, descriptions, or
  // fields beyond the sticky quick-add row.
  const handleOpenFullAdd = () => {
    setLocation('/admin/products/new');
  };

  const handleOpenFullEdit = (product: Product) => {
    setLocation(`/admin/products/${product.id}`);
  };

  const getCategoryName = (id: string) => categories.find((c) => c.id === id)?.name || '—';
  const getCategoryGroup = (id: string) => categories.find((c) => c.id === id)?.group_name || null;

  // ── Inline cell renderer ────────────────────────────────────────────────────
  const isEditing = (productId: string, field: string) =>
    cellEdit?.productId === productId && cellEdit?.field === field;

  const renderTextCell = (product: Product, field: keyof Product, placeholder = '—', cls = '') => {
    if (isEditing(product.id, field as string)) {
      return (
        <div className="flex items-center gap-1">
          <Input
            ref={cellInputRef}
            value={cellEdit!.value}
            onChange={(e) => setCellEdit({ ...cellEdit!, value: e.target.value })}
            onKeyDown={handleCellKey}
            onBlur={saveCellEdit}
            className={`h-8 text-sm min-w-[100px] ${cls}`}
            disabled={cellSaving}
          />
          {cellSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 flex-shrink-0" />}
        </div>
      );
    }
    const val = (product as any)[field];
    return (
      <button
        onClick={() => startCellEdit(product.id, field as string, val)}
        className={`text-left w-full hover:bg-slate-100 rounded px-1.5 py-0.5 text-sm transition-colors group ${cls}`}
        title="Click to edit"
      >
        {val || <span className="text-slate-300 italic">{placeholder}</span>}
        <span className="ml-1 opacity-0 group-hover:opacity-40 text-xs">✎</span>
      </button>
    );
  };

  const renderNumberCell = (product: Product, field: keyof Product, prefix = '', placeholder = '—') => {
    if (isEditing(product.id, field as string)) {
      return (
        <div className="flex items-center gap-1">
          <Input
            ref={cellInputRef}
            type="number"
            step="0.01"
            value={cellEdit!.value}
            onChange={(e) => setCellEdit({ ...cellEdit!, value: e.target.value })}
            onKeyDown={handleCellKey}
            onBlur={saveCellEdit}
            className="h-8 text-sm w-24"
            disabled={cellSaving}
          />
          {cellSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 flex-shrink-0" />}
        </div>
      );
    }
    const val = (product as any)[field];
    return (
      <button
        onClick={() => startCellEdit(product.id, field as string, val)}
        className="text-left hover:bg-slate-100 rounded px-1.5 py-0.5 transition-colors group font-semibold text-sm"
        title="Click to edit"
      >
        {val != null ? `${prefix}${Number(val).toLocaleString()}` : <span className="text-slate-300 italic font-normal">{placeholder}</span>}
        <span className="ml-1 opacity-0 group-hover:opacity-40 text-xs font-normal">✎</span>
      </button>
    );
  };

  const renderCategoryCell = (product: Product) => {
    if (isEditing(product.id, 'category_id')) {
      return (
        <Select
          value={product.category_id}
          onValueChange={(v) => saveCategoryEdit(product.id, v)}
          open
          onOpenChange={(open) => { if (!open) cancelCellEdit(); }}
        >
          <SelectTrigger className="h-8 text-sm w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return (
      <button
        onClick={() => startCellEdit(product.id, 'category_id', product.category_id)}
        className="text-left hover:bg-slate-100 rounded px-1.5 py-0.5 text-sm transition-colors group text-slate-600 w-full"
        title="Click to change category"
      >
        {getCategoryName(product.category_id)}
        <span className="ml-1 opacity-0 group-hover:opacity-40 text-xs">✎</span>
      </button>
    );
  };

  const renderUnitCell = (product: Product) => {
    if (isEditing(product.id, 'unit_of_measure')) {
      return (
        <Select
          value={product.unit_of_measure || 'pcs'}
          onValueChange={(v) => saveUnitEdit(product.id, v)}
          open
          onOpenChange={(open) => { if (!open) cancelCellEdit(); }}
        >
          <SelectTrigger className="h-8 text-sm w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    return (
      <button
        onClick={() => startCellEdit(product.id, 'unit_of_measure', product.unit_of_measure)}
        className="text-left hover:bg-slate-100 rounded px-1.5 py-0.5 text-sm transition-colors group text-slate-600"
        title="Click to change unit"
      >
        {product.unit_of_measure || 'pcs'}
        <span className="ml-1 opacity-0 group-hover:opacity-40 text-xs">✎</span>
      </button>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Products</h1>
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
              {totalCount.toLocaleString()}
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            Page {page} of {Math.max(totalPages, 1)} · click any cell to edit inline · Tab moves between fields
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => loadProducts()}
            disabled={loading}
            title="Reload"
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Button
            onClick={() => setSmartPasteOpen(true)}
            variant="outline"
            size="sm"
            className="gap-1.5 text-sm border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            <Sparkles className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            AI Smart Paste
          </Button>
          <Button
            onClick={() => setShowQuickAdd((v) => !v)}
            variant="outline"
            size="sm"
            className="gap-1.5 text-sm"
          >
            <Zap className="w-3.5 h-3.5" />
            {showQuickAdd ? 'Hide quick-add' : 'Quick Add'}
          </Button>
          <Button
            onClick={handleOpenFullAdd}
            size="sm"
            className="gap-1.5 text-sm bg-red-600 hover:bg-red-700 text-white border-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Product
          </Button>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            ref={searchRef}
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-slate-50 border-slate-200 text-sm"
          />
        </div>
        <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setPage(1); }}>
          <SelectTrigger className="w-44 h-9 bg-slate-50 border-slate-200 text-sm"><SelectValue placeholder="All catalogues" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All catalogues</SelectItem>
            {categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v as StatusFilter); setPage(1); }}>
          <SelectTrigger className="w-36 h-9 bg-slate-50 border-slate-200 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="featured">Featured ⭐</SelectItem>
          </SelectContent>
        </Select>
        {attentionFilter && (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 h-9 text-sm font-semibold">
            <span className="text-amber-500">●</span>
            {ATTENTION_LABELS[attentionFilter]}
            <button onClick={() => onAttentionChange?.(null)} className="ml-1 p-0.5 hover:bg-amber-100 rounded">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* ── Bulk action bar ───────────────────────────────────────────────────── */}
      {someSelected && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          <span className="text-sm font-semibold text-red-700">{selected.size} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => bulkActivate(true)} className="h-7 text-xs">Activate</Button>
          <Button size="sm" variant="outline" onClick={() => bulkActivate(false)} className="h-7 text-xs">Deactivate</Button>
          <Button size="sm" variant="destructive" onClick={bulkDelete} className="h-7 text-xs">Delete</Button>
          <button onClick={() => setSelected(new Set())} className="p-1 hover:bg-red-100 rounded text-red-500">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="w-10 px-3 py-3">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </th>
                <th className="w-14 px-2 py-3 text-left font-semibold text-slate-500 text-[11px] uppercase tracking-widest">Img</th>
                <th className="px-2 py-3 text-left font-semibold text-slate-500 text-[11px] uppercase tracking-widest">Name</th>
                <th className="w-36 px-2 py-3 text-left font-semibold text-slate-500 text-[11px] uppercase tracking-widest">Category</th>
                <th className="w-28 px-2 py-3 text-left font-semibold text-slate-500 text-[11px] uppercase tracking-widest">Price ₹</th>
                <th className="w-24 px-2 py-3 text-left font-semibold text-slate-500 text-[11px] uppercase tracking-widest">MRP ₹</th>
                <th className="w-20 px-2 py-3 text-left font-semibold text-slate-500 text-[11px] uppercase tracking-widest">Unit</th>
                <th className="w-20 px-2 py-3 text-left font-semibold text-slate-500 text-[11px] uppercase tracking-widest">Qty</th>
                <th className="w-28 px-2 py-3 text-left font-semibold text-slate-500 text-[11px] uppercase tracking-widest">Brand</th>
                <th className="w-24 px-2 py-3 text-left font-semibold text-slate-500 text-[11px] uppercase tracking-widest">SKU</th>
                <th className="w-28 px-2 py-3 text-left font-semibold text-slate-500 text-[11px] uppercase tracking-widest">Group</th>
                <th className="w-18 px-2 py-3 text-left font-semibold text-slate-500 text-[11px] uppercase tracking-widest" title="Completeness: image, price, category, slug, meta title">Score</th>
                <th className="w-22 px-2 py-3 text-left font-semibold text-slate-500 text-[11px] uppercase tracking-widest">Status</th>
                <th className="w-28 px-2 py-3 text-left font-semibold text-slate-500 text-[11px] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>

            <tbody>
              {/* ── Quick-add row ─────────────────────────────────────────── */}
              {showQuickAdd && (
                <tr className="bg-green-50 border-b-2 border-green-200">
                  <td className="px-3 py-2">
                    {quickAdding
                      ? <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                      : <Check className="w-4 h-4 text-green-400" />
                    }
                  </td>
                  {/* Image placeholder */}
                  <td className="px-2 py-2">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Plus className="w-4 h-4 text-green-400" />
                    </div>
                  </td>
                  {/* Name */}
                  <td className="px-2 py-2">
                    <Input
                      ref={quickNameRef}
                      value={quickAdd.name}
                      onChange={(e) => setQuickAdd({ ...quickAdd, name: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                      placeholder="Product name *"
                      className="h-8 text-sm border-green-300 focus:border-green-500"
                      disabled={quickAdding}
                    />
                  </td>
                  {/* Category — searchable combobox */}
                  <td className="px-2 py-2">
                    <CategoryCombobox
                      categories={categories}
                      value={quickAdd.category_id}
                      onChange={(v) => setQuickAdd({ ...quickAdd, category_id: v })}
                      placeholder="Category *"
                      className="h-8 text-sm border-green-300"
                    />
                  </td>
                  {/* Price */}
                  <td className="px-2 py-2">
                    <Input
                      type="number" step="0.01" min="0"
                      value={quickAdd.price}
                      onChange={(e) => setQuickAdd({ ...quickAdd, price: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                      placeholder="0.00 *"
                      className="h-8 text-sm border-green-300 w-24"
                      disabled={quickAdding}
                    />
                  </td>
                  {/* MRP */}
                  <td className="px-2 py-2">
                    <Input
                      type="number" step="0.01" min="0"
                      value={quickAdd.mrp}
                      onChange={(e) => setQuickAdd({ ...quickAdd, mrp: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                      placeholder="MRP"
                      className="h-8 text-sm border-green-300 w-24"
                      disabled={quickAdding}
                    />
                  </td>
                  {/* Unit */}
                  <td className="px-2 py-2">
                    <Select value={quickAdd.unit_of_measure} onValueChange={(v) => setQuickAdd({ ...quickAdd, unit_of_measure: v })}>
                      <SelectTrigger className="h-8 text-sm border-green-300 w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  {/* Qty */}
                  <td className="px-2 py-2">
                    <Input
                      type="number" min="1"
                      value={quickAdd.quantity_in_unit}
                      onChange={(e) => setQuickAdd({ ...quickAdd, quantity_in_unit: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                      placeholder="Qty"
                      className="h-8 text-sm border-green-300 w-16"
                      disabled={quickAdding}
                    />
                  </td>
                  {/* Brand */}
                  <td className="px-2 py-2">
                    <Input
                      value={quickAdd.brand}
                      onChange={(e) => setQuickAdd({ ...quickAdd, brand: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                      placeholder="Brand"
                      className="h-8 text-sm border-green-300 w-24"
                      disabled={quickAdding}
                    />
                  </td>
                  {/* SKU placeholder — auto-generated on save */}
                  <td className="px-2 py-2">
                    <span className="text-xs text-slate-400 italic">auto</span>
                  </td>
                  {/* Group placeholder */}
                  <td className="px-2 py-2" />
                  {/* Score placeholder */}
                  <td className="px-2 py-2" />
                  {/* Status placeholder */}
                  <td className="px-2 py-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Active</span>
                  </td>
                  {/* Save + cancel */}
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        onClick={() => handleQuickAdd()}
                        disabled={quickAdding}
                        className="h-8 px-3 bg-green-600 hover:bg-green-700 gap-1"
                      >
                        {quickAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Add
                      </Button>
                      <button
                        onClick={() => { setShowQuickAdd(false); setQuickAdd(QUICK_ADD_DEFAULTS); }}
                        className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* ── Products ──────────────────────────────────────────────── */}
              {loading ? (
                <tr>
                  <td colSpan={14} className="text-center py-12 text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading products…
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-12 text-slate-400">No products found</td>
                </tr>
              ) : products.map((product) => (
                <tr
                  key={product.id}
                  className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${selected.has(product.id) ? 'bg-red-50 hover:bg-red-50' : ''}`}
                >
                  <td className="px-3 py-2">
                    <Checkbox checked={selected.has(product.id)} onCheckedChange={() => toggleOne(product.id)} />
                  </td>
                  {/* Image — click to open gallery */}
                  <td className="px-2 py-2">
                    <button onClick={() => setGalleryProduct(product)} title="Manage images" className="block">
                      {product.image_url ? (
                        <img
                          src={normalizeImageUrl(product.image_url)}
                          alt={product.image_alt_text || product.name}
                          className="w-11 h-11 object-cover rounded-lg border hover:ring-2 ring-red-400 transition-all"
                        />
                      ) : (
                        <div className="w-11 h-11 bg-slate-100 rounded-lg flex items-center justify-center border border-dashed border-slate-300 hover:border-red-400 hover:bg-red-50 transition-colors">
                          <ImageIcon className="w-4 h-4 text-slate-300" />
                        </div>
                      )}
                    </button>
                  </td>
                  {/* Name */}
                  <td className="px-2 py-2 max-w-[200px]">
                    {renderTextCell(product, 'name', 'Enter name')}
                  </td>
                  {/* Category */}
                  <td className="px-2 py-2">
                    {renderCategoryCell(product)}
                  </td>
                  {/* Price */}
                  <td className="px-2 py-2">
                    {renderNumberCell(product, 'price', '₹')}
                  </td>
                  {/* MRP */}
                  <td className="px-2 py-2">
                    {renderNumberCell(product, 'mrp', '₹', '—')}
                  </td>
                  {/* Unit */}
                  <td className="px-2 py-2">
                    {renderUnitCell(product)}
                  </td>
                  {/* Qty */}
                  <td className="px-2 py-2">
                    {isEditing(product.id, 'quantity_in_unit') ? (
                      <div className="flex items-center gap-1">
                        <Input
                          ref={cellInputRef}
                          type="number" min="1"
                          value={cellEdit!.value}
                          onChange={(e) => setCellEdit({ ...cellEdit!, value: e.target.value })}
                          onKeyDown={handleCellKey}
                          onBlur={saveCellEdit}
                          className="h-8 text-sm w-16"
                          disabled={cellSaving}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => startCellEdit(product.id, 'quantity_in_unit', product.quantity_in_unit)}
                        className="text-left hover:bg-slate-100 rounded px-1.5 py-0.5 text-sm transition-colors group text-slate-600"
                      >
                        {product.quantity_in_unit || <span className="text-slate-300 italic">—</span>}
                        <span className="ml-1 opacity-0 group-hover:opacity-40 text-xs">✎</span>
                      </button>
                    )}
                  </td>
                  {/* Brand */}
                  <td className="px-2 py-2 max-w-[110px]">
                    {renderTextCell(product, 'brand', 'Brand')}
                  </td>
                  {/* SKU — read-only in table */}
                  <td className="px-2 py-2">
                    <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {product.sku || <span className="text-slate-300 italic font-sans">—</span>}
                    </span>
                  </td>
                  {/* Group */}
                  <td className="px-2 py-2">
                    <span className="text-xs text-slate-500">
                      {getCategoryGroup(product.category_id) ?? <span className="text-slate-300">—</span>}
                    </span>
                  </td>
                  {/* Completeness score */}
                  <td className="px-2 py-2">
                    {(() => {
                      const { score, missing } = productCompleteness(product);
                      return (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${completenessColor(score)}`}
                          title={missing.length ? `Missing: ${missing.join(', ')}` : 'Complete'}
                        >
                          {score}%
                        </span>
                      );
                    })()}
                  </td>
                  {/* Status toggle */}
                  <td className="px-2 py-2">
                    <button
                      onClick={() => handleToggleActive(product.id, product.is_active)}
                      title="Click to toggle"
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap border ${
                        product.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${product.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {product.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  {/* Actions */}
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleToggleFeatured(product.id, product.is_featured)}
                        title={product.is_featured ? 'Unfeature' : 'Feature'}
                        className={`p-1.5 rounded hover:bg-slate-100 transition-colors ${product.is_featured ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500'}`}
                      >
                        <Star className="w-3.5 h-3.5" fill={product.is_featured ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={() => handleOpenFullEdit(product)}
                        title="Full edit (description, images)"
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-500"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setGalleryProduct(product)}
                        title="Manage images"
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-500"
                      >
                        <Images className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(product)}
                        title="Duplicate"
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-500"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-sm text-slate-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="gap-1">
                <ChevronLeft className="w-4 h-4" />Prev
              </Button>
              <span className="text-sm font-medium text-slate-700 px-2">{page} / {totalPages}</span>
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="gap-1">
                Next<ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Image Gallery */}
      <AdminImageGallery
        product={galleryProduct}
        open={!!galleryProduct}
        onClose={() => setGalleryProduct(null)}
        onPrimaryChanged={(productId, newUrl) => {
          setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, image_url: newUrl } : p));
        }}
      />

      {/* AI Smart Paste Dialog */}
      <AISmartPasteDialog
        open={smartPasteOpen}
        onClose={() => setSmartPasteOpen(false)}
        categories={categories}
        onAutofill={handleAutofill}
      />

      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
