import { Redirect, Route, Switch } from "wouter";
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
      <Route path="/admin-v2">
        <Redirect to="/admin-v2/products" />
      </Route>
    </Switch>
  );
}
