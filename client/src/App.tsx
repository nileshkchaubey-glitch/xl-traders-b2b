import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import StorefrontLayout from "@/components/StorefrontLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuthStore } from "./lib/authStore";
const Home = lazy(() => import("./pages/Home"));
const Catalog = lazy(() => import("./pages/Catalog"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Search = lazy(() => import("./pages/Search"));
const Categories = lazy(() => import("./pages/Categories"));
const Account = lazy(() => import("./pages/Account"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Load page code when that route renders. The unchanged production service
// worker also precaches chunks in the background; splitting reduces the page's
// initial execution graph, not the total offline-precache download.
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminProductEditor = lazy(() => import("./pages/AdminProductEditor"));
const AdminMasters = lazy(() => import("./components/admin/AdminMasters"));

function StorefrontFallback() {
  return (
    <main className="flex-1 pb-24 md:pb-10">
      <div className="xl-shell py-10" role="status" aria-live="polite">
        Loading page…
      </div>
    </main>
  );
}

function AdminFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div
        className="flex flex-col items-center gap-3 text-slate-500"
        role="status"
        aria-live="polite"
      >
        <div className="w-8 h-8 border-2 border-slate-300 border-t-red-600 rounded-full animate-spin" />
        <p className="text-sm font-medium">Loading admin…</p>
      </div>
    </div>
  );
}

const STOREFRONT_ROUTES: Array<[string, React.ComponentType]> = [
  ["/", Home],
  ["/catalog", Catalog],
  ["/product/:id", ProductDetail],
  ["/cart", Cart],
  ["/search", Search],
  ["/categories", Categories],
  ["/account", Account],
  ["/auth", Auth],
];

function Router() {
  return (
    <Switch>
      {/* Storefront — Header/Footer come from StorefrontLayout, which each of
          these pages used to import and render for itself. <main> stays with
          the page: its bottom padding is page-specific.

          These are enumerated rather than wrapped as one catch-all Route so
          that NotFound and /admin keep rendering with NO storefront chrome,
          exactly as they do today. That keeps this refactor behaviour-neutral;
          giving the 404 a header and bottom nav is a real improvement but a
          separate decision. */}
      {STOREFRONT_ROUTES.map(([path, Page]) => (
        <Route key={path} path={path}>
          <StorefrontLayout>
            <Suspense fallback={<StorefrontFallback />}>
              <Page />
            </Suspense>
          </StorefrontLayout>
        </Route>
      ))}
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
      <Route path={"/admin/masters"}>
        <Suspense fallback={<AdminFallback />}>
          <AdminMasters />
        </Suspense>
      </Route>
      <Route path={"/admin"}>
        <Suspense fallback={<AdminFallback />}>
          <AdminDashboard />
        </Suspense>
      </Route>
      <Route path={"/404"}>
        <Suspense fallback={<StorefrontFallback />}>
          <NotFound />
        </Suspense>
      </Route>
      {/* Final fallback route */}
      <Route>
        <Suspense fallback={<StorefrontFallback />}>
          <NotFound />
        </Suspense>
      </Route>
    </Switch>
  );
}

function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <ConfirmDialogHost />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
