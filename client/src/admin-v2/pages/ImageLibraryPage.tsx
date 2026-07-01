import { useState } from "react";
import { toast } from "sonner";
import {
  Upload,
  Search,
  Loader2,
  ImageIcon,
  ExternalLink,
  Copy,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/lib/imageUtils";
import { useImageLibrary, ImageSourceFilter } from "../hooks/useImageLibrary";

type GridSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<GridSize, string> = {
  sm: "grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2",
  md: "grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3",
  lg: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4",
};

const SOURCE_TABS: { key: ImageSourceFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "storage", label: "Storage" },
  { key: "database", label: "Drive / DB" },
];

export default function ImageLibraryPage() {
  const lib = useImageLibrary();
  const [gridSize, setGridSize] = useState<GridSize>("lg");
  const [fit, setFit] = useState<"cover" | "contain">("contain");
  const [dragOver, setDragOver] = useState(false);

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Image URL copied");
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">Image Library</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
              {lib.images.length}
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            Storage files + Drive/DB image URLs in one place. Uploads
            auto-compress to 800px.
          </p>
        </div>
        <button
          onClick={() => lib.reload()}
          disabled={lib.loading}
          title="Reload"
          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${lib.loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Upload + search/filter row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label
          onDragOver={e => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setDragOver(false);
            lib.upload(Array.from(e.dataTransfer.files || []));
          }}
          className={`md:col-span-2 border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all h-[120px] ${
            dragOver
              ? "border-red-500 bg-red-50/50"
              : "border-slate-200 hover:border-red-400 bg-white hover:bg-slate-50/30"
          }`}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={lib.uploading}
            onChange={e => {
              lib.upload(Array.from(e.target.files || []));
              e.target.value = "";
            }}
            className="hidden"
          />
          {lib.uploading ? (
            <div className="flex flex-col items-center gap-1.5">
              <Loader2 className="w-6 h-6 animate-spin text-red-600" />
              <span className="text-xs font-semibold text-slate-600">
                Uploading images…
              </span>
            </div>
          ) : (
            <>
              <Upload className="w-6 h-6 text-slate-400 mb-1" />
              <span className="text-xs font-semibold text-slate-700">
                Drag &amp; drop images here or{" "}
                <span className="text-red-600 hover:underline">Browse</span>
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                PNG, JPG, WebP — auto-compressed to 800px.
              </span>
            </>
          )}
        </label>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-center space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name…"
              value={lib.search}
              onChange={e => lib.setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
            />
          </div>
          <div className="flex items-center gap-1">
            {SOURCE_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => lib.setSource(tab.key)}
                className={`flex-1 text-[11px] py-1 px-2 rounded-lg font-medium transition-all border ${
                  lib.source === tab.key
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "text-slate-500 hover:bg-slate-100 border-transparent"
                }`}
              >
                {tab.label}
                {tab.key === "all" ? ` (${lib.images.length})` : ""}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* View controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
        <span className="text-xs font-semibold text-slate-600">
          {lib.filtered.length} shown
        </span>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Size:</span>
            <div className="bg-slate-200/50 p-0.5 rounded-lg flex items-center">
              {(["sm", "md", "lg"] as GridSize[]).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setGridSize(s)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                    gridSize === s
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {s === "sm" ? "Small" : s === "md" ? "Medium" : "Large"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Fit:</span>
            <div className="bg-slate-200/50 p-0.5 rounded-lg flex items-center">
              <button
                type="button"
                onClick={() => setFit("contain")}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  fit === "contain"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Fit
              </button>
              <button
                type="button"
                onClick={() => setFit("cover")}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  fit === "cover"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Fill
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      {lib.loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-2" />
          <span className="text-slate-500 text-xs">Loading media files…</span>
        </div>
      ) : lib.filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border-2 border-dashed border-slate-200 rounded-xl text-center">
          <ImageIcon className="w-12 h-12 text-slate-300 mb-2" />
          <p className="font-semibold text-slate-700 text-sm">No images found</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload images above to build your library.
          </p>
        </div>
      ) : (
        <div className={`grid ${SIZE_CLASSES[gridSize]}`}>
          {lib.filtered.map((img, i) => {
            const isStorage = img.source === "storage";
            return (
              <div
                key={img.url + i}
                className="relative group rounded-xl border border-slate-200 overflow-hidden bg-white hover:border-slate-300 hover:shadow-sm transition-all flex flex-col"
              >
                <div className="aspect-square bg-slate-50 relative overflow-hidden flex items-center justify-center">
                  <img
                    src={img.url}
                    alt={img.name}
                    loading="lazy"
                    className={`select-none transition-all duration-300 ${
                      fit === "cover"
                        ? "w-full h-full object-cover"
                        : "w-full h-full object-contain p-2.5 bg-slate-100/30"
                    }`}
                  />
                  <span
                    className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shadow-sm ${
                      isStorage ? "bg-red-500" : "bg-slate-700"
                    }`}
                  >
                    {isStorage ? "Storage" : "Drive"}
                  </span>
                  {isStorage && img.size && (
                    <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded font-mono">
                      {formatBytes(img.size)}
                    </span>
                  )}
                </div>
                <div className="p-2.5 flex-1 flex flex-col justify-between">
                  <p
                    className="text-[11px] font-bold text-slate-800 line-clamp-2 leading-tight break-all"
                    title={img.name}
                  >
                    {img.name.replace(/\.[^.]+$/, "")}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => copyUrl(img.url)}
                      className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors"
                      title="Copy URL"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={img.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
