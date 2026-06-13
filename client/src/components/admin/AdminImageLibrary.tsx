import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Upload, Search, Trash2, Loader2, ImageIcon, ExternalLink, Check, Copy, Info, CheckSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { mediaService, MediaImage } from '@/lib/productService';
import { autoResizeImage, formatBytes } from '@/lib/imageUtils';

interface Props {
  onSelectImage?: (url: string) => void;
  isSelectionMode?: boolean;
}

export default function AdminImageLibrary({ onSelectImage, isSelectionMode = false }: Props) {
  const [images, setImages] = useState<MediaImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<'all' | 'storage' | 'database'>('all');
  const [dragOver, setDragOver] = useState(false);
  const [gridSize, setGridSize] = useState<'sm' | 'md' | 'lg'>('lg');
  const [imageFit, setImageFit] = useState<'cover' | 'contain'>('contain');

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const list = await mediaService.listAllImages();
      setImages(list);
    } catch {
      toast.error('Failed to load images');
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
      if (!file.type.startsWith('image/')) {
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
            console.log(`Auto-resized ${file.name} · saved ${formatBytes(saved)}`);
          }
        } catch (err) {
          console.warn('Image compression failed, uploading original:', err);
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
      toast.success(`${uploadedCount} image${uploadedCount > 1 ? 's' : ''} uploaded successfully!`);
      loadImages();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleUpload(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    handleUpload(files);
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Image URL copied to clipboard!');
  };

  // Filtered images
  const filteredImages = images.filter(img => {
    const matchesSearch = img.name.toLowerCase().includes(search.toLowerCase()) || 
                          img.url.toLowerCase().includes(search.toLowerCase());
    
    if (filterSource === 'all') return matchesSearch;
    return matchesSearch && img.source === filterSource;
  });

  return (
    <div className="space-y-4">
      {/* ── Standalone Mode Header ────────────────────────────────────────── */}
      {!isSelectionMode && (
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Image Library</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Manage all product images, Drive links, and storage files in one central library.
          </p>
        </div>
      )}

      {/* ── Upload Zone & Filters ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Upload dropzone */}
        <div className="md:col-span-2">
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all h-[120px] ${
              dragOver 
                ? 'border-red-500 bg-red-50/50' 
                : 'border-slate-200 hover:border-red-400 bg-white hover:bg-slate-50/30'
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
                <span className="text-xs font-semibold text-slate-600">Uploading images...</span>
              </div>
            ) : (
              <>
                <Upload className="w-6 h-6 text-slate-400 mb-1" />
                <span className="text-xs font-semibold text-slate-700">
                  Drag &amp; drop images here or <span className="text-red-600 hover:underline">Browse</span>
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">Supports PNG, JPG, WebP. Auto-compressed to 800px.</span>
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
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterSource('all')}
              className={`flex-1 text-[11px] py-1 px-2 rounded-lg font-medium transition-all ${
                filterSource === 'all' 
                  ? 'bg-red-50 text-red-700 border border-red-200' 
                  : 'text-slate-500 hover:bg-slate-100 border border-transparent'
              }`}
            >
              All ({images.length})
            </button>
            <button
              onClick={() => setFilterSource('storage')}
              className={`flex-1 text-[11px] py-1 px-2 rounded-lg font-medium transition-all ${
                filterSource === 'storage' 
                  ? 'bg-red-50 text-red-700 border border-red-200' 
                  : 'text-slate-500 hover:bg-slate-100 border border-transparent'
              }`}
            >
              Storage
            </button>
            <button
              onClick={() => setFilterSource('database')}
              className={`flex-1 text-[11px] py-1 px-2 rounded-lg font-medium transition-all ${
                filterSource === 'database' 
                  ? 'bg-red-50 text-red-700 border border-red-200' 
                  : 'text-slate-500 hover:bg-slate-100 border border-transparent'
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
            {selectedUrl ? '1 image selected' : 'Please select an image below to use'}
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
                onClick={() => setGridSize('sm')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  gridSize === 'sm' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Small
              </button>
              <button
                type="button"
                onClick={() => setGridSize('md')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  gridSize === 'md' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Medium
              </button>
              <button
                type="button"
                onClick={() => setGridSize('lg')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  gridSize === 'lg' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
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
                onClick={() => setImageFit('contain')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  imageFit === 'contain' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Show entire image without cropping"
              >
                Fit
              </button>
              <button
                type="button"
                onClick={() => setImageFit('cover')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  imageFit === 'cover' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
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
          <p className="font-semibold text-slate-700 text-sm">No images found</p>
          <p className="text-xs text-slate-400 mt-0.5">Upload images above to build your gallery.</p>
        </div>
      ) : (
        <div className={`grid gap-3.5 transition-all duration-300 ${
          gridSize === 'sm' ? 'grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2' :
          gridSize === 'md' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3' :
          'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
        }`}>
          {filteredImages.map((img, i) => {
            const isSelected = selectedUrl === img.url;
            const isStorage = img.source === 'storage';
            
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
                    ? 'ring-2 ring-red-500 border-red-500 shadow-md scale-[0.98]' 
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                {/* Image Preview */}
                <div className="aspect-square bg-slate-50 relative overflow-hidden flex items-center justify-center">
                  <img
                    src={img.url}
                    alt={img.name}
                    className={`select-none pointer-events-none transition-all duration-300 ${
                      imageFit === 'cover' 
                        ? 'w-full h-full object-cover' 
                        : 'w-full h-full object-contain p-2.5 bg-slate-100/30'
                    }`}
                    loading="lazy"
                  />
                  {/* Source Badge */}
                  <span className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shadow-sm ${
                    isStorage ? 'bg-red-500' : 'bg-slate-700'
                  }`}>
                    {isStorage ? 'Storage' : 'Drive'}
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
                    <p className="text-[11px] font-bold text-slate-800 line-clamp-2 w-full text-left leading-tight break-all" title={img.name}>
                      {img.name.replace(/\.[^.]+$/, '')}
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
                      onClick={(e) => { e.stopPropagation(); onSelectImage(img.url); }}
                      className="w-full mt-2 h-7 text-[10px] font-extrabold bg-red-600 hover:bg-red-700 text-white transition-all shadow-xs border-0 rounded-lg flex items-center justify-center shrink-0"
                    >
                      Use Image
                    </Button>
                  ) : (
                    /* Actions overlay / footer */
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleCopyUrl(img.url); }}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors"
                        title="Copy URL"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={img.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
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
