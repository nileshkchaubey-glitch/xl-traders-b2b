import { createClient } from '@supabase/supabase-js';

// Fall back to the public publishable key so the app always connects to the
// real database even when build-time env vars are absent (e.g. Netlify/CF
// deploys that haven't set VITE_SUPABASE_URL yet).
// These are the *publishable* (anon) credentials — safe to embed in client code.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://danoeaftaazhbldeeuxj.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhbm9lYWZ0YWF6aGJsZGVldXhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMTk5NzEsImV4cCI6MjA5NTY5NTk3MX0.be0cn5iaDQlR_cJ-UR2khyshzZ2Y8H15jrT1RbS4RQI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for database
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

export interface Product {
  id: string;
  name: string;
  category_id: string;
  description?: string;
  price: number;
  mrp?: number;
  unit_of_measure: string;
  quantity_in_unit?: number;
  sku?: string;
  brand?: string;
  discount_percent?: number;
  image_url?: string;
  image_alt_text?: string;
  image_description?: string;
  specifications?: Record<string, any>;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
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
