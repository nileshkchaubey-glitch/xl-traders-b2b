import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ImageIcon, Plus, Trash2, Star, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import AdminImageLibrary from "@/components/admin/AdminImageLibrary";
import { productImageService } from "@/lib/productService";
import { normalizeImageUrl } from "@/lib/imageUtils";
import { Product, ProductImage } from "@/lib/supabase";

interface ProductMediaSectionProps {
  product: Product | null;
  imageUrl: string;
  previewUrl: string;
  onImageUrlChange: (value: string) => void;
  isNA: (field: string) => boolean;
  toggleNA: (field: string) => void;
}

// Drawer Media: the primary image (products.image_url) PLUS the per-product
// gallery (product_images) — the real multi-image surface — with add from the
// Image Library, remove, and "set as primary".
export default function ProductMediaSection({
  product,
  imageUrl,
  previewUrl,
  onImageUrlChange,
  isNA,
  toggleNA,
}: ProductMediaSectionProps) {
  const [gallery, setGallery] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const productId = product?.id;

  const refresh = useCallback(async () => {
    if (!productId) {
      setGallery([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await productImageService.getByProductId(productId);
      setGallery(rows);
    } catch {
      // non-fatal; gallery just stays empty
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addFromLibrary = async (url: string) => {
    if (!productId) {
      // Unsaved product: fall back to setting it as the primary image.
      onImageUrlChange(url);
      setLibraryOpen(false);
      return;
    }
    setBusy(true);
    try {
      await productImageService.create({
        product_id: productId,
        image_url: url,
        display_order: gallery.length,
      });
      await refresh();
      toast.success("Image added to gallery");
    } catch {
      toast.error("Could not add image");
    } finally {
      setBusy(false);
      setLibraryOpen(false);
    }
  };

  const removeImage = async (id: string) => {
    setBusy(true);
    try {
      await productImageService.delete(id);
      await refresh();
    } catch {
      toast.error("Could not remove image");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Primary image */}
      <div className="flex items-start gap-3">
        <div className="w-20 h-20 shrink-0 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Primary"
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="w-6 h-6 text-slate-300" />
          )}
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Primary image URL</Label>
            <button
              type="button"
              onClick={() => toggleNA("image")}
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                isNA("image")
                  ? "bg-slate-700 text-white border-slate-700"
                  : "border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400"
              }`}
            >
              N/A
            </button>
          </div>
          <Input
            value={imageUrl}
            onChange={e => onImageUrlChange(e.target.value)}
            placeholder="Paste an image URL (Drive thumbnail, etc.)"
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Gallery (product_images) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">
            Gallery{gallery.length ? ` (${gallery.length})` : ""}
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={busy}
            onClick={() => setLibraryOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" /> Select from Library
          </Button>
        </div>

        {!productId ? (
          <p className="text-[11px] text-slate-400">
            Save the product first to attach gallery images.
          </p>
        ) : loading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading gallery…
          </div>
        ) : gallery.length === 0 ? (
          <p className="text-[11px] text-slate-400">
            No extra images yet. Add from the Library.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {gallery.map(img => {
              const url = normalizeImageUrl(img.image_url);
              const isPrimary = normalizeImageUrl(imageUrl) === url;
              return (
                <div
                  key={img.id}
                  className="group relative w-16 h-16 rounded-md border border-slate-200 overflow-hidden bg-slate-50"
                >
                  <img
                    src={url}
                    alt={img.alt_text || ""}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 hidden group-hover:flex items-center justify-center gap-1 bg-black/40">
                    <button
                      type="button"
                      title={isPrimary ? "Primary image" : "Set as primary"}
                      onClick={() => onImageUrlChange(img.image_url)}
                      className={`p-1 rounded ${isPrimary ? "text-amber-300" : "text-white hover:text-amber-300"}`}
                    >
                      <Star
                        className="w-3.5 h-3.5"
                        fill={isPrimary ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => removeImage(img.id)}
                      className="p-1 rounded text-white hover:text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {isPrimary && (
                    <span className="absolute bottom-0 inset-x-0 bg-amber-500 text-[8px] font-bold text-white text-center">
                      PRIMARY
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select image from Library</DialogTitle>
            <DialogDescription className="sr-only">
              Pick an existing image to add to this product
            </DialogDescription>
          </DialogHeader>
          <AdminImageLibrary isSelectionMode onSelectImage={addFromLibrary} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
