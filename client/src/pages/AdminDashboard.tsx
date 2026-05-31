import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore } from '@/lib/authStore';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Package, Grid3x3, MessageSquare, Settings, Upload } from 'lucide-react';
import { toast } from 'sonner';

import AdminProducts from '@/components/admin/AdminProducts';
import AdminCategories from '@/components/admin/AdminCategories';
import AdminEnquiries from '@/components/admin/AdminEnquiries';
import AdminSettings from '@/components/admin/AdminSettings';
import AdminBulkImport from '@/components/admin/AdminBulkImport';

/**
 * Admin Dashboard - Main entry point for admin panel
 */
export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isAdmin, isLoading, refreshProfile, signOut } = useAuthStore();
  const [activeTab, setActiveTab] = useState('products');
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

      if (isAdmin) {
        setAccessChecked(true);
        return;
      }

      const admin = await refreshProfile();
      if (cancelled) return;

      if (admin) {
        setAccessChecked(true);
        return;
      }

      if (!redirectingRef.current) {
        redirectingRef.current = true;
        toast.error('Admin access required');
        setLocation('/');
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
          <p className="text-slate-500 text-sm">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  const handleLogout = async () => {
    await signOut();
    setLocation('/');
    toast.success('Logged out');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 border-b border-red-600 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">XL</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">Admin Panel</h1>
              <p className="text-slate-400 text-sm">XL Traders B2B</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-white text-sm font-medium">{user?.email}</p>
              <p className="text-slate-400 text-xs">Administrator</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="products" className="gap-2">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Products</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <Grid3x3 className="w-4 h-4" />
              <span className="hidden sm:inline">Categories</span>
            </TabsTrigger>
            <TabsTrigger value="enquiries" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Enquiries</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="bulk-import" className="gap-2">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Bulk Import</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-4">
            <AdminProducts />
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <AdminCategories />
          </TabsContent>

          <TabsContent value="enquiries" className="space-y-4">
            <AdminEnquiries />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <AdminSettings />
          </TabsContent>

          <TabsContent value="bulk-import" className="space-y-4">
            <AdminBulkImport />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
