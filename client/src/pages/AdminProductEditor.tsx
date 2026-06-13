import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { ChevronRight, Loader2, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import CategoryCombobox from '@/components/admin/CategoryCombobox';
import KeyboardShortcutsDialog from '@/components/admin/KeyboardShortcutsDialog';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAuthStore } from '@/lib/authStore';
import { generateDescription } from '@/lib/aiService';
import { batchAutoResize, formatBytes, normalizeImageUrl } from '@/lib/imageUtils';
import { categoryService, productImageService, productService, storageService } from '@/lib/productService';
import { Category, Product } from '@/lib/supabase';

const UNITS = ['pcs', 'box', 'pack', 'roll', 'kg', 'litre', 'set'];
const RETAINED_VALUES_KEY = 'admin-product-retained-values';
const EMPTY_FORM = {
  name: '', category_id: '', description: '', price: '', mrp: '',
  unit_of_measure: 'pcs', quantity_in_unit: '', discount_percent: '0',
  brand: '', is_active: true, is_featured: false,
  sku: '', barcode: '', moq: '1', image_url: '',
};

type ProductForm = typeof EMPTY_FORM;

export default function AdminProductEditor() {
  const params = useParams<{ id?: string }>();
  const productId = params.id;
  const isEditing = !!productId;
  const [, setLocation] = useLocation();
  const { isAuthenticated, isAdmin, isLoading, refreshProfile } = useAuthStore();
  const [accessChecked, setAccessChecked] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState<ProductForm>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<ProductForm>(EMPTY_FORM);
  const [images, setImages] = useState<File[]>([]);
  const [imageMetadata, setImageMetadata] = useState<Array<{ altText: string; description: string }>>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [autoResize, setAutoResize] = useState(true);
  const [dropHighlight, setDropHighlight] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const previewsRef = useRef<string[]>([]);

  const draftKey = `admin-product-draft:${productId ?? 'new'}`;
  const dirty = useMemo(
    () => JSON.stringify(formData) !== JSON.stringify(initialForm) || images.length > 0,
    [formData, images.length, initialForm],
  );

  const updateForm = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const goBack = useCallback(() => {
    if (dirty && !window.confirm('Discard your unsaved product changes?')) return;
    sessionStorage.removeItem(draftKey);
    sessionStorage.removeItem(RETAINED_VALUES_KEY);
    sessionStorage.setItem('admin-active-tab', 'products');
    setLocation('/admin');
  }, [dirty, draftKey, setLocation]);

  const save = useCallback(async (addAnother: boolean) => {
    if (isSaving) return;
    if (!formData.name.trim() || !formData.category_id || !formData.price) {
      toast.error('Name, category and price are required');
      return;
    }

    setIsSaving(true);
    try {
      const productData: any = {
        name: formData.name.trim(),
        category_id: formData.category_id,
        description: formData.description,
        price: parseFloat(formData.price),
        mrp: formData.mrp ? parseFloat(formData.mrp) : undefined,
        unit_of_measure: formData.unit_of_measure,
        quantity_in_unit: formData.quantity_in_unit ? parseInt(formData.quantity_in_unit) : undefined,
        discount_percent: parseInt(formData.discount_percent) || 0,
        brand: formData.brand.trim() || undefined,
        is_active: formData.is_active,
        is_featured: formData.is_featured,
        sku: formData.sku.trim() || undefined,
        barcode: formData.barcode.trim() || undefined,
        moq: formData.moq ? parseInt(formData.moq) : 1,
        image_alt_text: imageMetadata[0]?.altText || formData.name.trim(),
        image_description: imageMetadata[0]?.description || '',
      };
      const pastedUrl = normalizeImageUrl(formData.image_url);
      if (pastedUrl) productData.image_url = pastedUrl;
      if (!isEditing && !productData.sku) {
        productData.sku = `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      }

      let product: Product = isEditing
        ? await productService.update(productId!, productData)
        : await productService.create(productData);

      if (images.length) {
        const uploaded = await Promise.all(images.map(async (image, index) => {
          try {
            const url = await storageService.uploadProductImage(image, product.id);
            return url ? { url, index } : null;
          } catch {
            return null;
          }
        }));
        const successful = uploaded.filter((item): item is { url: string; index: number } => item !== null);
        const failedCount = images.length - successful.length;
        if (failedCount) toast.error(`${failedCount} image${failedCount > 1 ? 's' : ''} failed to upload`);
        if (successful.length) {
          await productImageService.createMany(successful.map(({ url, index }) => ({
            product_id: product.id,
            image_url: url,
            alt_text: imageMetadata[index]?.altText || formData.name.trim(),
            description: imageMetadata[index]?.description || '',
            display_order: index,
          })));
          product = await productService.update(product.id, { image_url: successful[0].url });
        }
      }

      sessionStorage.removeItem(draftKey);
      toast.success(isEditing ? 'Product updated' : 'Product created');

      if (addAnother) {
        const retained = {
          ...EMPTY_FORM,
          category_id: formData.category_id,
          brand: formData.brand,
          unit_of_measure: formData.unit_of_measure,
        };
        previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
        setImages([]);
        setImageMetadata([]);
        setImagePreviews([]);
        setExistingImageUrl(null);
        setFormData(retained);
        setInitialForm(retained);
        if (isEditing) {
          sessionStorage.setItem(RETAINED_VALUES_KEY, JSON.stringify(retained));
          setLocation('/admin/products/new');
        }
        setTimeout(() => nameRef.current?.focus(), 0);
      } else {
        sessionStorage.setItem('admin-active-tab', 'products');
        setLocation('/admin');
      }
    } catch {
      toast.error('Failed to save product');
    } finally {
      setIsSaving(false);
    }
  }, [draftKey, formData, imageMetadata, images, isEditing, isSaving, productId, setLocation]);

  const shortcutActions = useMemo(() => ({
    save: () => save(false),
    saveAndAddAnother: () => save(true),
    cancel: () => helpOpen ? setHelpOpen(false) : goBack(),
    showHelp: () => setHelpOpen(true),
  }), [goBack, helpOpen, save]);
  useKeyboardShortcuts(shortcutActions);

  useEffect(() => {
    let cancelled = false;
    async function verifyAccess() {
      if (isLoading) return;
      if (!isAuthenticated) {
        setLocation('/auth');
        return;
      }
      if (isAdmin) {
        setAccessChecked(true);
        return;
      }
      const admin = await refreshProfile();
      if (!cancelled) {
        if (admin) setAccessChecked(true);
        else setLocation('/');
      }
    }
    verifyAccess();
    return () => { cancelled = true; };
  }, [isAdmin, isAuthenticated, isLoading, refreshProfile, setLocation]);

  useEffect(() => {
    if (!isAuthenticated || !accessChecked) return;
    let cancelled = false;
    async function load() {
      const loadedCategories = await categoryService.getAll();
      if (!cancelled) setCategories(loadedCategories);

      let base = EMPTY_FORM;
      if (!productId) {
        const retainedValues = sessionStorage.getItem(RETAINED_VALUES_KEY);
        if (retainedValues) {
          try {
            base = { ...EMPTY_FORM, ...JSON.parse(retainedValues) };
          } catch {
            base = EMPTY_FORM;
          } finally {
            sessionStorage.removeItem(RETAINED_VALUES_KEY);
          }
        }
      }
      if (productId) {
        const product = await productService.getById(productId);
        if (!product) {
          toast.error('Product not found');
          setLocation('/admin');
          return;
        }
        base = {
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
          sku: product.sku || '',
          barcode: product.barcode || '',
          moq: (product.moq ?? 1).toString(),
          image_url: product.image_url || '',
        };
        if (!cancelled) setExistingImageUrl(product.image_url || null);
      }

      const savedDraft = sessionStorage.getItem(draftKey);
      let restored = base;
      if (savedDraft) {
        try {
          restored = { ...base, ...JSON.parse(savedDraft) };
          toast.info('Draft restored');
        } catch {
          sessionStorage.removeItem(draftKey);
        }
      }
      if (!cancelled) {
        setInitialForm(base);
        setFormData(restored);
        setLoadingProduct(false);
        setTimeout(() => nameRef.current?.focus(), 0);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [accessChecked, draftKey, isAuthenticated, productId, setLocation]);

  useEffect(() => {
    if (!loadingProduct && dirty) sessionStorage.setItem(draftKey, JSON.stringify(formData));
  }, [dirty, draftKey, formData, loadingProduct]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    previewsRef.current = imagePreviews;
  }, [imagePreviews]);

  useEffect(() => () => {
    previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const handleImageFiles = async (files: File[]) => {
    if (!files.length) return;
    if (files.length + images.length > 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }
    setIsResizing(autoResize);
    try {
      if (autoResize) {
        const results = await batchAutoResize(files);
        const savings = results.reduce((total, result) => total + result.originalSize - result.newSize, 0);
        if (savings > 1024) toast.success(`Auto-resized, saved ${formatBytes(savings)}`);
        const resized = results.map((result) => result.file);
        setImages((current) => [...current, ...resized]);
        setImagePreviews((current) => [...current, ...resized.map((file) => URL.createObjectURL(file))]);
      } else {
        setImages((current) => [...current, ...files]);
        setImagePreviews((current) => [...current, ...files.map((file) => URL.createObjectURL(file))]);
      }
      setImageMetadata((current) => [...current, ...files.map(() => ({ altText: '', description: '' }))]);
    } finally {
      setIsResizing(false);
    }
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setImagePreviews((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setImageMetadata((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  if (isLoading || loadingProduct || !isAuthenticated || !accessChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9]">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-slate-400">Catalogue</span>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <Link href="/admin" onClick={() => sessionStorage.setItem('admin-active-tab', 'products')} className="text-slate-500 hover:text-slate-900">
              Products
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span className="font-semibold text-slate-800">{isEditing ? formData.name || 'Edit Product' : 'New Product'}</span>
          </div>
          <Link href="/admin" onClick={(event) => {
            event.preventDefault();
            goBack();
          }} className="text-sm font-semibold text-red-600 hover:text-red-700">
            Back to Products
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{isEditing ? 'Edit Product' : 'New Product'}</h1>
          <p className="mt-1 text-sm text-slate-500">Complete the catalogue details, then save or keep entering products.</p>
        </div>

        <form ref={formRef} onSubmit={(event) => { event.preventDefault(); save(false); }} className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="product-name">Product Name *</Label>
              <Input ref={nameRef} id="product-name" value={formData.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="e.g., 50ml Attach Lid Container" />
            </div>
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <CategoryCombobox categories={categories} value={formData.category_id} onChange={(value) => updateForm('category_id', value)} placeholder="Select category" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5"><Label>Price (₹) *</Label><Input type="number" min="0" step="0.01" value={formData.price} onChange={(event) => updateForm('price', event.target.value)} /></div>
              <div className="space-y-1.5"><Label>MRP (₹)</Label><Input type="number" min="0" step="0.01" value={formData.mrp} onChange={(event) => updateForm('mrp', event.target.value)} /></div>
              <div className="space-y-1.5"><Label>Discount %</Label><Input type="number" min="0" max="100" value={formData.discount_percent} onChange={(event) => updateForm('discount_percent', event.target.value)} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={formData.unit_of_measure} onValueChange={(value) => updateForm('unit_of_measure', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Pack Size</Label><Input type="number" min="1" value={formData.quantity_in_unit} onChange={(event) => updateForm('quantity_in_unit', event.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>Brand</Label><Input value={formData.brand} onChange={(event) => updateForm('brand', event.target.value)} placeholder="e.g. Oshine, Biopack" /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5"><Label>SKU</Label><Input value={formData.sku} onChange={(event) => updateForm('sku', event.target.value)} className="font-mono text-sm" /></div>
              <div className="space-y-1.5"><Label>Barcode</Label><Input value={formData.barcode} onChange={(event) => updateForm('barcode', event.target.value)} className="font-mono text-sm" /></div>
              <div className="space-y-1.5"><Label>Min. Order Qty</Label><Input type="number" min="1" value={formData.moq} onChange={(event) => updateForm('moq', event.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Description</Label>
                <button type="button" disabled={isGenerating || !formData.name} onClick={async () => {
                  setIsGenerating(true);
                  try {
                    const categoryName = categories.find((category) => category.id === formData.category_id)?.name || '';
                    updateForm('description', await generateDescription(formData.name, categoryName));
                  } catch (error: any) {
                    toast.error(error?.message || 'Failed to generate');
                  } finally {
                    setIsGenerating(false);
                  }
                }} className="flex items-center gap-1 text-xs font-semibold text-red-600 disabled:opacity-40">
                  {isGenerating && <Loader2 className="w-3 h-3 animate-spin" />} AI Generate
                </button>
              </div>
              <Textarea value={formData.description} onChange={(event) => updateForm('description', event.target.value)} rows={5} />
            </div>
          </section>

          <section className={`rounded-xl border bg-white p-6 shadow-sm space-y-3 ${dropHighlight ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'}`}
            onDragEnter={(event) => { if (event.dataTransfer.types.includes('Files')) setDropHighlight(true); }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropHighlight(false); }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={async (event) => { event.preventDefault(); setDropHighlight(false); await handleImageFiles(Array.from(event.dataTransfer.files)); }}>
            <div className="flex items-center justify-between">
              <Label>Images <span className="font-normal text-slate-400">(up to 5)</span></Label>
              <button type="button" onClick={() => setAutoResize((value) => !value)} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold ${autoResize ? 'border-green-200 bg-green-50 text-green-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <Zap className="w-3 h-3" />Auto-resize {autoResize ? 'ON' : 'OFF'}
              </button>
            </div>
            {existingImageUrl && !images.length && (
              <div className="flex items-center gap-3 rounded-lg border bg-slate-50 p-2">
                <img src={normalizeImageUrl(existingImageUrl)} alt="Current product" className="h-14 w-14 rounded border bg-white object-contain" />
                <span className="text-sm text-slate-600">Current primary image</span>
              </div>
            )}
            <Input value={formData.image_url} onChange={(event) => updateForm('image_url', event.target.value)} placeholder="Paste image URL (Google Drive link works)" />
            <input type="file" multiple accept="image/*" disabled={isResizing} onChange={async (event) => {
              await handleImageFiles(Array.from(event.target.files || []));
              event.target.value = '';
            }} className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-red-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-red-600" />
            {isResizing && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" />Resizing...</div>}
            {images.map((image, index) => (
              <div key={`${image.name}-${index}`} className="flex items-center gap-3 rounded-lg border bg-slate-50 p-3">
                <img src={imagePreviews[index]} alt="" className="h-14 w-14 rounded border bg-white object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{image.name}</p>
                  <p className="text-xs text-slate-400">{formatBytes(image.size)}</p>
                  <Input className="mt-1 h-7 text-xs" placeholder="Alt text (SEO)" value={imageMetadata[index]?.altText || ''} onChange={(event) => {
                    setImageMetadata((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, altText: event.target.value } : item));
                  }} />
                </div>
                <button type="button" onClick={() => removeImage(index)} className="text-slate-400 hover:text-red-600"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </section>

          <section className="flex flex-wrap gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><Switch checked={formData.is_active} onCheckedChange={(value) => updateForm('is_active', value)} /><Label>Active</Label></div>
            <div className="flex items-center gap-3"><Switch checked={formData.is_featured} onCheckedChange={(value) => updateForm('is_featured', value)} /><Label>Featured</Label></div>
          </section>

          <div className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-[#f4f6f9]/95 py-4 backdrop-blur">
            <Button type="button" variant="outline" onClick={goBack} disabled={isSaving}>Cancel</Button>
            <Button type="button" variant="outline" onClick={() => save(true)} disabled={isSaving}>Save & Add Another</Button>
            <Button type="submit" disabled={isSaving} className="bg-red-600 text-white hover:bg-red-700">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Update Product' : 'Create Product'}
            </Button>
          </div>
        </form>
      </main>
      <KeyboardShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} editor />
    </div>
  );
}
