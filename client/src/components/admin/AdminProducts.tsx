import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit2, Trash2, Search, X, Star } from 'lucide-react';
import { toast } from 'sonner';
import { productService, categoryService, storageService, productImageService } from '@/lib/productService';
import { Product, Category } from '@/lib/supabase';

/**
 * Admin Products Component
 * 
 * Features:
 * - Add/Edit/Delete products
 * - Upload up to 5 images per product
 * - Inline price editing
 * - Quick active/inactive toggle
 * - Search and filter by category
 * - SEO fields: alt text, image description
 */
export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Form state
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

  // Revoke object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, cats] = await Promise.all([
        productService.getAll(),
        categoryService.getAll(),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (error) {
      toast.error('Failed to load products');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Paginate the filtered list so the table stays fast with hundreds of products.
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to the first page whenever the active filters change.
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedCategory]);

  // Handle form submission. When `addAnother` is true the dialog stays open and
  // only product-specific fields are cleared (category/unit/brand are kept) so
  // an admin can rapidly enter many products in the same category.
  const handleSubmit = async (e: React.FormEvent | React.MouseEvent, addAnother = false) => {
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

      // Upload images and persist them. The first uploaded image becomes the
      // product's primary image_url; all images are stored in product_images.
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
          } catch (error) {
            console.error(error);
            toast.error(`Failed to upload image ${i + 1}`);
          }
        }

        // Set the primary image on the product so it shows in cards/catalog.
        if (uploadedUrls.length > 0) {
          await productService.update(product.id, { image_url: uploadedUrls[0] });
        }
      }

      toast.success(editingId ? 'Product updated' : 'Product created');
      loadData();
      if (addAnother && !editingId) {
        // Keep the dialog open for the next entry; preserve category/unit/brand.
        resetForm(true);
        setTimeout(() => nameInputRef.current?.focus(), 0);
      } else {
        resetForm();
        setIsOpen(false);
      }
    } catch (error) {
      toast.error('Failed to save product');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      await productService.delete(id);
      toast.success('Product deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete product');
      console.error(error);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await productService.toggleActive(id, !isActive);
      loadData();
      toast.success(isActive ? 'Product deactivated' : 'Product activated');
    } catch (error) {
      toast.error('Failed to update product');
      console.error(error);
    }
  };

  const handleToggleFeatured = async (id: string, isFeatured: boolean) => {
    try {
      await productService.toggleFeatured(id, !isFeatured);
      loadData();
      toast.success(isFeatured ? 'Removed from featured' : 'Added to featured');
    } catch (error) {
      toast.error('Failed to update product');
      console.error(error);
    }
  };

  const handlePriceEdit = async (id: string, newPrice: string) => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Invalid price');
      return;
    }

    try {
      await productService.update(id, { price });
      setEditingPrice(null);
      loadData();
      toast.success('Price updated');
    } catch (error) {
      toast.error('Failed to update price');
      console.error(error);
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

  const resetForm = (keepCategory = false) => {
    setFormData((prev) => ({
      name: '',
      category_id: keepCategory ? prev.category_id : '',
      description: '',
      price: '',
      mrp: '',
      unit_of_measure: keepCategory ? prev.unit_of_measure : 'pcs',
      quantity_in_unit: '',
      discount_percent: '0',
      brand: keepCategory ? prev.brand : '',
      is_active: true,
      is_featured: false,
    }));
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setImages([]);
    setImageMetadata([]);
    setImagePreviews([]);
    setExistingImageUrl(null);
    setEditingId(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }
    setImages([...images, ...files]);
    setImagePreviews([...imagePreviews, ...files.map((f) => URL.createObjectURL(f))]);
    setImageMetadata([
      ...imageMetadata,
      ...files.map(() => ({ altText: '', description: '' })),
    ]);
    // Allow re-selecting the same file after removal
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    if (imagePreviews[index]) URL.revokeObjectURL(imagePreviews[index]);
    setImages(images.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
    setImageMetadata(imageMetadata.filter((_, i) => i !== index));
  };

  const getCategoryName = (id: string) => {
    return categories.find(c => c.id === id)?.name || 'Unknown';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Products</h2>
          <p className="text-slate-600 text-sm mt-1">{filteredProducts.length} products</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                resetForm();
                setIsOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Edit Product' : 'Add New Product'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Basic Info */}
              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  ref={nameInputRef}
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., 50ml Attach Lid Container"
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category_id || undefined} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (₹) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mrp">MRP (₹)</Label>
                  <Input
                    id="mrp"
                    type="number"
                    step="0.01"
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount">Discount %</Label>
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.discount_percent}
                    onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Unit + Pack quantity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit of Measure</Label>
                  <Select value={formData.unit_of_measure} onValueChange={(value) => setFormData({ ...formData, unit_of_measure: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pcs">Per Piece</SelectItem>
                      <SelectItem value="box">Per Box</SelectItem>
                      <SelectItem value="pack">Per Pack</SelectItem>
                      <SelectItem value="roll">Per Roll</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity_in_unit">Pack Size <span className="text-slate-400 font-normal">(qty per unit)</span></Label>
                  <Input
                    id="quantity_in_unit"
                    type="number"
                    min="1"
                    value={formData.quantity_in_unit}
                    onChange={(e) => setFormData({ ...formData, quantity_in_unit: e.target.value })}
                    placeholder="e.g., 100"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Product description..."
                  rows={3}
                />
              </div>

              {/* Brand */}
              <div className="space-y-2">
                <Label htmlFor="brand">Brand <span className="text-slate-400 font-normal">(optional)</span></Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="e.g., Oshine, Biopack, Fortune Plus"
                />
              </div>

              {/* Images */}
              <div className="space-y-2">
                <Label>Product Images (up to 5)</Label>

                {/* Current image (edit mode) */}
                {editingId && existingImageUrl && images.length === 0 && (
                  <div className="flex items-center gap-3 mb-2 p-2 border rounded-lg bg-slate-50">
                    <img
                      src={existingImageUrl}
                      alt="Current product"
                      className="w-16 h-16 object-contain rounded bg-white border"
                    />
                    <span className="text-sm text-slate-600">
                      Current image. Upload new images below to replace it.
                    </span>
                  </div>
                )}

                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="block w-full text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-red-50 file:text-red-600
                    hover:file:bg-red-100"
                />
                {images.length > 0 && (
                  <div className="space-y-2 mt-4">
                    {images.map((img, idx) => (
                      <div key={idx} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-3">
                          {imagePreviews[idx] && (
                            <img
                              src={imagePreviews[idx]}
                              alt={img.name}
                              className="w-16 h-16 object-contain rounded bg-slate-50 border flex-shrink-0"
                            />
                          )}
                          <span className="text-sm font-medium flex-1 truncate">
                            {img.name}
                            {idx === 0 && (
                              <span className="ml-2 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                PRIMARY
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="text-red-600 hover:text-red-700 flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <Input
                          placeholder="Alt text (SEO)"
                          value={imageMetadata[idx]?.altText || ''}
                          onChange={(e) => {
                            const newMetadata = [...imageMetadata];
                            newMetadata[idx].altText = e.target.value;
                            setImageMetadata(newMetadata);
                          }}
                        />
                        <Input
                          placeholder="Image description"
                          value={imageMetadata[idx]?.description || ''}
                          onChange={(e) => {
                            const newMetadata = [...imageMetadata];
                            newMetadata[idx].description = e.target.value;
                            setImageMetadata(newMetadata);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active + Featured Toggles */}
              <div className="flex flex-wrap items-center gap-6 border-t pt-4">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label>Active</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={formData.is_featured}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                  />
                  <Label>Featured <span className="text-slate-400 font-normal">(shows on homepage)</span></Label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end border-t pt-4">
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setIsOpen(false)} disabled={isSaving}>
                  Cancel
                </Button>
                {!editingId && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={(e) => handleSubmit(e, true)}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save & Add Another'}
                  </Button>
                )}
                <Button type="submit" className="w-full sm:w-auto" disabled={isSaving}>
                  {isSaving ? 'Saving...' : editingId ? 'Update Product' : 'Create Product'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No products found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts.map(product => (
                  <TableRow key={product.id}>
                    <TableCell>
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.image_alt_text}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-slate-200 rounded flex items-center justify-center text-xs text-slate-500">
                          No image
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {getCategoryName(product.category_id)}
                    </TableCell>
                    <TableCell>
                      {editingPrice === product.id ? (
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            defaultValue={product.price}
                            autoFocus
                            onBlur={(e) => handlePriceEdit(product.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handlePriceEdit(product.id, e.currentTarget.value);
                              }
                            }}
                            className="w-24"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingPrice(product.id)}
                          className="font-semibold text-red-600 hover:text-red-700 cursor-pointer"
                        >
                          ₹{(product.price ?? 0).toFixed(2)}
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleToggleActive(product.id, product.is_active)}
                        className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer ${
                          product.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {product.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleFeatured(product.id, product.is_featured)}
                          title={product.is_featured ? 'Remove from featured' : 'Add to featured'}
                          className={`p-2 rounded hover:bg-slate-100 ${
                            product.is_featured ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          <Star className="w-4 h-4" fill={product.is_featured ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          onClick={() => handleEdit(product)}
                          className="p-2 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-2 hover:bg-red-50 rounded text-slate-600 hover:text-red-600"
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
      </Card>

      {/* Pagination */}
      {!loading && filteredProducts.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-slate-600">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredProducts.length)} of{' '}
            {filteredProducts.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-slate-600 px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
