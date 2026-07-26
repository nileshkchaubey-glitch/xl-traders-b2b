import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Upload,
  Search,
  Trash2,
  Loader2,
  ImageIcon,
  ExternalLink,
  Check,
  Copy,
  Info,
  CheckSquare,
} from "lucide-react";
import { toast } from "sonner";
import { mediaService, MediaImage } from "@/lib/productService";
import { autoResizeImage, formatBytes } from "@/lib/imageUtils";
import { useIsMobile } from "@/hooks/useMobile";
import MobileImageLibrary from "@/components/admin/MobileImageLibrary";

interface Props {
  onSelectImage?: (url: string) => void;
  isSelectionMode?: boolean;
  /**
   * SKU of the product being edited. Files whose name contains it sort to the
   * front and carry a "Matches SKU" badge — with a few hundred images in the
   * bucket, the one you want is almost always the one named after the product.
   */
  skuHint?: string;
  /** Rendered next to Cancel in selection mode. */
  onCancel?: () => void;
  /**
   * Handles files dropped on (or browsed from) the selection-mode dropzone.
   * When omitted the library's own global upload runs, which names files
   * randomly; the Workbench passes its SKU-named upload instead so a dropped
   * file lands at `products/{SKU}/{SKU}.webp` exactly like the Upload button.
   */
  onDropFiles?: (files: File[]) => void | Promise<void>;
  /** Replaces the dropzone's second line — e.g. where uploads will be stored. */
  uploadHint?: string;
  /** Consumer-owned upload in flight (pairs with `onDropFiles`). */
  busy?: boolean;
}

/** Compare loosely: `HINGED-BOX-2000-ML` should match `hinged_box_2000_ml.webp`. */
function normalizeForMatch(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default function AdminImageLibrary({
  onSelectImage,
  isSelectionMode = false,
  skuHint,
  onCancel,
  onDropFiles,
  uploadHint,
  busy = false,
}: Props) {
  const [images, setImages] = useState<MediaImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<
    "all" | "storage" | "database"
  >("all");
  const [dragOver, setDragOver] = useState(false);
  const [gridSize, setGridSize] = useState<"sm" | "md" | "lg">("lg");
  const [imageFit, setImageFit] = useState<"cover" | "contain">("contain");
  const isMobile = useIsMobile();

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const list = await mediaService.listAllImages();
      setImages(list);
    } catch {
      toast.error("Failed to load images");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleUpload = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    let uploadedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image file`);
        continue;
      }

      try {
        // Compress/resize if needed
        let fileToUpload = file;
        try {
          const resized = await autoResizeImage(file);
          fileToUpload = resized.file;
          const saved = resized.originalSize - resized.newSize;
          if (saved > 1024) {
            console.log(
              `Auto-resized ${file.name} · saved ${formatBytes(saved)}`
            );
          }
        } catch (err) {
          console.warn("Image compression failed, uploading original:", err);
        }

        const url = await mediaService.uploadGlobalImage(fileToUpload);
        if (url) {
          uploadedCount++;
        }
      } catch (err) {
        console.error(err);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
    if (uploadedCount > 0) {
      toast.success(
        `${uploadedCount} image${uploadedCount > 1 ? "s" : ""} uploaded successfully!`
      );
      loadImages();
    }
  };

  // One entry point for both the file input and the dropzone, so a consumer
  // that owns the upload (the Workbench, which names files after the SKU) gets
  // dropped files as well as browsed ones.
  const receiveFiles = (files: File[]) => {
    if (!files.length) return;
    if (onDropFiles) {
      const images = files.filter(f => f.type.startsWith("image/"));
      if (!images.length) {
        toast.error("Only image files can be uploaded");
        return;
      }
      void onDropFiles(images);
      return;
    }
    void handleUpload(files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    receiveFiles(Array.from(e.target.files || []));
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    receiveFiles(Array.from(e.dataTransfer.files || []));
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Image URL copied to clipboard!");
  };

  // Filtered images
  const filteredImages = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = images.filter(img => {
      const matchesSearch =
        !q ||
        img.name.toLowerCase().includes(q) ||
        img.url.toLowerCase().includes(q);
      if (filterSource === "all") return matchesSearch;
      return matchesSearch && img.source === filterSource;
    });

    const sku = skuHint?.trim() ? normalizeForMatch(skuHint) : "";
    if (!sku) return list;
    // Stable partition: SKU matches first, everything else in original order.
    const hit: MediaImage[] = [];
    const rest: MediaImage[] = [];
    for (const img of list) {
      (normalizeForMatch(img.name).includes(sku) ? hit : rest).push(img);
    }
    return [...hit, ...rest];
  }, [images, search, filterSource, skuHint]);

  const skuMatchCount = useMemo(() => {
    const sku = skuHint?.trim() ? normalizeForMatch(skuHint) : "";
    if (!sku) return 0;
    return filteredImages.filter(i => normalizeForMatch(i.name).includes(sku))
      .length;
  }, [filteredImages, skuHint]);

  const isSkuMatch = useCallback(
    (name: string) => {
      const sku = skuHint?.trim() ? normalizeForMatch(skuHint) : "";
      return !!sku && normalizeForMatch(name).includes(sku);
    },
    [skuHint]
  );

  // ── Keyboard navigation (selection mode) ───────────────────────────────────
  const [focusIndex, setFocusIndex] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  // Reset the cursor whenever the visible set changes underneath it.
  useEffect(() => setFocusIndex(0), [search, filterSource]);

  // Column count comes from the resolved grid, so arrow-up/down move a true
  // visual row no matter how the auto-fill track list reflowed.
  const columnCount = () => {
    const el = gridRef.current;
    if (!el) return 1;
    return getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean)
      .length;
  };

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (!filteredImages.length) return;
    const cols = columnCount();
    const delta =
      e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowLeft"
          ? -1
          : e.key === "ArrowDown"
            ? cols
            : e.key === "ArrowUp"
              ? -cols
              : 0;
    if (delta !== 0) {
      e.preventDefault();
      const next = Math.min(
        Math.max(focusIndex + delta, 0),
        filteredImages.length - 1
      );
      setFocusIndex(next);
      setSelectedUrl(filteredImages[next].url);
      gridRef.current
        ?.querySelector(`[data-idx="${next}"]`)
        ?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const img = filteredImages[focusIndex];
      if (img && onSelectImage) onSelectImage(img.url);
    }
  };

  const previewImage = selectedUrl
    ? filteredImages.find(i => i.url === selectedUrl)
    : undefined;

  // Mobile: touch-friendly grid + camera capture. Reuses every handler/state
  // above (same mediaService flow) — only the presentation differs. Desktop
  // rendering below is untouched.
  if (isMobile) {
    return (
      <MobileImageLibrary
        images={images}
        filteredImages={filteredImages}
        loading={loading}
        uploading={uploading}
        search={search}
        onSearch={setSearch}
        filterSource={filterSource}
        onFilterSource={setFilterSource}
        selectedUrl={selectedUrl}
        onSelect={setSelectedUrl}
        onUpload={handleUpload}
        onCopyUrl={handleCopyUrl}
        isSelectionMode={isSelectionMode}
        onSelectImage={onSelectImage}
      />
    );
  }

  // ── Selection mode ─────────────────────────────────────────────────────────
  // A picker, not the management surface: the upload dropzone, view-options bar
  // and per-card action footers are all management chrome that was squeezing
  // the grid inside a dialog. Same data, same mediaService calls, same handlers
  // — a layout built for choosing one image quickly out of a few hundred.
  if (isSelectionMode && onSelectImage) {
    const thumbMin =
      gridSize === "sm" ? "120px" : gridSize === "md" ? "160px" : "210px";

    return (
      <div className="flex flex-col h-full min-h-0 gap-3">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by filename…"
              className="pl-9 h-9 text-sm bg-slate-50 border-slate-200 transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-red-300"
            />
          </div>
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(["all", "storage", "database"] as const).map(src => (
              <button
                key={src}
                type="button"
                aria-pressed={filterSource === src}
                onClick={() => setFilterSource(src)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${
                  filterSource === src
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {src === "all"
                  ? `All (${images.length})`
                  : src === "storage"
                    ? "Storage"
                    : "Drive"}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(["sm", "md", "lg"] as const).map(s => (
              <button
                key={s}
                type="button"
                aria-pressed={gridSize === s}
                title={`${s === "sm" ? "Small" : s === "md" ? "Medium" : "Large"} thumbnails`}
                onClick={() => setGridSize(s)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${
                  gridSize === s
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Dropzone. One compact row rather than the standalone library's
            120px panel — in a picker the grid is what needs the height — but
            the same handlers, so drag-drop and Browse behave identically. */}
        <label
          onDragOver={e => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex-shrink-0 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-3 py-2.5 text-xs cursor-pointer transition-colors duration-150 ${
            dragOver
              ? "border-red-500 bg-red-50/60 text-red-700"
              : "border-slate-200 bg-white text-slate-600 hover:border-red-400 hover:bg-slate-50/60"
          }`}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading || busy}
          />
          {uploading || busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-red-600" />
              <span className="font-semibold">Uploading…</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 text-slate-400" />
              <span className="font-semibold">
                Drag &amp; drop images here or{" "}
                <span className="text-red-600 underline underline-offset-2">
                  Browse
                </span>
              </span>
              <span className="text-slate-400 truncate">
                {uploadHint ?? "PNG, JPG or WebP"}
              </span>
            </>
          )}
        </label>

        {skuHint && skuMatchCount > 0 && (
          <p className="text-xs text-slate-500 flex-shrink-0 -mt-1">
            <span className="font-semibold text-emerald-700">
              {skuMatchCount}
            </span>{" "}
            file{skuMatchCount === 1 ? "" : "s"} match SKU{" "}
            <span className="font-mono font-semibold">{skuHint}</span> — shown
            first.
          </p>
        )}

        {/* Grid + preview */}
        <div className="flex-1 min-h-0 flex gap-3">
          {loading ? (
            <div
              className="flex-1 grid gap-3 auto-rows-max content-start overflow-y-auto"
              style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(${thumbMin}, 1fr))`,
              }}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl bg-slate-100 animate-pulse"
                />
              ))}
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 border-2 border-dashed border-slate-200 rounded-xl">
              <ImageIcon className="w-10 h-10 text-slate-300 mb-3" />
              <p className="font-semibold text-slate-700 text-sm">
                {search
                  ? `Nothing matches “${search}”`
                  : filterSource === "storage"
                    ? "No files uploaded to storage yet"
                    : filterSource === "database"
                      ? "No Drive-hosted images on any product yet"
                      : "The library is empty"}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                {search
                  ? "Filenames are matched as you type — try a shorter fragment, or clear the search to see everything."
                  : "Close this dialog and use Upload to add an image for this product; it will be stored under its SKU."}
              </p>
              {search && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 h-8 text-xs"
                  onClick={() => setSearch("")}
                >
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <div
              ref={gridRef}
              role="listbox"
              aria-label="Library images"
              tabIndex={0}
              onKeyDown={handleGridKeyDown}
              // auto-rows-max pins each row to its content. Without it the
              // grid's default align-content stretched 34 zero-base rows to
              // fill its height — 4.6px each — and every card overflowed its
              // row and overlapped the next.
              className="flex-1 min-w-0 grid gap-3 auto-rows-max content-start overflow-y-auto overflow-x-hidden pr-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(${thumbMin}, 1fr))`,
              }}
            >
              {filteredImages.map((img, i) => {
                const isSelected = selectedUrl === img.url;
                const matches = isSkuMatch(img.name);
                return (
                  // A <div>, not a <button>: inside role="listbox" the child
                  // must be role="option" (a button is invalid there), and
                  // Chrome will not derive a <button>'s intrinsic height from
                  // an aspect-ratio child — the card collapsed to 5px and
                  // clipped every thumbnail. Keyboard handling lives on the
                  // grid container, so nothing is lost by not being a button.
                  <div
                    key={img.url + i}
                    data-idx={i}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      setSelectedUrl(img.url);
                      setFocusIndex(i);
                    }}
                    onDoubleClick={() => onSelectImage(img.url)}
                    // `min-h-fit` is load-bearing, not cosmetic. A grid item's
                    // automatic minimum size only applies while `overflow` is
                    // visible; `overflow-hidden` (needed to clip the thumbnail
                    // to the rounded corner) drops min-height to 0, and the
                    // rows collapsed to 4.6px with the correctly-sized thumb
                    // overflowing them. This restores the intrinsic minimum.
                    className={`group relative flex flex-col min-h-fit rounded-xl border bg-white overflow-hidden text-left cursor-pointer transition-[border-color,box-shadow,transform] duration-150 ${
                      isSelected
                        ? "border-red-500 ring-2 ring-red-300 shadow-md"
                        : "border-slate-200 hover:border-slate-300 hover:shadow-sm motion-safe:hover:-translate-y-0.5"
                    }`}
                  >
                    {/* Explicit height rather than `aspect-square`: the thumb's
                        height would otherwise depend on a column width that is
                        itself being resolved, and the row collapsed to ~5px
                        with the (correctly sized) thumb overflowing it. The
                        track minimum is this same value, so the box stays
                        square-ish and object-contain handles the rest. */}
                    <div
                      style={{ height: thumbMin }}
                      className="w-full flex-shrink-0 bg-slate-50 flex items-center justify-center overflow-hidden p-2"
                    >
                      <img
                        src={img.url}
                        alt={img.name}
                        loading="lazy"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    {matches && (
                      <span className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm">
                        Matches SKU
                      </span>
                    )}
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 bg-red-600 text-white rounded-full p-1 shadow-md">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                    <p
                      className="px-2 py-1.5 text-[11px] font-medium text-slate-700 truncate border-t border-slate-100"
                      title={img.name}
                    >
                      {img.name.replace(/\.[^.]+$/, "")}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Preview — commit deliberately, rather than the first click winning */}
          <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
            {previewImage ? (
              <>
                <div className="flex-1 min-h-0 flex items-center justify-center p-3">
                  <img
                    src={previewImage.url}
                    alt={previewImage.name}
                    className="max-w-full max-h-full object-contain rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div className="p-3 border-t border-slate-200 bg-white space-y-1">
                  <p
                    className="text-xs font-semibold text-slate-800 break-all line-clamp-2"
                    title={previewImage.name}
                  >
                    {previewImage.name}
                  </p>
                  <p className="text-caption text-slate-400">
                    {previewImage.source === "storage" ? "Storage" : "Drive"}
                    {previewImage.size
                      ? ` · ${formatBytes(previewImage.size)}`
                      : ""}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 text-slate-400">
                <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-500">
                  Nothing selected
                </p>
                <p className="text-caption mt-1">
                  Click an image to preview it here before using it.
                </p>
              </div>
            )}
          </aside>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 flex-shrink-0 border-t border-slate-200 pt-3">
          <p className="text-xs text-slate-400 truncate">
            {filteredImages.length.toLocaleString()} image
            {filteredImages.length === 1 ? "" : "s"} · arrows to move, Enter to
            use, Esc to close
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onCancel && (
              <Button
                size="sm"
                variant="outline"
                className="h-9"
                onClick={onCancel}
              >
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              disabled={!selectedUrl}
              onClick={() => selectedUrl && onSelectImage(selectedUrl)}
              className="h-9 px-4 bg-red-600 hover:bg-red-700 text-white gap-1.5 transition-colors duration-150"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Use this image
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Standalone Mode Header ────────────────────────────────────────── */}
      {!isSelectionMode && (
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Image Library</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Manage all product images, Drive links, and storage files in one
            central library.
          </p>
        </div>
      )}

      {/* ── Upload Zone & Filters ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Upload dropzone */}
        <div className="md:col-span-2">
          <label
            onDragOver={e => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all h-[120px] ${
              dragOver
                ? "border-red-500 bg-red-50/50"
                : "border-slate-200 hover:border-red-400 bg-white hover:bg-slate-50/30"
            }`}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
              disabled={uploading}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-1.5">
                <Loader2 className="w-6 h-6 animate-spin text-red-600" />
                <span className="text-xs font-semibold text-slate-600">
                  Uploading images...
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
                  Supports PNG, JPG, WebP. Auto-compressed to 800px.
                </span>
              </>
            )}
          </label>
        </div>

        {/* Quick Filters */}
        <Card className="p-4 border-slate-200 shadow-sm flex flex-col justify-center space-y-3 bg-white">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search images by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterSource("all")}
              className={`flex-1 text-[11px] py-1 px-2 rounded-lg font-medium transition-all ${
                filterSource === "all"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "text-slate-500 hover:bg-slate-100 border border-transparent"
              }`}
            >
              All ({images.length})
            </button>
            <button
              onClick={() => setFilterSource("storage")}
              className={`flex-1 text-[11px] py-1 px-2 rounded-lg font-medium transition-all ${
                filterSource === "storage"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "text-slate-500 hover:bg-slate-100 border border-transparent"
              }`}
            >
              Storage
            </button>
            <button
              onClick={() => setFilterSource("database")}
              className={`flex-1 text-[11px] py-1 px-2 rounded-lg font-medium transition-all ${
                filterSource === "database"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "text-slate-500 hover:bg-slate-100 border border-transparent"
              }`}
            >
              Drive / DB
            </button>
          </div>
        </Card>
      </div>

      {/* ── Image Selection Mode Actions ─────────────────────────────────── */}
      {isSelectionMode && onSelectImage && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <span className="text-xs font-semibold text-amber-800">
            {selectedUrl
              ? "1 image selected"
              : "Please select an image below to use"}
          </span>
          <Button
            size="sm"
            disabled={!selectedUrl}
            onClick={() => selectedUrl && onSelectImage(selectedUrl)}
            className="h-8 px-4 bg-amber-500 hover:bg-amber-600 text-white gap-1.5 text-xs font-bold"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Use Selected Image
          </Button>
        </div>
      )}

      {/* ── Toolbar (Size & Fit controls) ────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span>View Options:</span>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {/* Grid Size buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Size:</span>
            <div className="bg-slate-200/50 p-0.5 rounded-lg flex items-center border border-slate-300/20">
              <button
                type="button"
                onClick={() => setGridSize("sm")}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  gridSize === "sm"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Small
              </button>
              <button
                type="button"
                onClick={() => setGridSize("md")}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  gridSize === "md"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Medium
              </button>
              <button
                type="button"
                onClick={() => setGridSize("lg")}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  gridSize === "lg"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Large
              </button>
            </div>
          </div>

          {/* Image Fit buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Fit:</span>
            <div className="bg-slate-200/50 p-0.5 rounded-lg flex items-center border border-slate-300/20">
              <button
                type="button"
                onClick={() => setImageFit("contain")}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  imageFit === "contain"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Show entire image without cropping"
              >
                Fit
              </button>
              <button
                type="button"
                onClick={() => setImageFit("cover")}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  imageFit === "cover"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Crop image to fill square"
              >
                Fill
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Image Grid ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-2" />
          <span className="text-slate-500 text-xs">Loading media files...</span>
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border-2 border-dashed border-slate-200 rounded-xl text-center">
          <ImageIcon className="w-12 h-12 text-slate-300 mb-2" />
          <p className="font-semibold text-slate-700 text-sm">
            No images found
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload images above to build your gallery.
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-3.5 transition-all duration-300 ${
            gridSize === "sm"
              ? "grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2"
              : gridSize === "md"
                ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3"
                : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          }`}
        >
          {filteredImages.map((img, i) => {
            const isSelected = selectedUrl === img.url;
            const isStorage = img.source === "storage";

            return (
              <div
                key={img.url + i}
                onClick={() => setSelectedUrl(img.url)}
                onDoubleClick={() => {
                  if (isSelectionMode && onSelectImage) {
                    onSelectImage(img.url);
                  }
                }}
                className={`relative group rounded-xl border overflow-hidden bg-white cursor-pointer transition-all flex flex-col ${
                  isSelected
                    ? "ring-2 ring-red-500 border-red-500 shadow-md scale-[0.98]"
                    : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                {/* Image Preview */}
                <div className="aspect-square bg-slate-50 relative overflow-hidden flex items-center justify-center">
                  <img
                    src={img.url}
                    alt={img.name}
                    className={`select-none pointer-events-none transition-all duration-300 ${
                      imageFit === "cover"
                        ? "w-full h-full object-cover"
                        : "w-full h-full object-contain p-2.5 bg-slate-100/30"
                    }`}
                    loading="lazy"
                  />
                  {/* Source Badge */}
                  <span
                    className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shadow-sm ${
                      isStorage ? "bg-red-500" : "bg-slate-700"
                    }`}
                  >
                    {isStorage ? "Storage" : "Drive"}
                  </span>

                  {/* Selected Tick */}
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 bg-red-600 text-white rounded-full p-1 shadow-md">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}

                  {/* Size info for Storage */}
                  {isStorage && img.size && (
                    <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded font-mono">
                      {formatBytes(img.size)}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="p-2.5 flex-1 flex flex-col justify-between">
                  <div className="space-y-0.5">
                    <p
                      className="text-[11px] font-bold text-slate-800 line-clamp-2 w-full text-left leading-tight break-all"
                      title={img.name}
                    >
                      {img.name.replace(/\.[^.]+$/, "")}
                    </p>
                    {isStorage && img.size && (
                      <p className="text-[9px] text-slate-400 font-mono text-left">
                        {formatBytes(img.size)}
                      </p>
                    )}
                  </div>

                  {isSelectionMode && onSelectImage ? (
                    <Button
                      size="sm"
                      onClick={e => {
                        e.stopPropagation();
                        onSelectImage(img.url);
                      }}
                      className="w-full mt-2 h-7 text-[10px] font-extrabold bg-red-600 hover:bg-red-700 text-white transition-all shadow-xs border-0 rounded-lg flex items-center justify-center shrink-0"
                    >
                      Use Image
                    </Button>
                  ) : (
                    /* Actions overlay / footer */
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleCopyUrl(img.url);
                        }}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors"
                        title="Copy URL"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={img.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors"
                        title="Open in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
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
