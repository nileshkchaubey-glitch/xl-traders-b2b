import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit2, Trash2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { productService, categoryService, storageService } from '@/lib/productService';
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
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    description: '',
    price: '',
    mrp: '',
    unit_of_measure: 'pcs',
    discount_percent: '0',
    is_active: true,
  });

  const [images, setImages] = useState<File[]>([]);
  const [imageMetadata, setImageMetadata] = useState<Array<{ altText: string; description: string }>>([]);

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
    const matchesCategory = !selectedCategory || p.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.category_id || !formData.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const productData = {
        name: formData.name,
        category_id: formData.category_id,
        description: formData.description,
        price: parseFloat(formData.price),
        mrp: formData.mrp ? parseFloat(formData.mrp) : undefined,
        unit_of_measure: formData.unit_of_measure,
        discount_percent: parseInt(formData.discount_percent),
        is_active: formData.is_active,
        image_alt_text: imageMetadata[0]?.altText || '',
        image_description: imageMetadata[0]?.description || '',
      };

      let product: Product;
      if (editingId) {
        product = await productService.update(editingId, productData);
      } else {
        product = await productService.create(productData as any);
      }

      // Upload images
      if (images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          try {
            const imageUrl = await storageService.uploadProductImage(images[i], product.id);
            // Image uploaded successfully
          } catch (error) {
            toast.error(`Failed to upload image ${i + 1}`);
          }
        }
      }

      toast.success(editingId ? 'Product updated' : 'Product created');
      resetForm();
      setIsOpen(false);
      loadData();
    } catch (error) {
      toast.error('Failed to save product');
      console.error(error);
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
      price: product.price.toString(),
      mrp: product.mrp?.toString() || '',
      unit_of_measure: product.unit_of_measure || 'pcs',
      discount_percent: (product.discount_percent || 0).toString(),
      is_active: product.is_active,
    });
    setEditingId(product.id);
    setImages([]);
    setImageMetadata([]);
    setIsOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category_id: '',
      description: '',
      price: '',
      mrp: '',
      unit_of_measure: 'pcs',
      discount_percent: '0',
      is_active: true,
    });
    setImages([]);
    setImageMetadata([]);
    setEditingId(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }
    setImages([...images, ...files]);
    setImageMetadata([
      ...imageMetadata,
      ...files.map(() => ({ altText: '', description: '' })),
    ]);
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
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
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., 50ml Attach Lid Container"
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
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

              {/* Unit */}
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

              {/* Images */}
              <div className="space-y-2">
                <Label>Product Images (up to 5)</Label>
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
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{img.name}</span>
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="text-red-600 hover:text-red-700"
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

              {/* Active Toggle */}
              <div className="flex items-center gap-3 border-t pt-4">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end border-t pt-4">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingId ? 'Update Product' : 'Create Product'}
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
            <SelectItem value="">All categories</SelectItem>
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
          <Table>
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
                filteredProducts.map(product => (
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
                          ₹{product.price.toFixed(2)}
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
    </div>
  );
}
