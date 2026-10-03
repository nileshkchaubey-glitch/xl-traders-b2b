import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuthStore } from "@/lib/authStore";

/** Mount admin data and controls only after the database profile has resolved. */
export default function AdminAccess({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, isAdmin } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p role="status" className="text-sm text-slate-500">
          Checking admin access…
        </p>
      </div>
    );
  }
  if (!isAuthenticated) return <Redirect to="/auth" replace />;
  if (!isAdmin) return <Redirect to="/" replace />;

  // Auth initialization owns profile reads. Refreshing here flips isLoading
  // and used to cancel the route's own redirect. RLS still guards every request.
  return children;
}
