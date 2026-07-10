import {
  Package,
  Grid3x3,
  MessageSquare,
  Settings,
  Upload,
  LayoutDashboard,
  FileSpreadsheet,
  FileText,
  ShoppingBag,
  Globe,
  Images,
  Layers,
  FolderTree,
} from "lucide-react";

// Shared admin navigation config — the single source of truth for the desktop
// sidebar (AdminDashboard) and the mobile shell (MobileAdminShell). Only the
// surrounding chrome differs between the two; the section list is identical.

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Catalogue",
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "products", label: "Products", icon: Package },
      { id: "catalog-editor", label: "Catalog Editor", icon: FolderTree },
      { id: "categories", label: "Catalogues", icon: Grid3x3 },
      { id: "image-library", label: "Image Library", icon: Images },
      { id: "masters", label: "Masters", icon: Layers },
    ],
  },
  {
    label: "Sales",
    items: [
      { id: "orders", label: "Orders", icon: ShoppingBag },
      { id: "enquiries", label: "Enquiries", icon: MessageSquare },
    ],
  },
  {
    label: "Content & Import",
    items: [
      { id: "site-content", label: "Site Content", icon: FileText },
      { id: "seo", label: "SEO", icon: Globe },
      { id: "bulk-import", label: "CSV Import", icon: Upload },
      { id: "google-sheets", label: "Google Sheets", icon: FileSpreadsheet },
    ],
  },
  {
    label: "System",
    items: [{ id: "settings", label: "Settings", icon: Settings }],
  },
];

export const BREADCRUMB: Record<string, { parent: string; label: string }> = {
  overview: { parent: "Catalogue", label: "Overview" },
  products: { parent: "Catalogue", label: "Products" },
  "catalog-editor": { parent: "Catalogue", label: "Catalog Editor" },
  categories: { parent: "Catalogue", label: "Catalogues" },
  "image-library": { parent: "Catalogue", label: "Image Library" },
  orders: { parent: "Sales", label: "Orders" },
  enquiries: { parent: "Sales", label: "Enquiries" },
  "site-content": { parent: "Content & Import", label: "Site Content" },
  seo: { parent: "Content & Import", label: "SEO" },
  "bulk-import": { parent: "Content & Import", label: "CSV Import" },
  "google-sheets": { parent: "Content & Import", label: "Google Sheets" },
  settings: { parent: "System", label: "Settings" },
};

// Sections promoted to the mobile bottom tab bar. Everything else lives under
// the "More" tab. `masters` opens its own route (/admin/masters).
export const MOBILE_PRIMARY_IDS = ["overview", "products", "image-library"];
