import {
  Camera,
  Upload,
  Loader2,
  Search,
  ImageIcon,
  Check,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MediaImage } from "@/lib/productService";
import { formatBytes } from "@/lib/imageUtils";

type FilterSource = "all" | "storage" | "database";

interface MobileImageLibraryProps {
  images: MediaImage[];
  filteredImages: MediaImage[];
  loading: boolean;
  uploading: boolean;
  search: string;
  onSearch: (value: string) => void;
  filterSource: FilterSource;
  onFilterSource: (source: FilterSource) => void;
  selectedUrl: string | null;
  onSelect: (url: string) => void;
  // Reuses AdminImageLibrary.handleUpload → autoResizeImage → mediaService.uploadGlobalImage
  onUpload: (files: File[]) => void;
  onCopyUrl: (url: string) => void;
  isSelectionMode: boolean;
  onSelectImage?: (url: string) => void;
}

/**
 * Touch-friendly presentation of the image library for phones. Holds NO data or
 * upload logic of its own — every action is a callback into AdminImageLibrary,
 * which owns the shared state and the existing mediaService flow. Only the UI
 * and the camera-capture entry point are new.
 */
export default function MobileImageLibrary({
  images,
  filteredImages,
  loading,
  uploading,
  search,
  onSearch,
  filterSource,
  onFilterSource,
  selectedUrl,
  onSelect,
  onUpload,
  onCopyUrl,
  isSelectionMode,
  onSelectImage,
}: MobileImageLibraryProps) {
  // Clearing the value after each pick lets the same file/photo re-trigger onChange.
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    onUpload(files);
    e.target.value = "";
  };

  const filters: { key: FilterSource; label: string }[] = [
    { key: "all", label: `All (${images.length})` },
    { key: "storage", label: "Storage" },
    { key: "database", label: "Drive / DB" },
  ];

  return (
    <div className="space-y-4 pb-4">
      {!isSelectionMode && (
        <div>
          <h1 className="text-xl font-bold text-slate-900">Image Library</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Snap a photo or upload — images auto-compress before upload.
          </p>
        </div>
      )}

      {/* ── Prominent capture / upload ── */}
      <div className="flex gap-2.5">
        {/* Rear camera (falls back to a file picker where unavailable) */}
        <label
          className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl text-white text-[14px] font-bold transition ${
            uploading ? "bg-red-400" : "bg-red-600 active:bg-red-700 shadow-red"
          }`}
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Camera className="w-5 h-5" />
          )}
          {uploading ? "Uploading…" : "Take Photo"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={uploading}
            onChange={pick}
          />
        </label>

        {/* Gallery (multi-select — the existing flow loops over File[]) */}
        <label
          className={`flex items-center justify-center gap-2 h-12 px-4 rounded-xl border text-[14px] font-bold transition ${
            uploading
              ? "border-slate-200 text-slate-300"
              : "border-slate-300 text-slate-700 bg-white active:bg-slate-50"
          }`}
        >
          <Upload className="w-5 h-5" />
          Upload
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={pick}
          />
        </label>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search images by name…"
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="pl-9 h-11 bg-slate-50 border-slate-200 text-sm"
        />
      </div>

      {/* ── Source filter chips ── */}
      <div className="flex gap-2">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => onFilterSource(f.key)}
            className={`flex-1 min-h-[38px] rounded-lg text-[12.5px] font-semibold border transition ${
              filterSource === f.key
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-white text-slate-500 border-slate-200 active:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Selection-mode banner (reuses the existing assign flow) ── */}
      {isSelectionMode && onSelectImage && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <span className="text-xs font-semibold text-amber-800">
            {selectedUrl ? "1 image selected" : "Tap an image to select"}
          </span>
          <Button
            size="sm"
            disabled={!selectedUrl}
            onClick={() => selectedUrl && onSelectImage(selectedUrl)}
            className="h-9 px-4 bg-amber-500 hover:bg-amber-600 text-white gap-1.5 text-xs font-bold"
          >
            <Check className="w-4 h-4" />
            Use Selected
          </Button>
        </div>
      )}

      {/* ── Grid ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-xl">
          <Loader2 className="w-7 h-7 animate-spin text-red-600 mb-2" />
          <span className="text-slate-500 text-xs">Loading images…</span>
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border-2 border-dashed border-slate-200 rounded-xl text-center">
          <ImageIcon className="w-10 h-10 text-slate-300 mb-2" />
          <p className="font-semibold text-slate-700 text-sm">
            No images found
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Use Take Photo or Upload to add images.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filteredImages.map((img, i) => {
            const isSelected = selectedUrl === img.url;
            const isStorage = img.source === "storage";
            return (
              <div
                key={img.url + i}
                onClick={() => onSelect(img.url)}
                className={`relative rounded-xl border overflow-hidden bg-white transition-all flex flex-col ${
                  isSelected
                    ? "ring-2 ring-red-500 border-red-500"
                    : "border-slate-200"
                }`}
              >
                <div className="aspect-square bg-slate-50 relative overflow-hidden flex items-center justify-center">
                  <img
                    src={img.url}
                    alt={img.name}
                    loading="lazy"
                    className="w-full h-full object-contain p-1.5 select-none pointer-events-none"
                  />
                  <span
                    className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shadow-sm ${
                      isStorage ? "bg-red-500" : "bg-slate-700"
                    }`}
                  >
                    {isStorage ? "Storage" : "Drive"}
                  </span>
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 bg-red-600 text-white rounded-full p-1 shadow-md">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                  {isStorage && img.size && (
                    <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded font-mono">
                      {formatBytes(img.size)}
                    </span>
                  )}
                </div>

                <div className="p-2 flex flex-col gap-2">
                  <p
                    className="text-[11px] font-semibold text-slate-800 line-clamp-1 break-all"
                    title={img.name}
                  >
                    {img.name.replace(/\.[^.]+$/, "")}
                  </p>

                  {isSelectionMode && onSelectImage ? (
                    <Button
                      size="sm"
                      onClick={e => {
                        e.stopPropagation();
                        onSelectImage(img.url);
                      }}
                      className="w-full h-10 text-[12px] font-extrabold bg-red-600 hover:bg-red-700 text-white border-0 rounded-lg"
                    >
                      Use Image
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onCopyUrl(img.url);
                        }}
                        className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-slate-600 text-[12px] font-semibold active:bg-slate-50"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </button>
                      <a
                        href={img.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 active:bg-slate-50"
                        aria-label="Open in new tab"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
