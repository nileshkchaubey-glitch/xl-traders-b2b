import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/lib/authStore";
import Sidebar from "./Sidebar";
import AdminV2Routes from "../routes";

export default function AdminV2Shell() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isAdmin, isLoading, refreshProfile } =
    useAuthStore();
  const [accessChecked, setAccessChecked] = useState(false);
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
      <Sidebar />
      <main className="flex-1 overflow-y-auto ml-[220px]">
        <AdminV2Routes />
      </main>
    </div>
  );
}
