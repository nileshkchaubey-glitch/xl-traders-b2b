-- XL Traders B2B Website - Supabase SQL Schema
-- Run this in Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS & AUTHENTICATION (Using Supabase Auth)
-- ============================================================================

-- User profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  company_name TEXT,
  contact_person TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  gst_number TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PRODUCT CATALOG
-- ============================================================================

-- Categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon_emoji TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  description TEXT,
  price DECIMAL(12, 2) NOT NULL,
  unit_of_measure TEXT DEFAULT 'pcs',
  quantity_in_unit INTEGER,
  sku TEXT UNIQUE,
  image_url TEXT,
  image_alt_text TEXT,
  image_description TEXT,
  specifications JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Product images table (for multiple images per product)
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ENQUIRIES & ORDERS
-- ============================================================================

-- Enquiries table (for WhatsApp/Email enquiries)
CREATE TABLE IF NOT EXISTS public.enquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_company TEXT,
  quantity_requested INTEGER,
  message TEXT,
  enquiry_source TEXT DEFAULT 'website',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_products_category_id ON public.products(category_id);
CREATE INDEX idx_products_is_active ON public.products(is_active);
CREATE INDEX idx_products_is_featured ON public.products(is_featured);
CREATE INDEX idx_products_name ON public.products USING GIN(to_tsvector('english', name));
CREATE INDEX idx_products_description ON public.products USING GIN(to_tsvector('english', description));
CREATE INDEX idx_product_images_product_id ON public.product_images(product_id);
CREATE INDEX idx_enquiries_user_id ON public.enquiries(user_id);
CREATE INDEX idx_enquiries_product_id ON public.enquiries(product_id);
CREATE INDEX idx_enquiries_status ON public.enquiries(status);
CREATE INDEX idx_categories_is_active ON public.categories(is_active);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

-- User profiles: Users can only read their own profile, admins can read all
CREATE POLICY "Users can read own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id OR (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Categories: Everyone can read active categories
CREATE POLICY "Anyone can read active categories" ON public.categories
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins can manage categories" ON public.categories
  FOR ALL USING ((SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()));

-- Products: Everyone can read active products
CREATE POLICY "Anyone can read active products" ON public.products
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL USING ((SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()));

-- Product images: Everyone can read
CREATE POLICY "Anyone can read product images" ON public.product_images
  FOR SELECT USING (TRUE);

CREATE POLICY "Admins can manage product images" ON public.product_images
  FOR ALL USING ((SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()));

-- Enquiries: Users can read their own, admins can read all
CREATE POLICY "Users can read own enquiries" ON public.enquiries
  FOR SELECT USING (auth.uid() = user_id OR (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Anyone can create enquiry" ON public.enquiries
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Admins can update enquiries" ON public.enquiries
  FOR UPDATE USING ((SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()));

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Insert sample categories
INSERT INTO public.categories (name, slug, description, icon_emoji, display_order) VALUES
  ('Round Container', 'round-container', 'Plastic round containers with various capacities', '🥤', 1),
  ('Rectangle Container', 'rectangle-container', 'Rectangular plastic containers for food storage', '📦', 2),
  ('Rice Bowl', 'rice-bowl', 'Disposable rice bowls and containers', '🍚', 3),
  ('Premium Container', 'premium-container', 'Premium quality containers with lids', '✨', 4),
  ('Hinged Container', 'hinged-container', 'Hinged lid containers for takeaway', '🔗', 5),
  ('Aluminum Containers', 'aluminum-containers', 'Aluminum foil containers for food packaging', '🥫', 6)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- FUNCTIONS FOR COMMON OPERATIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enquiries_updated_at BEFORE UPDATE ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STORAGE BUCKETS (Create via Supabase Dashboard)
-- ============================================================================
-- Create these buckets in Supabase Storage:
-- 1. product-images (public)
-- 2. product-images-temp (private, for uploads)
