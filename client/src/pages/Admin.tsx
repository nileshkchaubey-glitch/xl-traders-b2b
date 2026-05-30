import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Plus, Edit2, Trash2, Upload, Eye, EyeOff } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuthStore } from '@/lib/authStore';
import { productService, categoryService, storageService } from '@/lib/productService';
import { Product, Category } from '@/lib/supabase';

export default function Admin() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isAdmin, isLoading } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    description: '',
    price: '',
    quantity_in_unit: '',
    unit_of_measure: 'pcs',
    sku: '',
    image_alt_text: '',
  });

  // Check auth
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      setLocation('/auth');
      return;
    }

    if (!isAdmin) {
      setLocation('/');
      return;
    }
  }, [isLoading, isAuthenticated, isAdmin, setLocation]);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [prods, cats] = await Promise.all([
          productService.getAll(),
          categoryService.getAll(),
        ]);
        setProducts(prods);
        setCategories(cats);
      } catch (error) {
        console.error('Error loading admin data:', error);
      } finally {
        setIsDataLoading(false);
      }
    };

    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const productData = {
        name: formData.name,
        category_id: formData.category_id,
        description: formData.description,
        price: parseFloat(formData.price),
        quantity_in_unit: parseInt(formData.quantity_in_unit),
        unit_of_measure: formData.unit_of_measure,
        sku: formData.sku,
        image_alt_text: formData.image_alt_text,
        is_active: true,
        is_featured: false,
        display_order: 0,
      };

      if (editingId) {
        await productService.update(editingId, productData);
      } else {
        await productService.create(productData);
      }

      // Reload products
      const updated = await productService.getAll();
      setProducts(updated);

      // Reset form
      setShowForm(false);
      setEditingId(null);
      setFormData({
        name: '',
        category_id: '',
        description: '',
        price: '',
        quantity_in_unit: '',
        unit_of_measure: 'pcs',
        sku: '',
        image_alt_text: '',
      });
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error saving product');
    }
  };

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      category_id: product.category_id,
      description: product.description || '',
      price: product.price.toString(),
      quantity_in_unit: product.quantity_in_unit?.toString() || '',
      unit_of_measure: product.unit_of_measure || 'pcs',
      sku: product.sku || '',
      image_alt_text: product.image_alt_text || '',
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      await productService.delete(id);
      setProducts(products.filter((p) => p.id !== id));
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error deleting product');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await productService.toggleActive(id, !isActive);
      const updated = await productService.getAll();
      setProducts(updated);
    } catch (error) {
      console.error('Error toggling product:', error);
    }
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    productId: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(productId);

    try {
      const imageUrl = await storageService.uploadProductImage(file, productId);
      await productService.update(productId, { image_url: imageUrl });

      const updated = await productService.getAll();
      setProducts(updated);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image');
    } finally {
      setUploadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 text-sm">Loading...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
            <button
              onClick={() => {
                setShowForm(!showForm);
                setEditingId(null);
                setFormData({
                  name: '',
                  category_id: '',
                  description: '',
                  price: '',
                  quantity_in_unit: '',
                  unit_of_measure: 'pcs',
                  sku: '',
                  image_alt_text: '',
                });
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition"
            >
              <Plus size={20} />
              Add Product
            </button>
          </div>

          {/* Form */}
          {showForm && (
            <div className="bg-white border border-slate-200 rounded-lg p-8 mb-8">
              <h2 className="text-xl font-bold text-slate-900 mb-6">
                {editingId ? 'Edit Product' : 'Add New Product'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Product Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Category
                    </label>
                    <select
                      value={formData.category_id}
                      onChange={(e) =>
                        setFormData({ ...formData, category_id: e.target.value })
                      }
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                    >
                      <option value="">Select Category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Price */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Price (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value })
                      }
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                    />
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Quantity
                    </label>
                    <input
                      type="number"
                      value={formData.quantity_in_unit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          quantity_in_unit: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                    />
                  </div>

                  {/* Unit */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Unit
                    </label>
                    <input
                      type="text"
                      value={formData.unit_of_measure}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          unit_of_measure: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                    />
                  </div>

                  {/* SKU */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      SKU
                    </label>
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) =>
                        setFormData({ ...formData, sku: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                  />
                </div>

                {/* Image Alt Text */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Image Alt Text
                  </label>
                  <input
                    type="text"
                    value={formData.image_alt_text}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        image_alt_text: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition"
                  >
                    {editingId ? 'Update Product' : 'Add Product'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold py-2 px-6 rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Products Table */}
          {isDataLoading ? (
            <p className="text-slate-500">Loading products...</p>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {products.map((product) => {
                      const category = categories.find(
                        (c) => c.id === product.category_id
                      );
                      return (
                        <tr key={product.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <div className="flex gap-3 items-center">
                              {product.image_url && (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-10 h-10 rounded object-cover"
                                />
                              )}
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {product.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {product.sku}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {category?.name}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-red-600">
                            ₹{product.price.toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() =>
                                handleToggleActive(product.id, product.is_active)
                              }
                              className={`text-xs font-semibold px-3 py-1 rounded flex items-center gap-1 ${
                                product.is_active
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {product.is_active ? (
                                <>
                                  <Eye size={14} /> Active
                                </>
                              ) : (
                                <>
                                  <EyeOff size={14} /> Inactive
                                </>
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <label className="cursor-pointer text-slate-600 hover:text-red-600 transition">
                                <Upload size={16} />
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) =>
                                    handleImageUpload(e, product.id)
                                  }
                                  disabled={uploadingId === product.id}
                                  className="hidden"
                                />
                              </label>
                              <button
                                onClick={() => handleEdit(product)}
                                className="text-slate-600 hover:text-red-600 transition"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(product.id)}
                                className="text-slate-600 hover:text-red-600 transition"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
