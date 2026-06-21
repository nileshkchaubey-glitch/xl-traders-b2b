import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, Link, useSearch } from "wouter";
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
} from "lucide-react";
import { toast } from "sonner";

import AdminOverview from "@/components/admin/AdminOverview";
import AdminProducts from "@/components/admin/AdminProducts";
import AdminCategories from "@/components/admin/AdminCategories";
import AdminEnquiries from "@/components/admin/AdminEnquiries";
import AdminSettings from "@/components/admin/AdminSettings";
import AdminBulkImport from "@/components/admin/AdminBulkImport";
import AdminGoogleSheets from "@/components/admin/AdminGoogleSheets";
import AdminOrders from "@/components/admin/AdminOrders";
import AdminSEO from "@/components/admin/AdminSEO";
import AdminImageLibrary from "@/components/admin/AdminImageLibrary";
import { AttentionFilter, isMissingFilter } from "@/lib/catalogHealth";
import { categoryService } from "@/lib/productService";
import { Category } from "@/lib/supabase";

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
      { id: "products", label: "Products", icon: Package },
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

const BREADCRUMB: Record<string, { parent: string; label: string }> = {
  overview: { parent: "Catalogue", label: "Overview" },
  products: { parent: "Catalogue", label: "Products" },
  categories: { parent: "Catalogue", label: "Catalogues" },
  "image-library": { parent: "Catalogue", label: "Image Library" },
  orders: { parent: "Sales", label: "Orders" },
  enquiries: { parent: "Sales", label: "Enquiries" },
  seo: { parent: "Content & Import", label: "SEO" },
  "bulk-import": { parent: "Content & Import", label: "CSV Import" },
  "google-sheets": { parent: "Content & Import", label: "Google Sheets" },
  settings: { parent: "System", label: "Settings" },
};

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isAdmin, isLoading, refreshProfile, signOut } =
    useAuthStore();
  const [activeTab, setActiveTab] = useState(
    () => sessionStorage.getItem("admin-active-tab") || "overview"
  );
  const [accessChecked, setAccessChecked] = useState(false);
  const redirectingRef = useRef(false);
  const hasVerified = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    sessionStorage.setItem("admin-active-tab", activeTab);
  }, [activeTab]);

  const [productsAttention, setProductsAttention] =
    useState<AttentionFilter>(null);

  // Deep-link support: dashboard chips link to /admin?tab=products&missing=<key>.
  // Apply the tab + missing-data filter whenever those query params change.
  const search = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(search);
    const tab = params.get("tab");
    const missing = params.get("missing");
    if (tab) {
      setActiveTab(tab);
      sessionStorage.setItem("admin-active-tab", tab);
    }
    if (isMissingFilter(missing)) {
      setProductsAttention(missing);
    }
  }, [search]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const refreshCategories = useCallback(async () => {
    try {
      const cats = await categoryService.getAll();
      setCategories(cats);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);
  useEffect(() => {
    refreshCategories();
  }, [refreshCategories]);

  const handleTabChange = useCallback((tab: string) => {
    setSidebarOpen(false);
    setActiveTab(tab);
    sessionStorage.setItem("admin-active-tab", tab);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function verifyAccess() {
      if (hasVerified.current) return;
      if (isLoading) return;
      if (!isAuthenticated) {
        if (!redirectingRef.current) {
          redirectingRef.current = true;
          setLocation("/auth");
        }
        return;
      }
      if (isAdmin) {
        hasVerified.current = true;
        setAccessChecked(true);
        return;
      }
      const admin = await refreshProfile();
      if (cancelled) return;
      if (admin) {
        hasVerified.current = true;
        setAccessChecked(true);
        return;
      }
      if (!redirectingRef.current) {
        redirectingRef.current = true;
        toast.error("Admin access required");
        setLocation("/");
      }
    }
    verifyAccess();
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, isAdmin, setLocation, refreshProfile]);

  if (isLoading || (isAuthenticated && !accessChecked && !isAdmin)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) return null;

  const handleLogout = async () => {
    await signOut();
    setLocation("/");
    toast.success("Logged out");
  };

  const crumb = BREADCRUMB[activeTab] ?? { parent: "", label: activeTab };
  const initials = user?.email?.[0]?.toUpperCase() ?? "A";

  return (
    <div className="flex h-screen bg-[#f4f6f9] overflow-hidden">
      {/* ── Mobile overlay ─────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={`fixed left-0 top-0 h-full w-[220px] bg-[#1a1d27] flex flex-col z-50 transition-transform duration-200
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
                  const active = activeTab === item.id;
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
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all text-left
                        ${
                          active
                            ? "bg-red-600 text-white shadow-sm shadow-red-900/30"
                            : "text-slate-400 hover:text-white hover:bg-white/[0.07]"
                        }`}
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

      {/* ── Main ────────────────────────────────────────────────────────────── */}
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
            <span className="text-slate-400 text-xs">{crumb.parent}</span>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span className="font-semibold text-slate-800 text-sm">
              {crumb.label}
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

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-screen-xl mx-auto px-6 py-6">
            {activeTab === "overview" && (
              <AdminOverview onTabChange={setActiveTab} />
            )}

            <div className={activeTab !== "products" ? "hidden" : ""}>
              <AdminProducts
                keyboardShortcutsEnabled={activeTab === "products"}
                attentionFilter={productsAttention}
                onAttentionChange={setProductsAttention}
                categories={categories}
              />
            </div>

            {activeTab === "orders" && <AdminOrders />}

            {activeTab === "categories" && (
              <AdminCategories
                categories={categories}
                loading={categoriesLoading}
                refreshCategories={refreshCategories}
              />
            )}

            {activeTab === "enquiries" && <AdminEnquiries />}
            {activeTab === "seo" && <AdminSEO />}
            {activeTab === "bulk-import" && (
              <AdminBulkImport
                onGoToProducts={() => setActiveTab("products")}
              />
            )}
            {activeTab === "google-sheets" && <AdminGoogleSheets />}
            {activeTab === "settings" && <AdminSettings />}
            {activeTab === "image-library" && <AdminImageLibrary />}
          </div>
        </main>
      </div>
    </div>
  );
}
