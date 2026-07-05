import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  FolderTree,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Lock,
  Check,
  X,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { categoryService } from "@/lib/productService";
import { slugify } from "@/lib/catalogHealth";
import { Category } from "@/lib/supabase";

const UNCATEGORIZED_SLUG = "uncategorized"; // sentinel — never delete/rename

// View + rename + create only. Deleting categories and moving products
// between categories are intentionally out of scope for this phase.
export default function CategoriesPage() {
  const [, setLocation] = useLocation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  // create state
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, productCounts] = await Promise.all([
        categoryService.getAllAdmin(),
        categoryService.getProductCounts(),
      ]);
      setCategories(cats);
      setCounts(productCounts);
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Bucket by group_name for the tree view; ungrouped last.
  const groups = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const cat of categories) {
      const key = cat.group_name?.trim() || "Ungrouped";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(cat);
    }
    const entries = Array.from(map.entries());
    entries.sort(([a], [b]) => {
      if (a === "Ungrouped") return 1;
      if (b === "Ungrouped") return -1;
      return a.localeCompare(b);
    });
    return entries;
  }, [categories]);

  const startRename = (cat: Category) => {
    setRenamingId(cat.id);
    setRenameDraft(cat.name);
  };

  const commitRename = async (cat: Category) => {
    const name = renameDraft.trim();
    setRenamingId(null);
    if (!name || name === cat.name) return;
    setSavingRename(true);
    try {
      // Rename changes the display name ONLY — the slug stays stable so
      // existing storefront URLs / imports keyed on it don't break.
      await categoryService.update(cat.id, { name });
      setCategories(prev =>
        prev.map(c => (c.id === cat.id ? { ...c, name } : c))
      );
      toast.success(`Renamed to "${name}"`);
    } catch {
      toast.error("Rename failed");
    } finally {
      setSavingRename(false);
    }
  };

  const createCategory = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Enter a category name");
      return;
    }
    const slug = slugify(name);
    if (categories.some(c => c.slug === slug)) {
      toast.error(`A category with slug "${slug}" already exists`);
      return;
    }
    setCreating(true);
    try {
      const created = await categoryService.create({
        name,
        slug,
        display_order: categories.length,
        is_active: true,
      } as Omit<Category, "id" | "created_at" | "updated_at">);
      setCategories(prev => [...prev, created]);
      setNewName("");
      toast.success(`"${name}" created`);
    } catch {
      toast.error("Failed to create category (slug may already exist)");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-slate-500" />
            <h1 className="text-xl font-bold text-slate-900">Categories</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
              {categories.length}
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            View, rename, and create. Deleting and re-assigning products stay
            in the full editor / bulk actions.
          </p>
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          title="Reload"
          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Create */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") createCategory();
          }}
          placeholder="New category name…"
          className="h-9 w-64 text-sm"
          disabled={creating}
        />
        {newName.trim() && (
          <span className="text-[11px] font-mono text-slate-400">
            slug: {slugify(newName)}
          </span>
        )}
        <Button
          size="sm"
          onClick={createCategory}
          disabled={creating || !newName.trim()}
          className="gap-1.5 bg-red-600 hover:bg-red-700 text-white"
        >
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Create
        </Button>
      </div>

      {/* Tree */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400 bg-white border border-slate-200 rounded-xl">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading categories…
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([groupName, cats]) => (
            <div
              key={groupName}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {groupName}
                  <span className="ml-2 font-medium text-slate-400 normal-case">
                    {cats.length} categor{cats.length === 1 ? "y" : "ies"}
                  </span>
                </h2>
              </div>
              {cats.map(cat => {
                const isSentinel = cat.slug === UNCATEGORIZED_SLUG;
                const renaming = renamingId === cat.id;
                const count = counts[cat.id] ?? 0;
                return (
                  <div
                    key={cat.id}
                    onClick={() => {
                      // Row click drills into the category's products — unless
                      // the row is mid-rename (typing shouldn't navigate).
                      if (!renaming)
                        setLocation(`/admin-v2/categories/${cat.id}`);
                    }}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50/60 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      {renaming ? (
                        <Input
                          autoFocus
                          value={renameDraft}
                          onChange={e => setRenameDraft(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          onKeyDown={e => {
                            if (e.key === "Enter") commitRename(cat);
                            else if (e.key === "Escape") setRenamingId(null);
                          }}
                          onBlur={() => commitRename(cat)}
                          className="h-8 w-64 text-sm"
                        />
                      ) : (
                        <p className="truncate text-sm font-medium text-slate-800">
                          {cat.name}
                        </p>
                      )}
                      <p className="truncate text-[11px] font-mono text-slate-400">
                        {cat.slug}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                        count > 0
                          ? "bg-slate-100 text-slate-700"
                          : "bg-slate-50 text-slate-400"
                      }`}
                      title={`${count} product${count === 1 ? "" : "s"}`}
                    >
                      {count}
                    </span>
                    {!cat.is_active && (
                      <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-1.5 py-px text-[10px] font-bold text-slate-500">
                        Inactive
                      </span>
                    )}
                    {isSentinel ? (
                      <span
                        className="shrink-0 p-1.5 text-slate-300"
                        title="Uncategorized is a system category — it can't be renamed or deleted"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    ) : renaming ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          onMouseDown={e => e.preventDefault()}
                          onClick={e => {
                            e.stopPropagation();
                            commitRename(cat);
                          }}
                          className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50"
                          title="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onMouseDown={e => e.preventDefault()}
                          onClick={e => {
                            e.stopPropagation();
                            setRenamingId(null);
                          }}
                          className="p-1.5 rounded text-slate-400 hover:bg-slate-100"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          startRename(cat);
                        }}
                        disabled={savingRename}
                        className="shrink-0 p-1.5 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Rename"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 shrink-0 text-slate-300" />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
