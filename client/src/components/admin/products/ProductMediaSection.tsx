import { ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Product } from "@/lib/supabase";

interface ProductMediaSectionProps {
  product: Product | null;
  imageUrl: string;
  previewUrl: string;
  onImageUrlChange: (value: string) => void;
  isNA: (field: string) => boolean;
  toggleNA: (field: string) => void;
}

// Primary image for the drawer. The product_images gallery + Image Library
// "Select from" are wired in step 3 (this component is extended there).
export default function ProductMediaSection({
  previewUrl,
  imageUrl,
  onImageUrlChange,
  isNA,
  toggleNA,
}: ProductMediaSectionProps) {
  return (
    <div className="space-y-3">
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
    </div>
  );
}
