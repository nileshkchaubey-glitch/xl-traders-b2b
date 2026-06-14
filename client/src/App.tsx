import { useEffect, lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuthStore } from "./lib/authStore";
import Home from "./pages/Home";
import Catalog from "./pages/Catalog";
import ProductDetail from "./pages/ProductDetail";
import Auth from "./pages/Auth";

// Admin panel is heavy (charts, xlsx/CSV import, image tools) and is only ever
// opened by the owner. Code-split it so public catalog visitors never download
// it — keeps the initial bundle lean for the customers who actually matter.
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminProductEditor = lazy(() => import("./pages/AdminProductEditor"));
import AdminMasters from '@/components/admin/AdminMasters';


function AdminFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-red-600 rounded-full animate-spin" />
        <p className="text-sm font-medium">Loading admin…</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/catalog"} component={Catalog} />
      <Route path={"/product/:id"} component={ProductDetail} />
      <Route path={"/auth"} component={Auth} />
      <Route path={"/admin/products/new"}>
        <Suspense fallback={<AdminFallback />}>
          <AdminProductEditor />
        </Suspense>
      </Route>
      <Route path={"/admin/products/:id"}>
        <Suspense fallback={<AdminFallback />}>
          <AdminProductEditor />
        </Suspense>
      </Route>
      <Route path={"/admin/masters"} component={AdminMasters} />
      <Route path={"/admin"}>
        <Suspense fallback={<AdminFallback />}>
          <AdminDashboard />
        </Suspense>
      </Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
