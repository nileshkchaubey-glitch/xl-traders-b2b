import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus, Edit2, Trash2, Search, X, Star, Copy, Loader2,
  ChevronLeft, ChevronRight, ImageIcon, Zap, Images, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { productService, categoryService, storageService, productImageService } from '@/lib/productService';
import { generateDescription } from '@/lib/aiService';
import { autoResizeImage, batchAutoResize, formatBytes } from '@/lib/imageUtils';
import { Product, Category } from '@/lib/supabase';
import AdminImageGallery from '@/components/admin/AdminImageGallery';

const PAGE_SIZE = 50;
const UNITS = ['pcs', 'box', 'pack', 'roll', 'kg', 'litre', 'set'];

type StatusFilter = 'all' | 'active' | 'inactive' | 'featured';

interface AdminGetAllResult { data: Product[]; count: number; }

async function adminGetAllProducts(
  page: number, search: string, categoryId: string, status: StatusFilter,
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

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
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

  // Quick-add row
  const [quickAdd, setQuickAdd] = useState<QuickAdd>(QUICK_ADD_DEFAULTS);
  const [quickAdding, setQuickAdding] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const quickNameRef = useRef<HTMLInputElement>(null);

  // Full dialog (for images, description, AI)
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '', category_id: '', description: '', price: '', mrp: '',
    unit_of_measure: 'pcs', quantity_in_unit: '', discount_percent: '0',
    brand: '', is_active: true, is_featured: false,
  });
  const [images, setImages] = useState<File[]>([]);
  const [imageMetadata, setImageMetadata] = useState<Array<{ altText: string; description: string }>>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [autoResize, setAutoResize] = useState(true);

  // Image gallery
  const [galleryProduct, setGalleryProduct] = useState<Product | null>(null);

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
      const result = await adminGetAllProducts(page, debouncedSearch, selectedCategory, status);
      setProducts(result.data);
      setTotalCount(result.count);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, selectedCategory, status]);

  const loadCategories = useCallback(async () => {
    const cats = await categoryService.getAll();
    setCategories(cats);
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  useEffect(() => {
    return () => { imagePreviews.forEach((url) => URL.revokeObjectURL(url)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const saveCellEdit = async () => {
    if (!cellEdit || cellSaving) return;
    const { productId, field, value } = cellEdit;
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    // Validate
    if (field === 'price') {
      const n = parseFloat(value);
      if (isNaN(n) || n < 0) { toast.error('Invalid price'); return; }
    }
    if (field === 'mrp') {
      if (value && isNaN(parseFloat(value))) { toast.error('Invalid MRP'); return; }
    }
    if (field === 'quantity_in_unit') {
      if (value && (isNaN(parseInt(value)) || parseInt(value) <= 0)) { toast.error('Invalid quantity'); return; }
    }

    // No change?
    const currentVal = String((product as any)[field] ?? '');
    if (value.trim() === currentVal.trim()) { setCellEdit(null); return; }

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
    } catch { toast.error('Failed to save'); }
    finally { setCellSaving(false); }
  };

  const startCellEdit = (productId: string, field: string, value: string | number | null | undefined) => {
    setCellEdit({ productId, field, value: String(value ?? '') });
  };

  const cancelCellEdit = () => setCellEdit(null);

  const handleCellKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveCellEdit();
    if (e.key === 'Escape') cancelCellEdit();
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
      await productService.create({
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
      setQuickAdd(QUICK_ADD_DEFAULTS);
      quickNameRef.current?.focus();
      loadProducts();
    } catch { toast.error('Failed to add product'); }
    finally { setQuickAdding(false); }
  };

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

  // ── Full dialog (images + description) ─────────────────────────────────────
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (files.length + images.length > 5) { toast.error('Maximum 5 images allowed'); return; }
    e.target.value = '';
    if (autoResize) {
      setIsResizing(true);
      try {
        const results = await batchAutoResize(files);
        const newFiles = results.map((r) => r.file);
        const savings = results.reduce((acc, r) => acc + (r.originalSize - r.newSize), 0);
        if (savings > 1024) toast.success(`Auto-resized · saved ${formatBytes(savings)}`);
        setImages((prev) => [...prev, ...newFiles]);
        setImagePreviews((prev) => [...prev, ...newFiles.map((f) => URL.createObjectURL(f))]);
        setImageMetadata((prev) => [...prev, ...newFiles.map(() => ({ altText: '', description: '' }))]);
      } finally { setIsResizing(false); }
    } else {
      setImages((prev) => [...prev, ...files]);
      setImagePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
      setImageMetadata((prev) => [...prev, ...files.map(() => ({ altText: '', description: '' }))]);
    }
  };

  const removeImage = (index: number) => {
    if (imagePreviews[index]) URL.revokeObjectURL(imagePreviews[index]);
    setImages(images.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
    setImageMetadata(imageMetadata.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setFormData({ name: '', category_id: '', description: '', price: '', mrp: '', unit_of_measure: 'pcs', quantity_in_unit: '', discount_percent: '0', brand: '', is_active: true, is_featured: false });
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setImages([]); setImageMetadata([]); setImagePreviews([]); setExistingImageUrl(null); setEditingId(null);
  };

  const handleOpenFullEdit = (product: Product) => {
    setFormData({
      name: product.name,
      category_id: product.category_id,
      description: product.description || '',
      price: (product.price ?? 0).toString(),
      mrp: product.mrp?.toString() || '',
      unit_of_measure: product.unit_of_measure || 'pcs',
      quantity_in_unit: product.quantity_in_unit?.toString() || '',
      discount_percent: (product.discount_percent || 0).toString(),
      brand: product.brand || '',
      is_active: product.is_active,
      is_featured: product.is_featured || false,
    });
    setEditingId(product.id);
    setImages([]); setImageMetadata([]); setImagePreviews([]);
    setExistingImageUrl(product.image_url || null);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category_id || !formData.price) { toast.error('Name, category and price are required'); return; }
    setIsSaving(true);
    try {
      const productData: any = {
        name: formData.name, category_id: formData.category_id,
        description: formData.description, price: parseFloat(formData.price),
        mrp: formData.mrp ? parseFloat(formData.mrp) : undefined,
        unit_of_measure: formData.unit_of_measure,
        quantity_in_unit: formData.quantity_in_unit ? parseInt(formData.quantity_in_unit) : undefined,
        discount_percent: parseInt(formData.discount_percent),
        brand: formData.brand || undefined,
        is_active: formData.is_active, is_featured: formData.is_featured,
        image_alt_text: imageMetadata[0]?.altText || formData.name,
        image_description: imageMetadata[0]?.description || '',
      };
      let product: Product;
      if (editingId) {
        product = await productService.update(editingId, productData);
      } else {
        product = await productService.create(productData);
      }
      if (images.length > 0) {
        const uploadedUrls: string[] = [];
        for (let i = 0; i < images.length; i++) {
          try {
            const imageUrl = await storageService.uploadProductImage(images[i], product.id);
            if (!imageUrl) continue;
            uploadedUrls.push(imageUrl);
            await productImageService.create({
              product_id: product.id, image_url: imageUrl,
              alt_text: imageMetadata[i]?.altText || formData.name,
              description: imageMetadata[i]?.description || '',
              display_order: i,
            });
          } catch { toast.error(`Failed to upload image ${i + 1}`); }
        }
        if (uploadedUrls.length > 0) await productService.update(product.id, { image_url: uploadedUrls[0] });
      }
      toast.success(editingId ? 'Product updated' : 'Product created');
      resetForm(); setIsOpen(false); loadProducts();
    } catch { toast.error('Failed to save product'); }
    finally { setIsSaving(false); }
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Products</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {totalCount.toLocaleString()} total · page {page} of {Math.max(totalPages, 1)}
            <span className="ml-3 text-xs text-slate-400">Click any cell to edit inline</span>
          </p>
        </div>
        <Button
          onClick={() => { setShowQuickAdd((v) => !v); }}
          className="gap-2 shrink-0"
          variant={showQuickAdd ? 'outline' : 'default'}
        >
          {showQuickAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showQuickAdd ? 'Cancel quick-add' : 'Quick Add'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[180px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All catalogues" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All catalogues</SelectItem>
            {categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v as StatusFilter); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="featured">Featured ⭐</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <span className="text-sm font-semibold text-red-800">{selected.size} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => bulkActivate(true)}>Activate</Button>
          <Button size="sm" variant="outline" onClick={() => bulkActivate(false)}>Deactivate</Button>
          <Button size="sm" variant="destructive" onClick={bulkDelete}>Delete</Button>
          <button onClick={() => setSelected(new Set())} className="ml-1 p-1 hover:bg-red-100 rounded">
            <X className="w-4 h-4 text-red-600" />
          </button>
        </div>
      )}

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="w-10 px-3 py-3">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </th>
                <th className="w-14 px-2 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Img</th>
                <th className="px-2 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Name</th>
                <th className="w-36 px-2 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Category</th>
                <th className="w-28 px-2 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Price ₹</th>
                <th className="w-24 px-2 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">MRP ₹</th>
                <th className="w-20 px-2 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Unit</th>
                <th className="w-20 px-2 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Qty</th>
                <th className="w-28 px-2 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Brand</th>
                <th className="w-28 px-2 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Group</th>
                <th className="w-22 px-2 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                <th className="w-28 px-2 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Actions</th>
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
                  {/* Category */}
                  <td className="px-2 py-2">
                    <Select value={quickAdd.category_id || undefined} onValueChange={(v) => setQuickAdd({ ...quickAdd, category_id: v })}>
                      <SelectTrigger className="h-8 text-sm w-full border-green-300">
                        <SelectValue placeholder="Category *" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
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
                  {/* Group placeholder */}
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
                  <td colSpan={12} className="text-center py-12 text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading products…
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-slate-400">No products found</td>
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
                          src={product.image_url}
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
                  {/* Group */}
                  <td className="px-2 py-2">
                    <span className="text-xs text-slate-500">
                      {getCategoryGroup(product.category_id) ?? <span className="text-slate-300">—</span>}
                    </span>
                  </td>
                  {/* Status toggle */}
                  <td className="px-2 py-2">
                    <button
                      onClick={() => handleToggleActive(product.id, product.is_active)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                        product.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
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
      </Card>

      {/* Full Edit Dialog (description + images + AI) */}
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Full Edit — ' + (formData.name || 'Product') : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="name">Product Name *</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., 50ml Attach Lid Container" />
            </div>
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={formData.category_id || undefined} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Price (₹) *</Label>
                <Input type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>MRP (₹)</Label>
                <Input type="number" step="0.01" value={formData.mrp} onChange={(e) => setFormData({ ...formData, mrp: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Discount %</Label>
                <Input type="number" min="0" max="100" value={formData.discount_percent} onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={formData.unit_of_measure} onValueChange={(v) => setFormData({ ...formData, unit_of_measure: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Pack Size</Label>
                <Input type="number" min="1" value={formData.quantity_in_unit} onChange={(e) => setFormData({ ...formData, quantity_in_unit: e.target.value })} placeholder="e.g. 100" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Input value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} placeholder="e.g. Oshine, Biopack" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Description</Label>
                <button
                  type="button"
                  disabled={isGenerating || !formData.name}
                  onClick={async () => {
                    const catName = categories.find((c) => c.id === formData.category_id)?.name || '';
                    setIsGenerating(true);
                    try {
                      const text = await generateDescription(formData.name, catName);
                      setFormData((f) => ({ ...f, description: text }));
                    } catch (err: any) {
                      toast.error(err?.message || 'Failed to generate');
                    } finally { setIsGenerating(false); }
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-40"
                >
                  {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>✨</span>}
                  AI Generate
                </button>
              </div>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Product description…" rows={3} />
            </div>
            {/* Images */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Images <span className="text-slate-400 font-normal">(up to 5)</span></Label>
                <button
                  type="button"
                  onClick={() => setAutoResize((v) => !v)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg border transition-colors ${autoResize ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                >
                  <Zap className="w-3 h-3" />Auto-resize {autoResize ? 'ON' : 'OFF'}
                </button>
              </div>
              {editingId && existingImageUrl && images.length === 0 && (
                <div className="flex items-center gap-3 p-2 border rounded-lg bg-slate-50">
                  <img src={existingImageUrl} alt="Current" className="w-14 h-14 object-contain rounded bg-white border" />
                  <span className="text-sm text-slate-600">Current image. Upload new to replace.</span>
                </div>
              )}
              <input
                type="file" multiple accept="image/*"
                onChange={handleImageSelect} disabled={isResizing}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-600 hover:file:bg-red-100 disabled:opacity-50"
              />
              {isResizing && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" />Resizing…</div>}
              {images.length > 0 && (
                <div className="space-y-2 mt-1">
                  {images.map((img, idx) => (
                    <div key={idx} className="border rounded-lg p-3 space-y-2 bg-slate-50 flex items-center gap-3">
                      {imagePreviews[idx] && <img src={imagePreviews[idx]} alt={img.name} className="w-14 h-14 object-contain rounded bg-white border flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{img.name}</p>
                        <p className="text-xs text-slate-400">{formatBytes(img.size)}</p>
                        <Input className="mt-1 h-7 text-xs" placeholder="Alt text (SEO)" value={imageMetadata[idx]?.altText || ''} onChange={(e) => { const m = [...imageMetadata]; m[idx].altText = e.target.value; setImageMetadata(m); }} />
                      </div>
                      <button type="button" onClick={() => removeImage(idx)} className="text-slate-400 hover:text-red-600 flex-shrink-0"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-6 border-t pt-4">
              <div className="flex items-center gap-3">
                <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={formData.is_featured} onCheckedChange={(v) => setFormData({ ...formData, is_featured: v })} />
                <Label>Featured</Label>
              </div>
            </div>
            <div className="flex gap-3 justify-end border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : editingId ? 'Update Product' : 'Create Product'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Image Gallery */}
      <AdminImageGallery
        product={galleryProduct}
        open={!!galleryProduct}
        onClose={() => setGalleryProduct(null)}
        onPrimaryChanged={(productId, newUrl) => {
          setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, image_url: newUrl } : p));
        }}
      />
    </div>
  );
}
