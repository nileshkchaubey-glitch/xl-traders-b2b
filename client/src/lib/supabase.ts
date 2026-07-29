import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon_emoji?: string;
  image_url?: string | null;
  group_name?: string | null;
  group_order?: number | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// PIM P1: first-class brand entity (public.brands). products.brand_id is the
// canonical link; the legacy products.brand TEXT column is dual-written during
// the transition (expand → migrate → contract) and will be dropped in a later
// PR, after the storefront reads brand_id.
export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  website?: string | null;
  description?: string | null;
  certifications: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Publish gate — a product is only visible on the storefront when
// status === 'published' AND is_active === true. New products default to draft.
export type ProductStatus = "draft" | "published";

export interface Product {
  id: string;
  name: string;
  category_id: string;
  status?: ProductStatus;
  description?: string;
  price?: number;
  mrp?: number;
  unit_of_measure: string;
  quantity_in_unit?: number;
  sku?: string;
  barcode?: string;
  moq?: number;
  // Legacy free-text brand. Dual-written alongside brand_id during the PIM P1
  // transition; '' (the column default) and NULL both mean "no brand".
  brand?: string;
  // Canonical brand link (FK → brands.id, ON DELETE SET NULL).
  // Unbranded == brand_id IS NULL.
  brand_id?: string | null;
  discount_percent?: number;
  image_url?: string | null;
  image_alt_text?: string;
  image_description?: string;
  specifications?: Record<string, any>;
  slug?: string;
  meta_title?: string;
  meta_description?: string;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  // PIM P2 — series membership. `master_id` points at the product_masters row
  // ("series" in the UI and in the owner's vocabulary); a variant inherits the
  // series' description/SEO/brand/images at read time via seriesInheritance.ts.
  master_id?: string | null;
  variant_label?: string | null;
  // Explicit selector ordering. Derived from the numeric prefix of
  // variant_label on insert; NULL falls back to sorting by the label itself.
  variant_sort?: number | null;
  // Fields the operator has explicitly marked "not applicable" so they stop
  // counting as missing in v_product_health (e.g. 'brand','specifications',
  // 'image','description','moq'). No fake data is entered.
  na_fields?: string[] | null;
}

/**
 * A **series** — the owner's and the suppliers' word for what the schema calls
 * `product_masters` (CLAUDE.md glossary). Variants are `products` rows carrying
 * its `master_id`; since PIM P2 they inherit its description / SEO / brand /
 * images at read time (`seriesInheritance.ts`) rather than by copying.
 */
export interface ProductMaster {
  id: string;
  name: string;
  slug: string;
  // Nullable since P2: the FK is ON DELETE SET NULL, so deleting a category
  // orphans the series rather than cascading it away.
  category_id: string | null;
  // Legacy free-text brand, dual-written with brand_id exactly as products are.
  brand?: string | null;
  // Canonical brand link (FK → brands.id, ON DELETE SET NULL).
  brand_id?: string | null;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductMasterImage {
  id: string;
  master_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
  created_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  alt_text?: string;
  description?: string;
  display_order: number;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  company_name?: string;
  contact_person?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gst_number?: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Enquiry {
  id: string;
  user_id?: string;
  product_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_company?: string;
  quantity_requested?: number;
  message?: string;
  enquiry_source: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export type OrderStatus =
  | "new"
  | "confirmed"
  | "processing"
  | "delivered"
  | "cancelled";

export interface Order {
  id: string;
  created_at: string;
  customer_name: string | null;
  phone: string | null;
  status: OrderStatus;
  total_amount: number | null;
  item_count: number | null;
  notes: string | null;
  source: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  sku: string | null;
  product_name: string | null;
  quantity: number;
  unit_price: number | null;
  unit_of_measure: string | null;
  subtotal: number | null;
}

export interface ImportLog {
  id: string;
  created_at: string;
  source: string | null;
  rows_total: number | null;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
}

// Lightweight inquiry log — written for every WhatsApp button click,
// guests and authenticated users alike.
export interface Inquiry {
  id?: string;
  customer_name: string;
  phone: string;
  message: string;
  product_name: string;
  source: string;
  created_at?: string;
}
