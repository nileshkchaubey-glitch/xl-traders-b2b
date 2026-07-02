import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Menu } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import Sidebar from "./Sidebar";
import AdminV2Routes from "../routes";

export default function AdminV2Shell() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isAdmin, isLoading, refreshProfile } =
    useAuthStore();
  const [accessChecked, setAccessChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const redirectingRef = useRef(false);
  const hasVerified = useRef(false);

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
          <p className="text-slate-500 text-sm">Loading admin…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) return null;

  return (
    <div className="flex h-screen bg-[#f4f6f9] overflow-hidden">
      {/* Mobile overlay — tap outside the drawer to close */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar — hamburger visible only below the lg breakpoint */}
        <header className="lg:hidden flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-500 hover:text-slate-800"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-slate-800 text-sm">Admin v2</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <AdminV2Routes />
        </main>
      </div>
    </div>
  );
}
