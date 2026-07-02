import { Route, Switch } from "wouter";
import DashboardPage from "./pages/DashboardPage";
import ProductGridPage from "./pages/ProductGridPage";
import ProductEntryPage from "./pages/ProductEntryPage";
import ImageLibraryPage from "./pages/ImageLibraryPage";
import VariantsPage from "./pages/VariantsPage";
import AiWorkspacePage from "./pages/AiWorkspacePage";

export default function AdminV2Routes() {
  return (
    <Switch>
      <Route path="/admin-v2/products/new" component={ProductEntryPage} />
      <Route path="/admin-v2/products/:id" component={ProductEntryPage} />
      <Route path="/admin-v2/products" component={ProductGridPage} />
      <Route path="/admin-v2/images" component={ImageLibraryPage} />
      <Route path="/admin-v2/variants" component={VariantsPage} />
      <Route path="/admin-v2/ai" component={AiWorkspacePage} />
      {/* Index: the dashboard (previously a redirect to /products) */}
      <Route path="/admin-v2" component={DashboardPage} />
    </Switch>
  );
}
