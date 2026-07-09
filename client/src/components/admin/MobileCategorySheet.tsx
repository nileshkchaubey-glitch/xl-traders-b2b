import { useEffect, useState } from "react";
import { Upload, Loader2, Trash2, Settings2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { categoryService } from "@/lib/productService";
import { Category } from "@/lib/supabase";

interface MobileCategorySheetProps {
  category: Category | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Reuses AdminCategories' existing uploadCategoryImage (bucket "category-images").
  uploadImage: (file: File, categoryId: string) => Promise<string>;
  onSaved: () => void;
  onFullEdit: (category: Category) => void;
  onDelete: (id: string) => void;
}

/**
 * Bottom sheet for the common category edits on mobile — name, image and the
 * active/display toggle. Everything else (slug, group, description, order) is
 * deferred to the existing full Add/Edit dialog via "All fields". Saves through
 * categoryService.update; image upload reuses the parent's existing uploader.
 */
export default function MobileCategorySheet({
  category,
  open,
  onOpenChange,
  uploadImage,
  onSaved,
  onFullEdit,
  onDelete,
}: MobileCategorySheetProps) {
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (category) {
      setName(category.name);
      setImageUrl(category.image_url || "");
      setIsActive(category.is_active ?? true);
    }
  }, [category]);

  if (!category) return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, category.id);
      setImageUrl(url);
      toast.success("Image uploaded");
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      await categoryService.update(category.id, {
        name: name.trim(),
        image_url: imageUrl || null,
        is_active: isActive,
      });
      toast.success("Category saved");
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error("Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="truncate">{category.name}</DrawerTitle>
          <DrawerDescription>
            Quick edit — name, image &amp; visibility
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-2 space-y-5 overflow-y-auto">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="mc-name">Name</Label>
            <Input
              id="mc-name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-11"
            />
          </div>

          {/* Image */}
          <div className="space-y-1.5">
            <Label>Image</Label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center flex-shrink-0">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={e => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                ) : (
                  <ImageIcon className="w-5 h-5 text-slate-300" />
                )}
              </div>
              <label
                className={`flex items-center justify-center gap-2 h-11 px-4 rounded-xl border text-sm font-semibold transition ${
                  uploading
                    ? "border-slate-200 text-slate-300"
                    : "border-slate-300 text-slate-700 active:bg-slate-50"
                }`}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {uploading ? "Uploading…" : "Upload image"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleUpload}
                />
              </label>
            </div>
          </div>

          {/* Active toggle */}
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span>
              <span className="block text-sm font-medium text-slate-800">
                Show on storefront
              </span>
              <span className="block text-xs text-slate-400">
                Inactive catalogues are hidden from customers.
              </span>
            </span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </label>

          {/* Full editor + delete */}
          <div className="flex gap-2">
            <button
              onClick={() => onFullEdit(category)}
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 active:bg-slate-50"
            >
              <Settings2 className="w-4 h-4" />
              All fields
            </button>
            <button
              onClick={() => onDelete(category.id)}
              className="flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-red-200 text-sm font-semibold text-red-600 active:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        <DrawerFooter className="flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1 h-11"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
