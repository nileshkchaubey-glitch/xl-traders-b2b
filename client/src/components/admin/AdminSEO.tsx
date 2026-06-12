import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Search, Link2, Type, Loader2, Edit2, Check, X, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, Category } from '@/lib/supabase';
import { categoryService } from '@/lib/productService';
import {
  productCompleteness, completenessColor, slugify, metaTitleFor,
} from '@/lib/catalogHealth';

const PAGE_SIZE = 50;

interface SeoProduct {
  id: string;
  name: string;
  slug: string | null;
  meta_title: string | null;
  meta_description: string | null;
  image_url: string | null;
  price: number | null;
  category_id: string | null;
}

interface RowDraft {
  slug: string;
  meta_title: string;
  meta_description: string;
}

// Fetch every product in 1000-row pages (PostgREST caps single responses).
async function fetchAllSeoProducts(): Promise<SeoProduct[]> {
  const all: SeoProduct[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug, meta_title, meta_description, image_url, price, category_id')
      .order('name')
      .range(from, from + 999);
    if (error) throw error;
    all.push(...((data as SeoProduct[]) ?? []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return all;
}

export default function AdminSEO() {
  const [products, setProducts] = useState<SeoProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [columnsMissing, setColumnsMissing] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Inline row editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RowDraft>({ slug: '', meta_title: '', meta_description: '' });
  const [rowSaving, setRowSaving] = useState(false);

  // Bulk generation
  const [bulkRunning, setBulkRunning] = useState<'slugs' | 'titles' | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setColumnsMissing(false);
      const [prods, cats] = await Promise.all([fetchAllSeoProducts(), categoryService.getAll()]);
      setProducts(prods);
      setCategories(cats);
    } catch (error: any) {
      // 42703 = undefined column — the SEO migration hasn't been run yet.
      if (error?.code === '42703') setColumnsMissing(true);
      else toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  const hasFetched = useRef(false);
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    load();
  }, [load]);

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.slug ?? '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search]);

  // ── Inline edit ─────────────────────────────────────────────────────────────
  const startEdit = (p: SeoProduct) => {
    setEditingId(p.id);
    setDraft({
      slug: p.slug ?? '',
      meta_title: p.meta_title ?? '',
      meta_description: p.meta_description ?? '',
    });
  };

  const saveEdit = async () => {
    if (!editingId || rowSaving) return;
    setRowSaving(true);
    try {
      const update = {
        slug: draft.slug.trim() || null,
        meta_title: draft.meta_title.trim() || null,
        meta_description: draft.meta_description.trim() || null,
      };
      const { error } = await supabase.from('products').update(update).eq('id', editingId);
      if (error) throw error;
      setProducts((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...update } : p)));
      setEditingId(null);
      toast.success('SEO fields saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setRowSaving(false);
    }
  };

  // ── Bulk generators (fill empty fields only, like Catalog Studio) ──────────
  const bulkGenerateSlugs = async () => {
    const targets = products.filter((p) => !p.slug);
    if (!targets.length) { toast.success('All products already have slugs'); return; }
    if (!confirm(`Auto-generate slugs for ${targets.length} products without one?`)) return;
    setBulkRunning('slugs');
    try {
      const taken = new Set(products.map((p) => p.slug).filter(Boolean) as string[]);
      const updates: Array<{ id: string; slug: string }> = [];
      for (const p of targets) {
        let slug = slugify(p.name) || `product-${p.id.slice(0, 8)}`;
        let candidate = slug;
        for (let n = 2; taken.has(candidate); n++) candidate = `${slug}-${n}`;
        taken.add(candidate);
        updates.push({ id: p.id, slug: candidate });
      }
      let ok = 0;
      for (let i = 0; i < updates.length; i += 20) {
        const chunk = updates.slice(i, i + 20);
        const results = await Promise.all(
          chunk.map((u) => supabase.from('products').update({ slug: u.slug }).eq('id', u.id))
        );
        ok += results.filter((r) => !r.error).length;
      }
      const byId = new Map(updates.map((u) => [u.id, u.slug]));
      setProducts((prev) => prev.map((p) => (byId.has(p.id) ? { ...p, slug: byId.get(p.id)! } : p)));
      toast.success(`${ok} slugs generated`);
    } catch {
      toast.error('Bulk slug generation failed');
    } finally {
      setBulkRunning(null);
    }
  };

  const bulkGenerateTitles = async () => {
    const targets = products.filter((p) => !p.meta_title);
    if (!targets.length) { toast.success('All products already have meta titles'); return; }
    if (!confirm(`Auto-generate meta titles for ${targets.length} products without one?`)) return;
    setBulkRunning('titles');
    try {
      const updates = targets.map((p) => ({
        id: p.id,
        meta_title: metaTitleFor(p.name, categoryName(p.category_id)),
      }));
      let ok = 0;
      for (let i = 0; i < updates.length; i += 20) {
        const chunk = updates.slice(i, i + 20);
        const results = await Promise.all(
          chunk.map((u) => supabase.from('products').update({ meta_title: u.meta_title }).eq('id', u.id))
        );
        ok += results.filter((r) => !r.error).length;
      }
      const byId = new Map(updates.map((u) => [u.id, u.meta_title]));
      setProducts((prev) => prev.map((p) => (byId.has(p.id) ? { ...p, meta_title: byId.get(p.id)! } : p)));
      toast.success(`${ok} meta titles generated`);
    } catch {
      toast.error('Bulk meta title generation failed');
    } finally {
      setBulkRunning(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (columnsMissing) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SEO</h1>
          <p className="text-slate-400 text-xs mt-0.5">Slugs, meta titles and descriptions</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 space-y-2">
          <p className="font-semibold">SEO columns missing in Supabase</p>
          <p>
            The <code className="font-mono text-xs">products</code> table doesn't have{' '}
            <code className="font-mono text-xs">slug</code>, <code className="font-mono text-xs">meta_title</code> or{' '}
            <code className="font-mono text-xs">meta_description</code> columns yet. Run{' '}
            <code className="font-mono text-xs">sql/05-product-seo-columns.sql</code> in the Supabase SQL editor, then refresh.
          </p>
          <Button variant="outline" size="sm" onClick={load} className="gap-2 mt-1">
            <RefreshCw className="w-4 h-4" />Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">SEO</h1>
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
              {products.length.toLocaleString()}
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            {products.filter((p) => !p.slug).length} missing slug · {products.filter((p) => !p.meta_title).length} missing meta title
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={bulkGenerateSlugs}
            disabled={!!bulkRunning || loading}
            className="gap-2"
            title="Generate slugs from product names (only fills empty ones)"
          >
            {bulkRunning === 'slugs' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Auto-generate slugs
          </Button>
          <Button
            variant="outline"
            onClick={bulkGenerateTitles}
            disabled={!!bulkRunning || loading}
            className="gap-2"
            title="Generate meta titles from name + category (only fills empty ones)"
          >
            {bulkRunning === 'titles' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Type className="w-4 h-4" />}
            Auto-generate meta titles
          </Button>
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2" title="Reload from database">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Search by name or slug…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Product</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide w-56">Slug</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide w-56">Meta Title</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide w-64">Meta Description</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide w-20">Score</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading products…
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">No products found</td>
                </tr>
              ) : pageItems.map((p) => {
                const { score, missing } = productCompleteness(p);
                const isEditing = editingId === p.id;
                return (
                  <tr key={p.id} className={`border-b border-slate-100 transition-colors ${isEditing ? 'bg-amber-50/50' : 'hover:bg-slate-50/50'}`}>
                    <td className="px-3 py-2 max-w-[220px]">
                      <p className="font-medium text-slate-900 truncate" title={p.name}>{p.name}</p>
                      <p className="text-xs text-slate-400 truncate">{categoryName(p.category_id) ?? '— uncategorised —'}</p>
                    </td>
                    {isEditing ? (
                      <>
                        <td className="px-3 py-2 align-top">
                          <Input
                            value={draft.slug}
                            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                            placeholder="10-inch-pizza-box"
                            className="h-8 text-xs font-mono"
                            disabled={rowSaving}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Input
                            value={draft.meta_title}
                            onChange={(e) => setDraft({ ...draft, meta_title: e.target.value })}
                            placeholder="Product — Category | XL Traders"
                            className="h-8 text-xs"
                            disabled={rowSaving}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Textarea
                            value={draft.meta_description}
                            onChange={(e) => setDraft({ ...draft, meta_description: e.target.value })}
                            placeholder="150-character summary for search results"
                            rows={2}
                            className="text-xs"
                            disabled={rowSaving}
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2">
                          {p.slug
                            ? <span className="text-xs font-mono text-slate-600 break-all">{p.slug}</span>
                            : <span className="text-xs text-slate-300 italic">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          {p.meta_title
                            ? <span className="text-xs text-slate-600 line-clamp-2">{p.meta_title}</span>
                            : <span className="text-xs text-slate-300 italic">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          {p.meta_description
                            ? <span className="text-xs text-slate-500 line-clamp-2">{p.meta_description}</span>
                            : <span className="text-xs text-slate-300 italic">—</span>}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${completenessColor(score)}`}
                        title={missing.length ? `Missing: ${missing.join(', ')}` : 'Complete'}
                      >
                        {score}%
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Button size="sm" onClick={saveEdit} disabled={rowSaving} className="h-7 px-2 gap-1 bg-green-600 hover:bg-green-700">
                            {rowSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Save
                          </Button>
                          <button
                            onClick={() => setEditingId(null)}
                            disabled={rowSaving}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(p)}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-500 flex items-center gap-1 text-xs font-medium"
                          title="Edit SEO fields"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-sm text-slate-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="gap-1">
                <ChevronLeft className="w-4 h-4" />Prev
              </Button>
              <span className="text-sm font-medium text-slate-700 px-2">{page} / {totalPages}</span>
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="gap-1">
                Next<ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
