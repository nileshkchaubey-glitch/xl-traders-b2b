import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore } from '@/lib/authStore';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  // Once admin access is confirmed, never re-run verification — auth-store
  // updates (e.g. profile refresh) would otherwise retrigger the effect.
  const hasVerified = useRef(false);

  // Unsaved-changes guard for the product editor dialog
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);

  const handleTabChange = useCallback((tab: string) => {
    if (productDialogOpen && tab !== 'products') {
      setPendingTab(tab);
      setShowLeaveWarning(true);
    } else {
      setActiveTab(tab);
    }
  }, [productDialogOpen]);

  const confirmLeave = useCallback(() => {
    if (pendingTab) setActiveTab(pendingTab);
    setPendingTab(null);
    setShowLeaveWarning(false);
  }, [pendingTab]);

  const cancelLeave = useCallback(() => {
    setPendingTab(null);
    setShowLeaveWarning(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function verifyAccess() {
      if (hasVerified.current) return;
      if (isLoading) return;
      if (!isAuthenticated) {
        if (!redirectingRef.current) {
          redirectingRef.current = true;
          setLocation('/auth');
        }
        return;
      }
      if (isAdmin) { hasVerified.current = true; setAccessChecked(true); return; }
      const admin = await refreshProfile();
      if (cancelled) return;
      if (admin) { hasVerified.current = true; setAccessChecked(true); return; }
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

      {/* Unsaved-changes warning */}
      <AlertDialog open={showLeaveWarning} onOpenChange={(open) => { if (!open) cancelLeave(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have the product editor open with unsaved changes.
              Switching tabs will not close the editor, but if you save while on another tab the dialog will appear hidden.
              Stay on Products to finish editing, or leave anyway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelLeave}>Stay editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLeave}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Leave anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Main content */}
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
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

          {/* products uses forceMount to preserve unsaved dialog form state across tab switches */}
          <TabsContent value="overview">
            <AdminOverview onTabChange={setActiveTab} />
          </TabsContent>

          <TabsContent value="products" forceMount className="data-[state=inactive]:hidden">
            <AdminProducts onDialogOpenChange={setProductDialogOpen} />
          </TabsContent>

          <TabsContent value="orders">
            <AdminOrders />
          </TabsContent>

          <TabsContent value="categories">
            <AdminCategories />
          </TabsContent>

          <TabsContent value="enquiries">
            <AdminEnquiries />
          </TabsContent>

          <TabsContent value="bulk-import">
            <AdminBulkImport onGoToProducts={() => setActiveTab('products')} />
          </TabsContent>

          <TabsContent value="google-sheets">
            <AdminGoogleSheets />
          </TabsContent>

          <TabsContent value="settings">
            <AdminSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
