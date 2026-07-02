import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, ImageIcon, CornerDownLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { productService } from "@/lib/productService";
import { normalizeImageUrl } from "@/lib/imageUtils";
import { Product } from "@/lib/supabase";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Cmd+K / "/" quick-open: search the whole catalogue (drafts included) by
// name or SKU and jump straight to the product editor. Search itself lives in
// productService.searchAdmin — this component only owns dialog/list state.
// cmdk provides the arrow-key + Enter navigation; shouldFilter is off because
// results are already filtered server-side.
export default function CommandPalette({
  open,
  onOpenChange,
}: CommandPaletteProps) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
  }, [open]);

  // Debounced server search.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        setResults(await productService.searchAdmin(q, 8));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  const openProduct = (id: string) => {
    onOpenChange(false);
    setLocation(`/admin-v2/products/${id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Search products</DialogTitle>
        <DialogDescription>
          Search the catalogue by name or SKU
        </DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg top-[20%] translate-y-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search products by name or SKU…"
          />
          <CommandList>
            {searching && (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Searching…
              </div>
            )}
            {!searching && query.trim() && results.length === 0 && (
              <CommandEmpty>No products match “{query.trim()}”.</CommandEmpty>
            )}
            {!query.trim() && (
              <div className="py-6 text-center text-xs text-slate-400">
                Type to search all {""}products — drafts included.
              </div>
            )}
            {!searching &&
              results.map(p => {
                const img = normalizeImageUrl(p.image_url);
                const published = p.status === "published";
                return (
                  <CommandItem
                    key={p.id}
                    value={p.id}
                    onSelect={() => openProduct(p.id)}
                    className="gap-3 cursor-pointer"
                  >
                    <div className="w-8 h-8 shrink-0 rounded border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                      {img ? (
                        <img
                          src={img}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-3.5 h-3.5 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate text-sm font-medium text-slate-800">
                          {p.name}
                        </span>
                        {p.variant_label && (
                          <span className="shrink-0 rounded bg-indigo-50 px-1 py-px text-[10px] font-semibold text-indigo-600 border border-indigo-100">
                            {p.variant_label}
                          </span>
                        )}
                      </div>
                      {p.sku && (
                        <p className="truncate text-[11px] font-mono text-slate-400">
                          {p.sku}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-1.5 py-px text-[10px] font-bold ${
                        published
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {published ? "Published" : "Draft"}
                    </span>
                    <CornerDownLeft className="w-3 h-3 text-slate-300 shrink-0" />
                  </CommandItem>
                );
              })}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
