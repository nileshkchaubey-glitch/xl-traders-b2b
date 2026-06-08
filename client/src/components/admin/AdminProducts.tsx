import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus, Edit2, Trash2, Search, X, Star, Copy, Loader2,
  ChevronLeft, ChevronRight, ImageIcon, Zap, Images,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { productService, categoryService, storageService, productImageService } from '@/lib/productService';
import { generateDescription } from '@/lib/aiService';
import { autoResizeImage, batchAutoResize, formatBytes } from '@/lib/imageUtils';
import { Product, Category } from '@/lib/supabase';
import AdminImageGallery from '@/components/admin/AdminImageGallery';

const PAGE_SIZE = 50;

type StatusFilter = 'all' | 'active' | 'inactive' | 'featured';

interface AdminGetAllResult {
  data: Product[];
  count: number;
}

async function adminGetAllProducts(
  page: number,
  search: string,
  categoryId: string,
  status: StatusFilter,
): Promise<AdminGetAllResult> {
  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (search.trim()) {
    query = query.ilike('name', `%${search.trim()}%`);
  }
  if (categoryId !== 'all') {
    query = query.eq('category_id', categoryId);
  }
  if (status === 'active') query = query.eq('is_active', true);
  else if (status === 'inactive') query = query.eq('is_active', false);
  else if (status === 'featured') query = query.eq('is_featured', true);

  query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data as Product[]) ?? [], count: count ?? 0 };
}

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

  // Dialog
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);

  // Image gallery
  const [galleryProduct, setGalleryProduct] = useState<Product | null>(null);

  // Form
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    description: '',
    price: '',
    mrp: '',
    unit_of_measure: 'pcs',
    quantity_in_unit: '',
    discount_percent: '0',
    brand: '',
    is_active: true,
    is_featured: false,
  });
  const [images, setImages] = useState<File[]>([]);
  const [imageMetadata, setImageMetadata] = useState<Array<{ altText: string; description: string }>>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [autoResize, setAutoResize] = useState(true);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setSelected(new Set());
      const result = await adminGetAllProducts(page, debouncedSearch, selectedCategory, status);
      setProducts(result.data);
      setTotalCount(result.count);
    } catch (error) {
      toast.error('Failed to load products');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, selectedCategory, status]);

  const loadCategories = useCallback(async () => {
    const cats = await categoryService.getAll();
    setCategories(cats);
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Selection helpers ──────────────────────────────────────────────
  const allSelected = products.length > 0 && products.every((p) => selected.has(p.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p) => p.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Bulk actions ───────────────────────────────────────────────────
  const bulkActivate = async (activate: boolean) => {
    const ids = Array.from(selected);
    try {
      await Promise.all(ids.map((id) => productService.update(id, { is_active: activate })));
      toast.success(`${ids.length} products ${activate ? 'activated' : 'deactivated'}`);
      loadProducts();
    } catch {
      toast.error('Bulk update failed');
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (!confirm(`Delete ${ids.length} products? This cannot be undone.`)) return;
    try {
      await Promise.all(ids.map((id) => productService.delete(id)));
      toast.success(`${ids.length} products deleted`);
      loadProducts();
    } catch {
      toast.error('Bulk delete failed');
    }
  };

  // ── Image handling ─────────────────────────────────────────────────
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (files.length + images.length > 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }
    e.target.value = '';

    if (autoResize) {
      setIsResizing(true);
      try {
        const results = await batchAutoResize(files);
        const newFiles = results.map((r) => r.file);
        const savings = results.reduce((acc, r) => acc + (r.originalSize - r.newSize), 0);
        if (savings > 1024) {
          toast.success(`Auto-resized ${files.length} image${files.length > 1 ? 's' : ''} · saved ${formatBytes(savings)}`);
        }
        const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
        setImages((prev) => [...prev, ...newFiles]);
        setImagePreviews((prev) => [...prev, ...newPreviews]);
        setImageMetadata((prev) => [...prev, ...newFiles.map(() => ({ altText: '', description: '' }))]);
      } finally {
        setIsResizing(false);
      }
    } else {
      const newPreviews = files.map((f) => URL.createObjectURL(f));
      setImages((prev) => [...prev, ...files]);
      setImagePreviews((prev) => [...prev, ...newPreviews]);
      setImageMetadata((prev) => [...prev, ...files.map(() => ({ altText: '', description: '' }))]);
    }
  };

  const removeImage = (index: number) => {
    if (imagePreviews[index]) URL.revokeObjectURL(imagePreviews[index]);
    setImages(images.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
    setImageMetadata(imageMetadata.filter((_, i) => i !== index));
  };

  // ── CRUD ───────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category_id || !formData.price) {
      toast.error('Please fill in all required fields');
      return;
    }
    setIsSaving(true);
    try {
      const productData = {
        name: formData.name,
        category_id: formData.category_id,
        description: formData.description,
        price: parseFloat(formData.price),
        mrp: formData.mrp ? parseFloat(formData.mrp) : undefined,
        unit_of_measure: formData.unit_of_measure,
        quantity_in_unit: formData.quantity_in_unit ? parseInt(formData.quantity_in_unit) : undefined,
        discount_percent: parseInt(formData.discount_percent),
        brand: formData.brand || undefined,
        is_active: formData.is_active,
        is_featured: formData.is_featured,
        image_alt_text: imageMetadata[0]?.altText || formData.name,
        image_description: imageMetadata[0]?.description || '',
      };

      let product: Product;
      if (editingId) {
        product = await productService.update(editingId, productData);
      } else {
        product = await productService.create(productData as any);
      }

      if (images.length > 0) {
        const uploadedUrls: string[] = [];
        for (let i = 0; i < images.length; i++) {
          try {
            const imageUrl = await storageService.uploadProductImage(images[i], product.id);
            if (!imageUrl) continue;
            uploadedUrls.push(imageUrl);
            await productImageService.create({
              product_id: product.id,
              image_url: imageUrl,
              alt_text: imageMetadata[i]?.altText || formData.name,
              description: imageMetadata[i]?.description || '',
              display_order: i,
            });
          } catch {
            toast.error(`Failed to upload image ${i + 1}`);
          }
        }
        if (uploadedUrls.length > 0) {
          await productService.update(product.id, { image_url: uploadedUrls[0] });
        }
      }

      toast.success(editingId ? 'Product updated' : 'Product created');
      resetForm();
      setIsOpen(false);
      loadProducts();
    } catch (error) {
      toast.error('Failed to save product');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicate = async (product: Product) => {
    try {
      const { id, created_at, updated_at, sku, ...fields } = product;
      await productService.create({ ...fields, name: `${product.name} (Copy)`, sku: undefined, is_active: false } as any);
      toast.success('Product duplicated');
      loadProducts();
    } catch {
      toast.error('Failed to duplicate');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      await productService.delete(id);
      toast.success('Product deleted');
      loadProducts();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await productService.toggleActive(id, !isActive);
      loadProducts();
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleToggleFeatured = async (id: string, isFeatured: boolean) => {
    try {
      await productService.toggleFeatured(id, !isFeatured);
      loadProducts();
    } catch {
      toast.error('Failed to update');
    }
  };

  const handlePriceEdit = async (id: string, newPrice: string) => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) { toast.error('Invalid price'); return; }
    try {
      await productService.update(id, { price });
      setEditingPrice(null);
      loadProducts();
    } catch {
      toast.error('Failed to update price');
    }
  };

  const handleEdit = (product: Product) => {
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
    setImages([]);
    setImageMetadata([]);
    setImagePreviews([]);
    setExistingImageUrl(product.image_url || null);
    setIsOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', category_id: '', description: '', price: '', mrp: '', unit_of_measure: 'pcs', quantity_in_unit: '', discount_percent: '0', brand: '', is_active: true, is_featured: false });
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setImages([]);
    setImageMetadata([]);
    setImagePreviews([]);
    setExistingImageUrl(null);
    setEditingId(null);
  };

  const getCategoryName = (id: string) => categories.find((c) => c.id === id)?.name || '—';

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Products</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {totalCount.toLocaleString()} total · page {page} of {Math.max(totalPages, 1)}
          </p>
        </div>
        <Button
          onClick={() => { resetForm(); setIsOpen(true); }}
          className="gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </Button>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[180px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All catalogues" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All catalogues</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v as StatusFilter); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
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
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="w-14">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-36">Category</TableHead>
                <TableHead className="w-28">Price</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading products…
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                    No products found
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id} className={selected.has(product.id) ? 'bg-red-50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(product.id)}
                        onCheckedChange={() => toggleOne(product.id)}
                      />
                    </TableCell>
                    <TableCell>
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.image_alt_text || product.name}
                          className="w-12 h-12 object-cover rounded-lg border"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-slate-300" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-slate-900 line-clamp-2">{product.name}</p>
                      {product.brand && (
                        <p className="text-xs text-slate-400 mt-0.5">{product.brand}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {getCategoryName(product.category_id)}
                    </TableCell>
                    <TableCell>
                      {editingPrice === product.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          defaultValue={product.price}
                          autoFocus
                          className="w-24"
                          onBlur={(e) => handlePriceEdit(product.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handlePriceEdit(product.id, e.currentTarget.value);
                            if (e.key === 'Escape') setEditingPrice(null);
                          }}
                        />
                      ) : (
                        <button
                          onClick={() => setEditingPrice(product.id)}
                          className="font-semibold text-red-600 hover:underline text-sm"
                          title="Click to edit price"
                        >
                          ₹{(product.price ?? 0).toFixed(2)}
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleToggleActive(product.id, product.is_active)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                          product.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {product.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleFeatured(product.id, product.is_featured)}
                          title={product.is_featured ? 'Unfeature' : 'Feature'}
                          className={`p-1.5 rounded hover:bg-slate-100 transition-colors ${
                            product.is_featured ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500'
                          }`}
                        >
                          <Star className="w-4 h-4" fill={product.is_featured ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          onClick={() => setGalleryProduct(product)}
                          title="Manage images"
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-500"
                        >
                          <Images className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(product)}
                          title="Duplicate"
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-500"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(product)}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-500"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-sm text-slate-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </Button>
              <span className="text-sm font-medium text-slate-700 px-2">
                {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., 50ml Attach Lid Container"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={formData.category_id || undefined} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="price">Price (₹) *</Label>
                <Input id="price" type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mrp">MRP (₹)</Label>
                <Input id="mrp" type="number" step="0.01" value={formData.mrp} onChange={(e) => setFormData({ ...formData, mrp: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="discount">Discount %</Label>
                <Input id="discount" type="number" min="0" max="100" value={formData.discount_percent} onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value })} />
              </div>
            </div>

            {/* Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Unit of Measure</Label>
                <Select value={formData.unit_of_measure} onValueChange={(v) => setFormData({ ...formData, unit_of_measure: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">Per Piece</SelectItem>
                    <SelectItem value="box">Per Box</SelectItem>
                    <SelectItem value="pack">Per Pack</SelectItem>
                    <SelectItem value="roll">Per Roll</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qty">Pack Size <span className="text-slate-400 font-normal">(qty per unit)</span></Label>
                <Input id="qty" type="number" min="1" value={formData.quantity_in_unit} onChange={(e) => setFormData({ ...formData, quantity_in_unit: e.target.value })} placeholder="e.g. 100" />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="desc">Description</Label>
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
                    } finally {
                      setIsGenerating(false);
                    }
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-40"
                >
                  {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>✨</span>}
                  AI Generate
                </button>
              </div>
              <Textarea id="desc" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Product description…" rows={3} />
            </div>

            {/* Brand */}
            <div className="space-y-1.5">
              <Label htmlFor="brand">Brand <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Input id="brand" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} placeholder="e.g. Oshine, Biopack" />
            </div>

            {/* Images */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Product Images <span className="text-slate-400 font-normal">(up to 5)</span></Label>
                <button
                  type="button"
                  onClick={() => setAutoResize((v) => !v)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg border transition-colors ${
                    autoResize
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}
                  title="Toggle auto-resize to 800×800 JPEG"
                >
                  <Zap className="w-3 h-3" />
                  Auto-resize {autoResize ? 'ON' : 'OFF'}
                </button>
              </div>

              {autoResize && (
                <p className="text-xs text-slate-500 bg-slate-50 rounded px-3 py-1.5">
                  Images will be resized to max 800×800 px and compressed to JPEG automatically.
                </p>
              )}

              {editingId && existingImageUrl && images.length === 0 && (
                <div className="flex items-center gap-3 p-2 border rounded-lg bg-slate-50">
                  <img src={existingImageUrl} alt="Current" className="w-14 h-14 object-contain rounded bg-white border" />
                  <span className="text-sm text-slate-600">Current image. Upload new images to replace.</span>
                </div>
              )}

              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageSelect}
                disabled={isResizing}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0
                  file:text-sm file:font-semibold file:bg-red-50 file:text-red-600
                  hover:file:bg-red-100 disabled:opacity-50"
              />

              {isResizing && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Resizing images…
                </div>
              )}

              {images.length > 0 && (
                <div className="space-y-2 mt-2">
                  {images.map((img, idx) => (
                    <div key={idx} className="border rounded-lg p-3 space-y-2 bg-slate-50">
                      <div className="flex items-center gap-3">
                        {imagePreviews[idx] && (
                          <img src={imagePreviews[idx]} alt={img.name} className="w-14 h-14 object-contain rounded bg-white border flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{img.name}</p>
                          <p className="text-xs text-slate-400">{formatBytes(img.size)}</p>
                          {idx === 0 && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">PRIMARY</span>}
                        </div>
                        <button type="button" onClick={() => removeImage(idx)} className="text-slate-400 hover:text-red-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <Input placeholder="Alt text (SEO)" value={imageMetadata[idx]?.altText || ''} onChange={(e) => { const m = [...imageMetadata]; m[idx].altText = e.target.value; setImageMetadata(m); }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap gap-6 border-t pt-4">
              <div className="flex items-center gap-3">
                <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={formData.is_featured} onCheckedChange={(v) => setFormData({ ...formData, is_featured: v })} />
                <Label>Featured <span className="text-slate-400 font-normal">(shows on homepage)</span></Label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : editingId ? 'Update Product' : 'Create Product'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Image Gallery Dialog */}
      <AdminImageGallery
        product={galleryProduct}
        open={!!galleryProduct}
        onClose={() => setGalleryProduct(null)}
        onPrimaryChanged={(productId, newUrl) => {
          setProducts((prev) =>
            prev.map((p) => (p.id === productId ? { ...p, image_url: newUrl } : p)),
          );
        }}
      />
    </div>
  );
}
