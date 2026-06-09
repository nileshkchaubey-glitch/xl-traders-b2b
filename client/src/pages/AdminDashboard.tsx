import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore } from '@/lib/authStore';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Package, Grid3x3, MessageSquare, Settings, Upload, LayoutDashboard, FileSpreadsheet, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

import AdminOverview from '@/components/admin/AdminOverview';
import AdminProducts from '@/components/admin/AdminProducts';
import AdminCategories from '@/components/admin/AdminCategories';
import AdminEnquiries from '@/components/admin/AdminEnquiries';
import AdminSettings from '@/components/admin/AdminSettings';
import AdminBulkImport from '@/components/admin/AdminBulkImport';
import AdminGoogleSheets from '@/components/admin/AdminGoogleSheets';
import AdminOrders from '@/components/admin/AdminOrders';

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isAdmin, isLoading, refreshProfile, signOut } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [accessChecked, setAccessChecked] = useState(false);
  const redirectingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function verifyAccess() {
      if (isLoading) return;
      if (!isAuthenticated) {
        if (!redirectingRef.current) {
          redirectingRef.current = true;
          setLocation('/auth');
        }
        return;
      }
      if (isAdmin) { setAccessChecked(true); return; }
      const admin = await refreshProfile();
      if (cancelled) return;
      if (admin) { setAccessChecked(true); return; }
      if (!redirectingRef.current) {
        redirectingRef.current = true;
        toast.error('Admin access required');
        setLocation('/');
      }
    }

    verifyAccess();
    return () => { cancelled = true; };
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
    setLocation('/');
    toast.success('Logged out');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 border-b border-red-600 sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-base">XL</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-white font-bold text-base leading-none">Admin Panel</h1>
              <p className="text-slate-400 text-xs mt-0.5">XL Traders B2B</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-white text-sm font-medium leading-none">{user?.email}</p>
              <p className="text-slate-400 text-xs mt-0.5">Administrator</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tab nav */}
          <TabsList className="flex w-full overflow-x-auto gap-1 mb-8 h-auto p-1 bg-white border border-slate-200 rounded-xl shadow-sm flex-wrap">
            <TabsTrigger value="overview" className="gap-1.5 flex-shrink-0 data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-1.5 flex-shrink-0 data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Products</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-1.5 flex-shrink-0 data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-1.5 flex-shrink-0 data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <Grid3x3 className="w-4 h-4" />
              <span className="hidden sm:inline">Catalogues</span>
            </TabsTrigger>
            <TabsTrigger value="enquiries" className="gap-1.5 flex-shrink-0 data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Enquiries</span>
            </TabsTrigger>
            <TabsTrigger value="bulk-import" className="gap-1.5 flex-shrink-0 data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">CSV Import</span>
            </TabsTrigger>
            <TabsTrigger value="google-sheets" className="gap-1.5 flex-shrink-0 data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Google Sheets</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 flex-shrink-0 data-[state=active]:bg-red-600 data-[state=active]:text-white">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/*
            forceMount keeps every panel in the DOM so React state is never
            destroyed when the user switches tabs. data-[state=inactive]:hidden
            visually hides the panel — Radix sets data-state="inactive" automatically.
          */}
          <TabsContent value="overview" forceMount className="data-[state=inactive]:hidden">
            <AdminOverview onTabChange={setActiveTab} />
          </TabsContent>

          <TabsContent value="products" forceMount className="data-[state=inactive]:hidden">
            <AdminProducts />
          </TabsContent>

          <TabsContent value="orders" forceMount className="data-[state=inactive]:hidden">
            <AdminOrders />
          </TabsContent>

          <TabsContent value="categories" forceMount className="data-[state=inactive]:hidden">
            <AdminCategories />
          </TabsContent>

          <TabsContent value="enquiries" forceMount className="data-[state=inactive]:hidden">
            <AdminEnquiries />
          </TabsContent>

          <TabsContent value="bulk-import" forceMount className="data-[state=inactive]:hidden">
            <AdminBulkImport onGoToProducts={() => setActiveTab('products')} />
          </TabsContent>

          <TabsContent value="google-sheets" forceMount className="data-[state=inactive]:hidden">
            <AdminGoogleSheets />
          </TabsContent>

          <TabsContent value="settings" forceMount className="data-[state=inactive]:hidden">
            <AdminSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
