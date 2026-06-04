import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Edit2, Trash2, GripVertical, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { categoryService } from '@/lib/productService';
import { supabase, Category } from '@/lib/supabase';

const GROUP_PRESETS = [
  'Food Containers',
  'Tableware & Takeaway',
  'Food Packaging & Presentation',
  'Hygiene, Cleaning & Facility Care',
  'Decoration & Party',
];

async function uploadCategoryImage(file: File, categoryId: string): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${categoryId}-${Date.now()}.${fileExt}`;
  const filePath = `categories/${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from('category-images')
    .upload(filePath, file);
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('category-images').getPublicUrl(filePath);
  return data.publicUrl;
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    group_name: '',
    group_name_custom: '',
    group_order: '',
    image_url: '',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const cats = await categoryService.getAll();
      setCategories(cats);
    } catch (error) {
      toast.error('Failed to load categories');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) =>
    name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');

  const resolvedGroupName = () => {
    if (formData.group_name === '__custom__') return formData.group_name_custom.trim();
    return formData.group_name === '__none__' ? '' : formData.group_name;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.slug) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const group = resolvedGroupName();
      const categoryData: Partial<Category> = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        group_name: group || null,
        group_order: formData.group_order ? parseInt(formData.group_order) : null,
        image_url: formData.image_url || null,
      };

      if (editingId) {
        await categoryService.update(editingId, categoryData);
        toast.success('Category updated');
      } else {
        await categoryService.create(categoryData as any);
        toast.success('Category created');
      }

      resetForm();
      setIsOpen(false);
      loadCategories();
    } catch (error) {
      toast.error('Failed to save category');
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will affect all products in this category.')) return;
    try {
      await categoryService.delete(id);
      toast.success('Category deleted');
      loadCategories();
    } catch (error) {
      toast.error('Failed to delete category');
      console.error(error);
    }
  };

  const handleEdit = (category: Category) => {
    const isPreset = GROUP_PRESETS.includes(category.group_name || '');
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      group_name: category.group_name
        ? isPreset ? category.group_name : '__custom__'
        : '__none__',
      group_name_custom: !isPreset ? (category.group_name || '') : '',
      group_order: category.group_order?.toString() || '',
      image_url: category.image_url || '',
    });
    setEditingId(category.id);
    setIsOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      group_name: '',
      group_name_custom: '',
      group_order: '',
      image_url: '',
    });
    setEditingId(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const tempId = editingId || `new-${Date.now()}`;
    setUploading(true);
    try {
      const url = await uploadCategoryImage(file, tempId);
      setFormData(f => ({ ...f, image_url: url }));
      toast.success('Image uploaded');
    } catch (err) {
      toast.error('Failed to upload image');
      console.error(err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;

    const draggedIndex = categories.findIndex(c => c.id === draggedId);
    const targetIndex = categories.findIndex(c => c.id === targetId);

    const newCategories = [...categories];
    [newCategories[draggedIndex], newCategories[targetIndex]] = [
      newCategories[targetIndex],
      newCategories[draggedIndex],
    ];

    setCategories(newCategories);
    setDraggedId(null);

    try {
      for (let i = 0; i < newCategories.length; i++) {
        await categoryService.update(newCategories[i].id, { display_order: i } as any);
      }
      toast.success('Order updated');
    } catch (error) {
      toast.error('Failed to update order');
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Categories</h2>
          <p className="text-slate-600 text-sm mt-1">{categories.length} categories</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsOpen(true); }} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Category' : 'Add New Category'}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Category Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData({ ...formData, name, slug: generateSlug(name) });
                  }}
                  placeholder="e.g., Round Container"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="e.g., round-container"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Category description..."
                />
              </div>

              {/* Group */}
              <div className="space-y-2">
                <Label htmlFor="group_name">Group</Label>
                <Select
                  value={formData.group_name || '__none__'}
                  onValueChange={(v) => setFormData({ ...formData, group_name: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No group</SelectItem>
                    {GROUP_PRESETS.map(g => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                    <SelectItem value="__custom__">Custom…</SelectItem>
                  </SelectContent>
                </Select>
                {formData.group_name === '__custom__' && (
                  <Input
                    placeholder="Enter group name"
                    value={formData.group_name_custom}
                    onChange={(e) => setFormData({ ...formData, group_name_custom: e.target.value })}
                  />
                )}
              </div>

              {/* Group Order */}
              <div className="space-y-2">
                <Label htmlFor="group_order">Group Order <span className="text-slate-400 font-normal">(lower = first)</span></Label>
                <Input
                  id="group_order"
                  type="number"
                  min="0"
                  value={formData.group_order}
                  onChange={(e) => setFormData({ ...formData, group_order: e.target.value })}
                  placeholder="e.g., 1"
                />
              </div>

              {/* Image URL + Upload */}
              <div className="space-y-2">
                <Label htmlFor="image_url">Category Image URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="image_url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="https://… or upload below"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => imageInputRef.current?.click()}
                    className="shrink-0 gap-1"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Upload
                  </Button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
                {formData.image_url && (
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded border"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>

              <div className="flex gap-3 justify-end border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button type="submit">{editingId ? 'Update' : 'Create'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading...</div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No categories</div>
        ) : (
          categories.map(category => (
            <Card
              key={category.id}
              draggable
              onDragStart={() => handleDragStart(category.id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(category.id)}
              className={`p-4 cursor-move transition ${draggedId === category.id ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start gap-3">
                <GripVertical className="w-5 h-5 text-slate-400 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {category.image_url ? (
                      <img
                        src={category.image_url}
                        alt={category.name}
                        className="w-10 h-10 object-cover rounded flex-shrink-0"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : category.icon_emoji ? (
                      <span className="text-2xl">{category.icon_emoji}</span>
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{category.name}</h3>
                      <p className="text-xs text-slate-500">{category.slug}</p>
                    </div>
                  </div>
                  {category.group_name && (
                    <p className="text-xs text-red-600 font-medium mt-1">{category.group_name}</p>
                  )}
                  {category.description && (
                    <p className="text-sm text-slate-600 mt-1">{category.description}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t">
                <button
                  onClick={() => handleEdit(category)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 text-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(category.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 hover:bg-red-50 rounded text-slate-600 hover:text-red-600 text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
