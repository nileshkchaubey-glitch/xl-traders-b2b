import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Star, Trash2, Loader2, GripVertical, ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { productImageService, storageService, productService } from '@/lib/productService';
import { autoResizeImage, formatBytes } from '@/lib/imageUtils';
import { ProductImage, Product } from '@/lib/supabase';

interface Props {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onPrimaryChanged?: (productId: string, newUrl: string) => void;
}

interface GalleryImage extends ProductImage {
  uploading?: boolean;
  preview?: string;
}

export default function AdminImageGallery({ product, open, onClose, onPrimaryChanged }: Props) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoResize, setAutoResize] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [altEditing, setAltEditing] = useState<string | null>(null);
  const [altValue, setAltValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Drag state
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  const loadImages = useCallback(async () => {
    if (!product) return;
    setLoading(true);
    try {
      const rows = await productImageService.getByProductId(product.id);
      // If there's a primary image_url on the product but no matching gallery row, synthesise one
      const hasPrimary = rows.some((r) => r.image_url === product.image_url);
      if (product.image_url && !hasPrimary) {
        const synthetic: GalleryImage = {
          id: '__primary__',
          product_id: product.id,
          image_url: product.image_url,
          alt_text: product.image_alt_text || product.name,
          description: '',
          display_order: -1,
          created_at: new Date().toISOString(),
        };
        setImages([synthetic, ...rows]);
      } else {
        setImages(rows);
      }
    } catch {
      toast.error('Failed to load images');
    } finally {
      setLoading(false);
    }
  }, [product]);

  useEffect(() => {
    if (open && product) loadImages();
    if (!open) { setImages([]); setDeleteConfirm(null); setAltEditing(null); }
  }, [open, product, loadImages]);

  // ── Drag-to-reorder ─────────────────────────────────────────────────────────
  const handleDragStart = (index: number) => {
    dragIndex.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverIndex.current = index;
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIndex.current;
    const to = dragOverIndex.current;
    if (from === null || to === null || from === to) return;

    const reordered = [...images];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    // Assign new display_order values
    const updated = reordered.map((img, i) => ({ ...img, display_order: i }));
    setImages(updated);

    dragIndex.current = null;
    dragOverIndex.current = null;

    // Persist reordering
    setSaving(true);
    try {
      await Promise.all(
        updated
          .filter((img) => img.id !== '__primary__')
          .map((img) => productImageService.update(img.id, { display_order: img.display_order })),
      );
      // Make the first image the primary
      if (product && updated.length > 0) {
        const firstUrl = updated[0].image_url;
        await productService.update(product.id, { image_url: firstUrl });
        onPrimaryChanged?.(product.id, firstUrl);
      }
      toast.success('Order saved');
    } catch {
      toast.error('Failed to save order');
      loadImages(); // revert
    } finally {
      setSaving(false);
    }
  };

  // ── Set primary ──────────────────────────────────────────────────────────────
  const handleSetPrimary = async (img: GalleryImage) => {
    if (!product) return;
    setSaving(true);
    try {
      await productService.update(product.id, { image_url: img.image_url });
      onPrimaryChanged?.(product.id, img.image_url);
      // Move primary to front in display_order
      const reordered = [img, ...images.filter((i) => i.id !== img.id)].map((im, idx) => ({
        ...im,
        display_order: idx,
      }));
      setImages(reordered);
      await Promise.all(
        reordered
          .filter((i) => i.id !== '__primary__')
          .map((i) => productImageService.update(i.id, { display_order: i.display_order })),
      );
      toast.success('Primary image updated');
    } catch {
      toast.error('Failed to set primary');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (img: GalleryImage) => {
    if (!product) return;
    setSaving(true);
    try {
      if (img.id !== '__primary__') {
        await productImageService.delete(img.id);
      }
      // If deleting the primary, clear products.image_url or set next
      if (img.image_url === product.image_url) {
        const remaining = images.filter((i) => i.id !== img.id);
        const nextUrl = remaining.length > 0 ? remaining[0].image_url : null;
        await productService.update(product.id, { image_url: nextUrl || '' });
        if (nextUrl) onPrimaryChanged?.(product.id, nextUrl);
      }
      setImages((prev) => prev.filter((i) => i.id !== img.id));
      setDeleteConfirm(null);
      toast.success('Image removed');
    } catch {
      toast.error('Failed to delete image');
    } finally {
      setSaving(false);
    }
  };

  // ── Upload ───────────────────────────────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!product) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';

    const MAX_IMAGES = 10;
    if (images.length + files.length > MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} images per product`);
      return;
    }

    setUploading(true);
    let added = 0;
    for (let i = 0; i < files.length; i++) {
      let file = files[i];
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        continue;
      }

      // Resize
      if (autoResize) {
        try {
          const result = await autoResizeImage(file);
          const saved = result.originalSize - result.newSize;
          if (saved > 1024) toast.success(`Compressed · saved ${formatBytes(saved)}`);
          file = result.file;
        } catch {
          // continue with original
        }
      }

      // Upload placeholder
      const tempId = `__uploading__${Date.now()}__${i}`;
      const preview = URL.createObjectURL(file);
      setImages((prev) => [
        ...prev,
        {
          id: tempId,
          product_id: product.id,
          image_url: preview,
          alt_text: file.name,
          description: '',
          display_order: prev.length,
          created_at: new Date().toISOString(),
          uploading: true,
          preview,
        },
      ]);

      try {
        const url = await storageService.uploadProductImage(file, product.id);
        if (!url) throw new Error('Upload returned empty URL');

        const nextOrder = images.length + added;
        const created = await productImageService.create({
          product_id: product.id,
          image_url: url,
          alt_text: file.name.replace(/\.[^.]+$/, ''),
          description: '',
          display_order: nextOrder,
        });

        // If first ever image, also set as primary
        if (images.filter((img) => !img.uploading).length === 0 && added === 0) {
          await productService.update(product.id, { image_url: url });
          onPrimaryChanged?.(product.id, url);
        }

        setImages((prev) =>
          prev.map((img) =>
            img.id === tempId
              ? { ...created, uploading: false, preview: undefined }
              : img,
          ),
        );
        added++;
      } catch (err) {
        console.error(err);
        toast.error(`Failed to upload ${file.name}`);
        setImages((prev) => prev.filter((img) => img.id !== tempId));
        if (preview) URL.revokeObjectURL(preview);
      }
    }
    setUploading(false);
    if (added > 0) toast.success(`${added} image${added > 1 ? 's' : ''} uploaded`);
  };

  // ── Alt text editing ─────────────────────────────────────────────────────────
  const saveAltText = async (img: GalleryImage) => {
    if (img.id === '__primary__' || img.uploading) return;
    try {
      await productImageService.update(img.id, { alt_text: altValue });
      setImages((prev) => prev.map((i) => (i.id === img.id ? { ...i, alt_text: altValue } : i)));
      setAltEditing(null);
      toast.success('Alt text saved');
    } catch {
      toast.error('Failed to save alt text');
    }
  };

  const isPrimary = (img: GalleryImage) => product && img.image_url === product.image_url;

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-red-600" />
            Image Gallery — {product.name}
          </DialogTitle>
          <DialogDescription className="sr-only">Manage images for {product.name}</DialogDescription>
        </DialogHeader>

        {/* Controls */}
        <div className="flex items-center gap-3 pt-1 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
            <input
              type="checkbox"
              checked={autoResize}
              onChange={(e) => setAutoResize(e.target.checked)}
              className="accent-red-600"
            />
            <span className="text-slate-700">Auto-resize to 800px</span>
          </label>
          <div className="flex-1" />
          <label
            htmlFor="gallery-upload"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer border border-red-600 text-red-600 hover:bg-red-50 transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload Images
            <input
              id="gallery-upload"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
          </label>
          {saving && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving…
            </span>
          )}
        </div>

        {/* Tip */}
        <p className="text-xs text-slate-400 -mt-1">
          <GripVertical className="w-3.5 h-3.5 inline mr-0.5 -mt-0.5" />
          Drag cards to reorder. The first image is the primary (shown in listings). ⭐ = current primary.
        </p>

        {/* Gallery grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
            <ImageIcon className="w-12 h-12 mb-3 text-slate-300" />
            <p className="font-medium text-slate-600">No images yet</p>
            <p className="text-sm mt-1">Upload images using the button above</p>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 gap-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {images.map((img, index) => (
              <div
                key={img.id}
                draggable={!img.uploading}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                className={`relative group rounded-xl border-2 overflow-hidden bg-white transition-all cursor-grab active:cursor-grabbing select-none ${
                  isPrimary(img)
                    ? 'border-amber-400 ring-1 ring-amber-200'
                    : 'border-slate-200 hover:border-slate-300'
                } ${img.uploading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {/* Image */}
                <div className="relative aspect-square bg-slate-50">
                  <img
                    src={img.preview || img.image_url}
                    alt={img.alt_text || ''}
                    className="w-full h-full object-cover pointer-events-none"
                    draggable={false}
                  />

                  {img.uploading && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                    </div>
                  )}

                  {/* Primary badge */}
                  {isPrimary(img) && (
                    <div className="absolute top-2 left-2 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3" fill="currentColor" />
                      Primary
                    </div>
                  )}

                  {/* Drag handle */}
                  {!img.uploading && (
                    <div className="absolute top-2 right-2 bg-black/40 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical className="w-4 h-4" />
                    </div>
                  )}

                  {/* Order badge */}
                  <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                    {index + 1}
                  </div>
                </div>

                {/* Alt text */}
                <div className="px-2 py-1.5 border-t border-slate-100">
                  {altEditing === img.id ? (
                    <div className="flex gap-1">
                      <Input
                        value={altValue}
                        onChange={(e) => setAltValue(e.target.value)}
                        className="h-7 text-xs"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveAltText(img);
                          if (e.key === 'Escape') setAltEditing(null);
                        }}
                      />
                      <Button size="sm" className="h-7 px-2 text-xs" onClick={() => saveAltText(img)}>✓</Button>
                      <button onClick={() => setAltEditing(null)} className="px-1 text-slate-400 hover:text-slate-700">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="text-xs text-slate-500 hover:text-slate-800 truncate w-full text-left"
                      onClick={() => { setAltEditing(img.id); setAltValue(img.alt_text || ''); }}
                      title="Click to edit alt text"
                    >
                      {img.alt_text || <span className="italic text-slate-300">Add alt text…</span>}
                    </button>
                  )}
                </div>

                {/* Actions */}
                {!img.uploading && (
                  <div className="flex border-t border-slate-100">
                    {!isPrimary(img) && (
                      <button
                        onClick={() => handleSetPrimary(img)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        title="Set as primary image"
                      >
                        <Star className="w-3.5 h-3.5" />
                        Set primary
                      </button>
                    )}
                    {deleteConfirm === img.id ? (
                      <div className="flex-1 flex items-center justify-center gap-1 py-1.5">
                        <button
                          onClick={() => handleDelete(img)}
                          className="text-xs text-red-600 font-semibold hover:underline"
                        >
                          Confirm
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-xs text-slate-500 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(img.id)}
                        className={`${isPrimary(img) ? 'flex-1' : ''} flex items-center justify-center gap-1 py-1.5 px-2 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors`}
                        title="Remove image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Upload tile */}
            <label
              htmlFor="gallery-upload-tile"
              className="flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-red-400 hover:bg-red-50 cursor-pointer transition-colors text-slate-400 hover:text-red-500"
            >
              {uploading ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <>
                  <Upload className="w-8 h-8 mb-1" />
                  <span className="text-xs font-medium">Add images</span>
                </>
              )}
              <input
                id="gallery-upload-tile"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            {images.length} image{images.length !== 1 ? 's' : ''} · drag to reorder · first = primary
          </p>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
