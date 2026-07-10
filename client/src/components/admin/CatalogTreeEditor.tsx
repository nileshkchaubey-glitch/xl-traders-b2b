import { FolderTree } from "lucide-react";
import { Category } from "@/lib/supabase";

interface CatalogTreeEditorProps {
  // Lifted from AdminDashboard (shared with the Products/Categories tabs) so
  // edits made elsewhere appear here without a reload.
  categories?: Category[];
}

/**
 * Catalog Tree Editor — an additional catalogue editing surface that sits
 * alongside the existing AdminProducts table (it does NOT replace it). Layout:
 * a left collapsible Group › Category tree with health dots, a main
 * inline-editable product table, and top "Fix Missing" filter chips.
 *
 * Phase 1 of 3. Keyboard navigation is intentionally out of scope here.
 */
export default function CatalogTreeEditor({
  categories = [],
}: CatalogTreeEditorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center flex-shrink-0">
          <FolderTree className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Catalog Editor</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Browse by group &amp; category, edit inline, fix what's missing.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-400">
        Tree, inline table and Fix-Missing chips land in the next commits.
        <br />
        {categories.length} categories loaded.
      </div>
    </div>
  );
}
