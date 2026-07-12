import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useAuthStore } from "@/lib/authStore";
import {
  LogOut,
  Package,
  Grid3x3,
  MessageSquare,
  Settings,
  Upload,
  LayoutDashboard,
  FileSpreadsheet,
  ShoppingBag,
  Globe,
  Menu,
  X,
  ChevronRight,
  ExternalLink,
  Images,
  Layers,
  Plus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { masterService, ProductMaster } from "@/lib/masterService";
import { categoryService } from "@/lib/productService";
import { Category, Product } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { isPriceOnEnquiry } from "@/lib/priceUtils";
import MasterDialog from "./MasterDialog";
import VariantRow from "./VariantRow";
import MobileMasterSheet from "@/components/admin/MobileMasterSheet";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/confirm-dialog";

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Catalogue",
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      // Phase 2b: products = the Catalog Editor tab (AdminProducts removed).
      { id: "catalog-editor", label: "Products", icon: Package },
      { id: "categories", label: "Catalogues", icon: Grid3x3 },
      { id: "image-library", label: "Image Library", icon: Images },
      { id: "masters", label: "Masters", icon: Layers },
    ],
  },
  {
    label: "Sales",
    items: [
      { id: "orders", label: "Orders", icon: ShoppingBag },
      { id: "enquiries", label: "Enquiries", icon: MessageSquare },
    ],
  },
  {
    label: "Content & Import",
    items: [
      { id: "seo", label: "SEO", icon: Globe },
      { id: "bulk-import", label: "CSV Import", icon: Upload },
      { id: "google-sheets", label: "Google Sheets", icon: FileSpreadsheet },
    ],
  },
  {
    label: "System",
    items: [{ id: "settings", label: "Settings", icon: Settings }],
  },
];

export default function AdminMasters() {
  const [, setLocation] = useLocation();
  const { user, refreshProfile, signOut } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Masters Data State
  const [masters, setMasters] = useState<ProductMaster[]>([]);
  const [variantsMap, setVariantsMap] = useState<Record<string, Product[]>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Interactive UI State
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [addingVariantFor, setAddingVariantFor] = useState<string | null>(null);
  // Mobile: which master's quick-edit bottom sheet is open.
  const [sheetMasterId, setSheetMasterId] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch Masters, Categories, and Products grouped as variants
      const [
        mastersData,
        categoriesData,
        { data: allVariants, error: variantsError },
      ] = await Promise.all([
        masterService.getMasters(),
        categoryService.getAll(),
        supabase.from("products").select("*").not("master_id", "is", null),
      ]);

      if (variantsError) throw variantsError;

      setMasters(mastersData);
      setCategories(categoriesData);

      // Group variants by master_id
      const map: Record<string, Product[]> = {};
      allVariants?.forEach(v => {
        if (v.master_id) {
          if (!map[v.master_id]) map[v.master_id] = [];
          map[v.master_id].push(v);
        }
      });
      setVariantsMap(map);
    } catch (err) {
      console.error("Error loading masters data:", err);
      toast.error("Failed to load product masters");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
    refreshData();
  }, [refreshProfile, refreshData]);

  const handleLogout = async () => {
    await signOut();
    setLocation("/");
    toast.success("Logged out");
  };

  const handleTabChange = (tabId: string) => {
    setSidebarOpen(false);
    sessionStorage.setItem("admin-active-tab", tabId);
    setLocation("/admin");
  };

  const handleToggleActive = async (master: ProductMaster) => {
    try {
      await masterService.updateMaster(master.id, {
        is_active: !master.is_active,
      });
      toast.success(
        `Master set to ${!master.is_active ? "Active" : "Inactive"} ✓`
      );
      refreshData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    }
  };

  const handleDeleteMaster = async (id: string) => {
    if (
      !(await confirm({
        title: "Delete this product master?",
        description: "Variants will be unlinked but NOT deleted.",
        destructive: true,
      }))
    )
      return;
    try {
      await masterService.deleteMaster(id);
      toast.success("Master deleted ✓");
      if (expandedId === id) setExpandedId(null);
      refreshData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete master");
    }
  };

  const handleDeleteVariant = async (id: string) => {
    if (!(await confirm({ title: "Delete this variant product?", destructive: true })))
      return;
    try {
      await masterService.deleteVariant(id);
      toast.success("Variant deleted ✓");
      refreshData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete variant");
    }
  };

  const initials = user?.email?.[0]?.toUpperCase() ?? "A";

  return (
    <div className="flex h-screen bg-admin-bg overflow-hidden">
      {/* ── Mobile overlay ─────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={`fixed left-0 top-0 h-full w-[220px] bg-admin-sidebar flex flex-col z-50 transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:static lg:translate-x-0 flex-shrink-0`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.07]">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
            <span className="text-white font-black text-sm leading-none">
              XL
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-none">
              XL Traders
            </p>
            <p className="text-slate-500 text-[11px] mt-0.5">Admin Panel</p>
          </div>
          <button
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-600 px-3 mb-1.5 select-none">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = item.id === "masters";
                  if (item.id === "masters") {
                    return (
                      <Link
                        key={item.id}
                        to="/admin/masters"
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all text-left
                          ${
                            active
                              ? "bg-red-600 text-white shadow-sm shadow-red-900/30"
                              : "text-slate-400 hover:text-white hover:bg-white/[0.07]"
                          }`}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        {item.label}
                      </Link>
                    );
                  }
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabChange(item.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all text-left text-slate-400 hover:text-white hover:bg-white/[0.07]"
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/[0.07] p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-[12px] font-semibold truncate leading-none">
                {user?.email?.split("@")[0] ?? "Admin"}
              </p>
              <p className="text-slate-500 text-[10px] mt-0.5">Administrator</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.07] text-[12px] font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200/80 px-6 py-3 flex items-center gap-4 flex-shrink-0">
          <button
            className="lg:hidden text-slate-400 hover:text-slate-700"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-slate-400 text-xs">Catalogue</span>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span className="font-semibold text-slate-800 text-sm">
              Masters
            </span>
          </div>

          <div className="flex-1" />

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors font-medium"
          >
            <ExternalLink className="w-3 h-3" />
            View Store
          </a>
        </header>

        {/* Content body */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-6">
            {/* Header section */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900">
                  Product Masters
                </h1>
                <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {masters.length}
                </span>
              </div>
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold gap-1.5 shadow"
              >
                <Plus className="w-4 h-4" />
                New Master
              </Button>
            </div>

            {loading && masters.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 text-sm">
                  Loading masters list...
                </p>
              </div>
            ) : masters.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center flex flex-col items-center justify-center">
                <AlertCircle className="w-10 h-10 text-slate-300 mb-3" />
                <h3 className="text-slate-800 font-bold text-base">
                  No Product Masters found
                </h3>
                <p className="text-slate-500 text-xs mt-1 max-w-sm">
                  Create a master catalog record first, then attach multiple
                  size or packing variants to it.
                </p>
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  Create Your First Master
                </Button>
              </div>
            ) : (
              <>
                {/* ── MOBILE LAYOUT (Cards → bottom sheet) ── */}
                <div className="block sm:hidden space-y-3">
                  {masters.map(master => {
                    const variants = variantsMap[master.id] || [];
                    const primaryImg =
                      master.product_master_images?.find(
                        img => img.is_primary
                      ) || master.product_master_images?.[0];
                    const thumbUrl = primaryImg ? primaryImg.image_url : null;

                    return (
                      <button
                        key={master.id}
                        onClick={() => {
                          setAddingVariantFor(null);
                          setSheetMasterId(master.id);
                        }}
                        className="w-full text-left bg-white rounded-xl border border-slate-200/80 shadow-sm p-3 flex items-center gap-3 min-h-[68px]"
                      >
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            className="w-12 h-12 object-cover rounded-lg border border-slate-100 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-400">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 truncate">
                            {master.name}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {master.categories?.name || "Uncategorized"}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                              {variants.length} variants
                            </span>
                            <span
                              className={`w-2 h-2 rounded-full ${master.is_active ? "bg-emerald-500" : "bg-slate-300"}`}
                            />
                            <span className="text-[10px] font-medium text-slate-500">
                              {master.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>

                {/* ── DESKTOP LAYOUT (Table) ── */}
                <div className="hidden sm:block bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="p-4 w-[60px]">Thumb</th>
                        <th className="p-4">Name</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Variants</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {masters.map(master => {
                        const variants = variantsMap[master.id] || [];
                        const isExpanded = expandedId === master.id;
                        const primaryImg =
                          master.product_master_images?.find(
                            img => img.is_primary
                          ) || master.product_master_images?.[0];
                        const thumbUrl = primaryImg
                          ? primaryImg.image_url
                          : null;

                        return (
                          <>
                            <tr
                              key={master.id}
                              className={`hover:bg-slate-50/60 transition-colors ${isExpanded ? "bg-slate-50/20" : ""}`}
                            >
                              {/* Thumb */}
                              <td className="p-4">
                                {thumbUrl ? (
                                  <img
                                    src={thumbUrl}
                                    className="w-10 h-10 object-cover rounded-lg border border-slate-100"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                                    <Package className="w-4 h-4" />
                                  </div>
                                )}
                              </td>

                              {/* Name */}
                              <td className="p-4 font-bold text-slate-900">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedId(isExpanded ? null : master.id)
                                  }
                                  className="text-left hover:text-red-600 transition flex items-center gap-1.5"
                                >
                                  {master.name}
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                </button>
                              </td>

                              {/* Category */}
                              <td className="p-4 text-slate-600">
                                {master.categories?.name || "—"}
                              </td>

                              {/* Variants Count */}
                              <td className="p-4">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
                                  {variants.length} variant
                                  {variants.length !== 1 ? "s" : ""}
                                </span>
                              </td>

                              {/* Status */}
                              <td className="p-4">
                                <button
                                  onClick={() => handleToggleActive(master)}
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold transition
                                    ${
                                      master.is_active
                                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                    }`}
                                >
                                  {master.is_active ? (
                                    <Eye className="w-3 h-3" />
                                  ) : (
                                    <EyeOff className="w-3 h-3" />
                                  )}
                                  {master.is_active ? "Active" : "Inactive"}
                                </button>
                              </td>

                              {/* Actions */}
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setAddingVariantFor(
                                        addingVariantFor === master.id
                                          ? null
                                          : master.id
                                      )
                                    }
                                    className="h-8 text-xs font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                  >
                                    + Add Variant
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() =>
                                      handleDeleteMaster(master.id)
                                    }
                                    className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                    title="Delete Master"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded sub-table containing variants */}
                            {isExpanded && (
                              <tr className="bg-slate-50/60">
                                <td colSpan={6} className="p-4 pl-14">
                                  <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 space-y-3">
                                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                      Variants List
                                    </h4>

                                    <table className="w-full border-collapse text-left text-xs">
                                      <thead>
                                        <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase">
                                          <th className="py-2 pr-4">Label</th>
                                          <th className="py-2 pr-4">SKU</th>
                                          <th className="py-2 pr-4">Price ₹</th>
                                          <th className="py-2 pr-4">MRP ₹</th>
                                          <th className="py-2 pr-4">MOQ</th>
                                          <th className="py-2 pr-4">Unit</th>
                                          <th className="py-2 text-right">
                                            Delete
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {variants.length === 0 ? (
                                          <tr>
                                            <td
                                              colSpan={7}
                                              className="py-4 text-center text-slate-400 italic"
                                            >
                                              No variants added yet.
                                            </td>
                                          </tr>
                                        ) : (
                                          variants.map(v => (
                                            <tr
                                              key={v.id}
                                              className="hover:bg-slate-50/40"
                                            >
                                              <td className="py-2 pr-4 font-bold text-slate-800">
                                                {v.variant_label}
                                              </td>
                                              <td className="py-2 pr-4 font-mono text-slate-500">
                                                {v.sku}
                                              </td>
                                              <td className="py-2 pr-4 font-bold text-slate-800">
                                                {isPriceOnEnquiry(v.price)
                                                  ? "—"
                                                  : `₹${v.price}`}
                                              </td>
                                              <td className="py-2 pr-4 text-slate-400">
                                                ₹{v.mrp || "—"}
                                              </td>
                                              <td className="py-2 pr-4 text-slate-600">
                                                {v.moq}
                                              </td>
                                              <td className="py-2 pr-4 text-slate-600">
                                                {v.unit_of_measure}
                                              </td>
                                              <td className="py-2 text-right">
                                                <button
                                                  onClick={() =>
                                                    handleDeleteVariant(v.id)
                                                  }
                                                  className="text-rose-500 hover:text-rose-700 p-1"
                                                  title="Delete Variant"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </td>
                                            </tr>
                                          ))
                                        )}

                                        {/* Inline variant add row on desktop */}
                                        {addingVariantFor === master.id && (
                                          <VariantRow
                                            masterId={master.id}
                                            masterSlug={master.slug}
                                            onSuccess={refreshData}
                                            onCancel={() =>
                                              setAddingVariantFor(null)
                                            }
                                          />
                                        )}
                                      </tbody>
                                    </table>

                                    {addingVariantFor !== master.id && (
                                      <div className="flex justify-end pt-2 border-t border-slate-100">
                                        <Button
                                          size="sm"
                                          onClick={() =>
                                            setAddingVariantFor(master.id)
                                          }
                                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                                        >
                                          + Add Variant
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Creation Modal Dialog */}
      <MasterDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        categories={categories}
        onSuccess={refreshData}
      />

      {/* Mobile master quick-edit sheet */}
      <MobileMasterSheet
        master={masters.find(m => m.id === sheetMasterId) || null}
        variants={sheetMasterId ? variantsMap[sheetMasterId] || [] : []}
        open={!!sheetMasterId}
        onOpenChange={o => {
          if (!o) {
            setSheetMasterId(null);
            setAddingVariantFor(null);
          }
        }}
        addingVariant={!!sheetMasterId && addingVariantFor === sheetMasterId}
        onStartAddVariant={() => setAddingVariantFor(sheetMasterId)}
        onCancelAddVariant={() => setAddingVariantFor(null)}
        onToggleActive={handleToggleActive}
        onDeleteMaster={id => {
          setSheetMasterId(null);
          handleDeleteMaster(id);
        }}
        onDeleteVariant={handleDeleteVariant}
        onVariantAdded={() => {
          refreshData();
          setAddingVariantFor(null);
        }}
        onEditVariant={id => setLocation(`/admin/products/${id}`)}
      />
    </div>
  );
}
