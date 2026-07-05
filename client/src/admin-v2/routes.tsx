import { Route, Switch, useParams } from "wouter";
import DashboardPage from "./pages/DashboardPage";
import ProductGridPage from "./pages/ProductGridPage";
import ProductEntryPage from "./pages/ProductEntryPage";
import ImageLibraryPage from "./pages/ImageLibraryPage";
import VariantsPage from "./pages/VariantsPage";
import CategoriesPage from "./pages/CategoriesPage";
import AiWorkspacePage from "./pages/AiWorkspacePage";

// Category drill-down: the products grid pinned to one category (by id — the
// name isn't URL-safe). Keyed so switching categories remounts fresh state.
function CategoryProductsRoute() {
  const params = useParams<{ id: string }>();
  return <ProductGridPage key={params.id} fixedCategoryId={params.id} />;
}

export default function AdminV2Routes() {
  return (
    <Switch>
      <Route path="/admin-v2/products/new" component={ProductEntryPage} />
      <Route path="/admin-v2/products/:id" component={ProductEntryPage} />
      <Route path="/admin-v2/products">
        <ProductGridPage />
      </Route>
      <Route path="/admin-v2/images" component={ImageLibraryPage} />
      <Route path="/admin-v2/variants" component={VariantsPage} />
      <Route
        path="/admin-v2/categories/:id"
        component={CategoryProductsRoute}
      />
      <Route path="/admin-v2/categories" component={CategoriesPage} />
      <Route path="/admin-v2/ai" component={AiWorkspacePage} />
      {/* Index: the dashboard (previously a redirect to /products) */}
      <Route path="/admin-v2" component={DashboardPage} />
    </Switch>
  );
}
