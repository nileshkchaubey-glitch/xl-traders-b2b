import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { mediaService, MediaImage } from "@/lib/productService";
import { autoResizeImage, formatBytes } from "@/lib/imageUtils";

export type ImageSourceFilter = "all" | "storage" | "database";

// Thin wrapper around mediaService (Supabase Storage + DB image URLs) — all
// bucket/data logic stays in the existing service; this hook only owns the
// admin-v2 grid's local state (list, search, source filter, upload).
export function useImageLibrary() {
  const [images, setImages] = useState<MediaImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<ImageSourceFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setImages(await mediaService.listAllImages());
    } catch {
      toast.error("Failed to load images");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upload = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter(f => f.type.startsWith("image/"));
      if (imageFiles.length !== files.length) {
        toast.error("Some files were skipped — images only");
      }
      if (!imageFiles.length) return;

      setUploading(true);
      let uploaded = 0;
      for (const file of imageFiles) {
        try {
          // Reuse the existing auto-resize path (800px cap) before upload.
          let toUpload = file;
          try {
            const resized = await autoResizeImage(file);
            toUpload = resized.file;
            const saved = resized.originalSize - resized.newSize;
            if (saved > 1024) {
              console.log(`Auto-resized ${file.name} · saved ${formatBytes(saved)}`);
            }
          } catch {
            // fall back to the original file if resize fails
          }
          const url = await mediaService.uploadGlobalImage(toUpload);
          if (url) uploaded++;
        } catch {
          toast.error(`Failed to upload ${file.name}`);
        }
      }
      setUploading(false);
      if (uploaded > 0) {
        toast.success(
          `${uploaded} image${uploaded > 1 ? "s" : ""} uploaded successfully`
        );
        load();
      }
    },
    [load]
  );

  const filtered = images.filter(img => {
    const q = search.toLowerCase();
    const matchesSearch =
      img.name.toLowerCase().includes(q) || img.url.toLowerCase().includes(q);
    if (source === "all") return matchesSearch;
    return matchesSearch && img.source === source;
  });

  return {
    images,
    filtered,
    loading,
    uploading,
    search,
    setSearch,
    source,
    setSource,
    upload,
    reload: load,
  };
}
