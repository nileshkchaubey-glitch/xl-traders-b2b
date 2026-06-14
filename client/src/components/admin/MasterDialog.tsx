import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Loader2, Star, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import CategoryCombobox from '@/components/admin/CategoryCombobox';
import { masterService } from '@/lib/masterService';
import { generateDescription } from '@/lib/aiService';
import { Category } from '@/lib/supabase';

interface MasterDialogProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  onSuccess: () => void;
}

export default function MasterDialog({ open, onClose, categories, onSuccess }: MasterDialogProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isManualSlug, setIsManualSlug] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Images state
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-generate slug from name
  useEffect(() => {
    if (!isManualSlug) {
      const cleanName = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric
        .replace(/[\s-]+/g, '-'); // Replace spaces and hyphens with single hyphen
      setSlug(cleanName);
    }
  }, [name, isManualSlug]);

  // Handle files selection
  const handleFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const validFiles: File[] = [];
    const newPreviews: string[] = [];

    // Max 10 files check
    const spaceLeft = 10 - files.length;
    if (spaceLeft <= 0) {
      toast.warning('Max 10 images allowed');
      return;
    }

    const filesToProcess = Array.from(selectedFiles).slice(0, spaceLeft);

    filesToProcess.forEach(file => {
      if (file.type.startsWith('image/')) {
        validFiles.push(file);
        newPreviews.push(URL.createObjectURL(file));
      }
    });

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    
    // Revoke object URL to avoid memory leak
    URL.revokeObjectURL(previews[index]);
    setPreviews(prev => prev.filter((_, i) => i !== index));

    // Handle primary index adjustment
    if (primaryIndex === index) {
      setPrimaryIndex(0);
    } else if (primaryIndex > index) {
      setPrimaryIndex(prev => prev - 1);
    }
  };

  const handleAIGenerate = async () => {
    if (!name.trim()) {
      toast.error('Product Master Name is required for AI generation');
      return;
    }
    setGenerating(true);
    try {
      const selectedCategory = categories.find(c => c.id === categoryId);
      const categoryName = selectedCategory ? selectedCategory.name : '';
      const desc = await generateDescription(name.trim(), categoryName);
      setDescription(desc);
      toast.success('Description generated ✓');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to generate description');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Product Master Name is required');
      return;
    }
    if (!categoryId) {
      toast.error('Category is required');
      return;
    }

    setSubmitting(true);
    try {
      const finalSlug = slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const master = await masterService.createMaster({
        name: name.trim(),
        slug: finalSlug,
        category_id: categoryId,
        brand: brand.trim() || null,
        description: description.trim() || null,
        meta_title: metaTitle.trim() || null,
        meta_description: metaDescription.trim() || null,
        is_active: isActive,
      });

      if (files.length > 0) {
        await Promise.all(
          files.map((file, idx) =>
            masterService.uploadMasterImage(master.id, file, idx === primaryIndex)
          )
        );
      }

      toast.success('Master created ✓');
      onSuccess();
      onClose();

      // Reset Form State
      setName('');
      setSlug('');
      setIsManualSlug(false);
      setCategoryId('');
      setBrand('');
      setDescription('');
      setMetaTitle('');
      setMetaDescription('');
      setIsActive(true);
      setFiles([]);
      setPreviews([]);
      setPrimaryIndex(0);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to create product master');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-full h-full sm:max-w-2xl sm:h-auto rounded-none sm:rounded-2xl max-w-none p-0 overflow-hidden flex flex-col bg-white">
        <form onSubmit={handleSubmit} className="flex flex-col h-full sm:h-auto overflow-hidden">
          
          {/* Sticky Mobile Header */}
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10 flex-shrink-0 sm:static sm:border-0 sm:p-6 pb-2">
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">New Product Master</DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Create a master shell to group different product sizes/variants.
              </DialogDescription>
            </div>
            <button 
              type="button" 
              onClick={onClose} 
              className="text-slate-400 hover:text-slate-600 sm:hidden p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 sm:p-6 pt-0 max-h-[75vh]">
            
            {/* Name & Slug */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="master-name" className="text-xs font-semibold text-slate-700">
                  Product Master Name *
                </Label>
                <Input
                  id="master-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Hinged Container"
                  required
                  disabled={submitting}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="master-slug" className="text-xs font-semibold text-slate-700">
                  Slug (URL Keyword)
                </Label>
                <Input
                  id="master-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setIsManualSlug(true);
                  }}
                  placeholder="auto-generated-slug"
                  disabled={submitting}
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-slate-400 truncate">
                  Preview: <span className="font-mono bg-slate-50 px-1 py-0.5 rounded">/products/{slug || 'container'}</span>
                </p>
              </div>
            </div>

            {/* Category & Brand */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Category *</Label>
                <CategoryCombobox
                  categories={categories}
                  value={categoryId}
                  onChange={setCategoryId}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="master-brand" className="text-xs font-semibold text-slate-700">
                  Brand
                </Label>
                <Input
                  id="master-brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. XL Traders"
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="master-desc" className="text-xs font-semibold text-slate-700">
                  Description
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAIGenerate}
                  disabled={generating || submitting}
                  className="h-7 px-2 text-[10px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 flex items-center gap-1 border-indigo-200"
                >
                  {generating ? (
                    <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                  ) : (
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                  )}
                  AI Generate Description
                </Button>
              </div>
              <Textarea
                id="master-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details about quality, food safety, packaging type..."
                rows={3}
                disabled={submitting}
              />
            </div>

            {/* Images Upload Section */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Images Section (Max 10)</Label>
              
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center
                  ${dragOver 
                    ? 'border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-500/20' 
                    : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50'
                  }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleFiles(e.target.files)}
                  className="hidden"
                  disabled={submitting}
                />
                <Upload className="w-7 h-7 text-slate-400 mb-2" />
                <p className="text-xs font-bold text-slate-700">Drop images here or click to upload</p>
                <p className="text-[10px] text-slate-400 mt-1">Supports PNG, JPEG, WEBP. First image is auto-primary.</p>
              </div>

              {/* Previews Grid */}
              {previews.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pt-2">
                  {previews.map((src, index) => {
                    const isPrimary = index === primaryIndex;
                    return (
                      <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                        <img src={src} alt="Preview" className="w-full h-full object-cover" />
                        
                        {/* Overlay Controls */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPrimaryIndex(index)}
                            className={`p-1.5 rounded-full hover:scale-105 transition ${isPrimary ? 'bg-amber-500 text-white' : 'bg-white text-slate-600'}`}
                            title="Set as Primary Image"
                          >
                            <Star className="w-3.5 h-3.5 fill-current" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="p-1.5 rounded-full bg-white text-rose-600 hover:scale-105 transition"
                            title="Remove Image"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Primary Badge Indicator */}
                        {isPrimary && (
                          <span className="absolute top-1 left-1 bg-amber-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-0.5">
                            <Star className="w-2 h-2 fill-current" /> Primary
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SEO Section (Meta) */}
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide">SEO Metadata (Optional)</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="meta-title" className="text-xs font-semibold text-slate-700">
                    Meta Title (SEO)
                  </Label>
                  <Input
                    id="meta-title"
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    placeholder="Search engine title tag"
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="meta-desc" className="text-xs font-semibold text-slate-700">
                    Meta Description (SEO)
                  </Label>
                  <Textarea
                    id="meta-desc"
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    placeholder="Short description for Google search results page..."
                    rows={2}
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>

            {/* Active Toggle Switch */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <div>
                <Label htmlFor="master-active" className="text-xs font-semibold text-slate-700 block">
                  Active Status
                </Label>
                <span className="text-[10px] text-slate-500">Enable or disable viewing this product master group.</span>
              </div>
              <Switch
                id="master-active"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={submitting}
              />
            </div>

          </div>

          {/* Sticky Mobile / Bottom Desktop Footer */}
          <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex flex-col gap-2 z-10 flex-shrink-0 sm:static sm:border-0 sm:p-6 sm:pt-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Creating...
                </>
              ) : (
                'Create Master'
              )}
            </Button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}
