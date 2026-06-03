import { useEffect, lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuthStore } from "./lib/authStore";
import WhatsAppFloat from "./components/WhatsAppFloat";
import Home from "./pages/Home";
import Catalog from "./pages/Catalog";
import ProductDetail from "./pages/ProductDetail";
import Auth from "./pages/Auth";

// The admin dashboard pulls in heavy, admin-only deps (xlsx, recharts).
// Lazy-load it so regular shoppers never download that code.
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">
      Loading…
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
      <Route path={"/admin"}>
        <Suspense fallback={<PageFallback />}>
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
  const [location] = useLocation();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Keep the floating CTA off the admin panel — it's a shopper-facing element.
  const showWhatsAppFloat = !location.startsWith("/admin");

  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
          {showWhatsAppFloat && <WhatsAppFloat />}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
