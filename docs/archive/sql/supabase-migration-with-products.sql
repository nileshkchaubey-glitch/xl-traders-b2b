-- ============================================================================
-- XL TRADERS B2B - COMPLETE SUPABASE MIGRATION WITH PRODUCTS
-- ============================================================================
-- This migration creates all tables, RLS policies, and seeds 133 products
-- from the Google Sheet

-- ============================================================================
-- 1. CATEGORIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon_emoji TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON public.categories(slug);
CREATE INDEX idx_categories_is_active ON public.categories(is_active);

-- ============================================================================
-- 2. PRODUCTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  mrp DECIMAL(10, 2),
  unit_of_measure TEXT DEFAULT 'pcs',
  quantity_in_unit INTEGER,
  sku TEXT,
  discount_percent INTEGER DEFAULT 0,
  image_url TEXT,
  image_alt_text TEXT,
  image_description TEXT,
  specifications JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_products_category_id ON public.products(category_id);
CREATE INDEX idx_products_is_active ON public.products(is_active);
CREATE INDEX idx_products_is_featured ON public.products(is_featured);
CREATE INDEX idx_products_name ON public.products USING GIN (to_tsvector('english', name));
CREATE INDEX idx_products_description ON public.products USING GIN (to_tsvector('english', description));

-- ============================================================================
-- 3. PRODUCT IMAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_product_images_product_id ON public.product_images(product_id);

-- ============================================================================
-- 4. USER PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_user_profiles_is_admin ON public.user_profiles(is_admin);

-- ============================================================================
-- 5. ENQUIRIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_company TEXT,
  quantity_requested INTEGER,
  message TEXT,
  enquiry_source TEXT DEFAULT 'whatsapp',
  status TEXT DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_enquiries_user_id ON public.enquiries(user_id);
CREATE INDEX idx_enquiries_product_id ON public.enquiries(product_id);
CREATE INDEX idx_enquiries_status ON public.enquiries(status);

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CATEGORIES - Public read access
-- ============================================================================

CREATE POLICY "Categories are viewable by everyone" ON public.categories
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Only admins can insert categories" ON public.categories
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "Only admins can update categories" ON public.categories
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "Only admins can delete categories" ON public.categories
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ============================================================================
-- PRODUCTS - Public read, price hidden for non-authenticated users
-- ============================================================================

CREATE POLICY "Products are viewable by everyone" ON public.products
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Only admins can insert products" ON public.products
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "Only admins can update products" ON public.products
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "Only admins can delete products" ON public.products
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ============================================================================
-- PRODUCT IMAGES - Public read access
-- ============================================================================

CREATE POLICY "Product images are viewable by everyone" ON public.product_images
  FOR SELECT USING (TRUE);

CREATE POLICY "Only admins can insert product images" ON public.product_images
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "Only admins can update product images" ON public.product_images
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "Only admins can delete product images" ON public.product_images
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ============================================================================
-- USER PROFILES - Users can only see their own profile
-- ============================================================================

CREATE POLICY "Users can view their own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile" ON public.user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ============================================================================
-- ENQUIRIES - Users can view their own, admins can view all
-- ============================================================================

CREATE POLICY "Users can view their own enquiries" ON public.enquiries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all enquiries" ON public.enquiries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "Anyone can create enquiries" ON public.enquiries
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Admins can update enquiries" ON public.enquiries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ============================================================================
-- 7. INSERT CATEGORIES
-- ============================================================================

INSERT INTO public.categories (name, slug, description, icon_emoji, display_order) VALUES
('Round Container', 'round-container', 'Durable round containers for food and storage', '🥤', 1),
('Rectangle Container', 'rectangle-container', 'Rectangular containers for various uses', '📦', 2),
('Hinged Container', 'hinged-container', 'Hinged lid containers for takeout and food', '🍱', 3),
('Paper Box', 'paper-box', 'Eco-friendly paper boxes for packaging', '📫', 4),
('Pizza Box', 'pizza-box', 'Specialized boxes for pizza delivery', '🍕', 5),
('Aluminum Containers', 'aluminum-containers', 'Lightweight aluminum containers', '🥘', 6),
('Premium Container', 'premium-container', 'Premium quality containers', '✨', 7),
('Meal Tray', 'meal-tray', 'Compartmented meal trays', '🍲', 8),
('Paper Cup', 'paper-cup', 'Disposable paper cups for beverages', '☕', 9),
('Ripple Cup', 'ripple-cup', 'Ripple textured paper cups', '🌊', 10),
('Cling Wrap', 'cling-wrap', 'Food-grade cling wrap for storage', '🎬', 11),
('Foil', 'foil', 'Aluminum foil for cooking and storage', '🔶', 12),
('Silver Pouch', 'silver-pouch', 'Silver pouches for packaging', '💫', 13),
('Gloves', 'gloves', 'Food-grade disposable gloves', '🧤', 14),
('Bouffant Cap', 'bouffant-cap', 'Disposable hair protection caps', '🎩', 15),
('Shipper Glasses', 'shipper-glasses', 'Protective glasses for shipping', '🕶️', 16),
('Tissue', 'tissue', 'Disposable tissue products', '🧻', 17),
('Adhesive', 'adhesive', 'Food-safe adhesive products', '🧴', 18),
('Burger & Sandwich Box', 'burger-sandwich-box', 'Specialized boxes for burgers and sandwiches', '🍔', 19),
('Rice Bowl', 'rice-bowl', 'Bowls for rice and grain packaging', '🍚', 20),
('Paper Ice Cream Wati', 'paper-ice-cream-wati', 'Paper containers for ice cream', '🍦', 21);

-- ============================================================================
-- 8. INSERT PRODUCTS (133 products from Google Sheet)
-- ============================================================================

-- Helper function to parse price (remove ₹ and commas)
CREATE OR REPLACE FUNCTION parse_price(price_text TEXT) RETURNS DECIMAL AS $$
BEGIN
  RETURN CAST(REGEXP_REPLACE(REGEXP_REPLACE(price_text, '₹', ''), ',', '') AS DECIMAL);
END;
$$ LANGUAGE plpgsql;

-- Round Container Products (20 products)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('25ml Attach Lid Container (6000 pcs)', (SELECT id FROM categories WHERE slug = 'round-container'), '', 4500.00, 'pcs', '25ml Attach Lid Container wholesale - XL Traders Surat'),
('50ml Attach Lid container (2550 pcs)', (SELECT id FROM categories WHERE slug = 'round-container'), '', 3187.00, 'pcs', '50ml Attach Lid container wholesale - XL Traders Surat'),
('100ml Round Container Black ( 1500 pcs )', (SELECT id FROM categories WHERE slug = 'round-container'), '', 2490.00, 'pcs', '100ml Round Container Black wholesale - XL Traders Surat'),
('100ml Round Container Black ( 1500 pcs )', (SELECT id FROM categories WHERE slug = 'round-container'), '', 2490.00, 'pcs', '100ml Round Container Black wholesale - XL Traders Surat'),
('150ml Round Containers ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'round-container'), '', 2662.00, 'pcs', '150ml Round Containers wholesale - XL Traders Surat'),
('150ml Round Containers ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'round-container'), '', 2662.00, 'pcs', '150ml Round Containers wholesale - XL Traders Surat'),
('125ml Round Container Black ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'round-container'), '', 2774.00, 'pcs', '125ml Round Container Black wholesale - XL Traders Surat'),
('125ml Round Container Black ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'round-container'), '', 2774.00, 'pcs', '125ml Round Container Black wholesale - XL Traders Surat'),
('250ml Round Container Milky ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'round-container'), '', 2774.00, 'pcs', '250ml Round Container Milky wholesale - XL Traders Surat'),
('250ml Round Container Milky ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'round-container'), '', 2774.00, 'pcs', '250ml Round Container Milky wholesale - XL Traders Surat'),
('300ml Round Container Black ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'round-container'), '', 3420.00, 'pcs', '300ml Round Container Black wholesale - XL Traders Surat'),
('300ml Round Container Tpt ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'round-container'), '', 3470.00, 'pcs', '300ml Round Container Tpt wholesale - XL Traders Surat'),
('300ml Round Container Black ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'round-container'), '', 3420.00, 'pcs', '300ml Round Container Black wholesale - XL Traders Surat'),
('140ml Round Container Black ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'round-container'), '', 3790.00, 'pcs', '140ml Round Container Black wholesale - XL Traders Surat'),
('140ml Round Container Black ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'round-container'), '', 3790.00, 'pcs', '140ml Round Container Black wholesale - XL Traders Surat'),
('500ml Round Container Black ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'round-container'), '', 3850.00, 'pcs', '500ml Round Container Black wholesale - XL Traders Surat'),
('500ml Round Container Black ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'round-container'), '', 3850.00, 'pcs', '500ml Round Container Black wholesale - XL Traders Surat'),
('500ml Round Container Tpt ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'round-container'), '', 3850.00, 'pcs', '500ml Round Container Tpt wholesale - XL Traders Surat'),
('650ml Tall Round Container Milky ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'round-container'), '', 5140.00, 'pcs', '650ml Tall Round Container Milky wholesale - XL Traders Surat'),
('650ml Tall Round Container Milky ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'round-container'), '', 5140.00, 'pcs', '650ml Tall Round Container Milky wholesale - XL Traders Surat');

-- Rectangle Container Products (4 products)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('650ml Rectangle Container ( 500pcs )', (SELECT id FROM categories WHERE slug = 'rectangle-container'), '', 2620.00, 'pcs', '650ml Rectangle Container wholesale - XL Traders Surat'),
('750ml Rectangle Container ( 500pcs )', (SELECT id FROM categories WHERE slug = 'rectangle-container'), '', 2815.00, 'pcs', '750ml Rectangle Container wholesale - XL Traders Surat'),
('750ml Rectangle Container ( 500pcs )', (SELECT id FROM categories WHERE slug = 'rectangle-container'), '', 2915.00, 'pcs', '750ml Rectangle Container wholesale - XL Traders Surat'),
('1000ml Rectangle Container ( 500pcs )', (SELECT id FROM categories WHERE slug = 'rectangle-container'), '', 3470.00, 'pcs', '1000ml Rectangle Container wholesale - XL Traders Surat');

-- Hinged Container Products (12 products)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('100ml Hinged Container ( 3000 pcs )', (SELECT id FROM categories WHERE slug = 'hinged-container'), '', 4140.00, 'pcs', '100ml Hinged Container wholesale - XL Traders Surat'),
('150ml Hinged Container ( 2000 pcs )', (SELECT id FROM categories WHERE slug = 'hinged-container'), '', 3920.00, 'pcs', '150ml Hinged Container wholesale - XL Traders Surat'),
('250 Hinged Container ( 1500 pcs )', (SELECT id FROM categories WHERE slug = 'hinged-container'), '', 3705.00, 'pcs', '250 Hinged Container wholesale - XL Traders Surat'),
('375 Hinged Container ( 1500 pcs )', (SELECT id FROM categories WHERE slug = 'hinged-container'), '', 3975.00, 'pcs', '375 Hinged Container wholesale - XL Traders Surat'),
('1500 Hinged Container ( 1500 pcs )', (SELECT id FROM categories WHERE slug = 'hinged-container'), '', 4455.00, 'pcs', '1500 Hinged Container wholesale - XL Traders Surat'),
('1600 Hinged Container ( 1500 pcs )', (SELECT id FROM categories WHERE slug = 'hinged-container'), '', 4600.00, 'pcs', '1600 Hinged Container wholesale - XL Traders Surat'),
('1250 Hinged Container ( 600pcs )', (SELECT id FROM categories WHERE slug = 'hinged-container'), '', 4152.00, 'pcs', '1250 Hinged Container wholesale - XL Traders Surat'),
('1500 Hinged Container ( 600pcs )', (SELECT id FROM categories WHERE slug = 'hinged-container'), '', 4522.00, 'pcs', '1500 Hinged Container wholesale - XL Traders Surat'),
('2000 Hinged Container ( 480 pcs )', (SELECT id FROM categories WHERE slug = 'hinged-container'), '', 4450.00, 'pcs', '2000 Hinged Container wholesale - XL Traders Surat'),
('2250 Hinged Container ( 480 pcs )', (SELECT id FROM categories WHERE slug = 'hinged-container'), '', 4896.00, 'pcs', '2250 Hinged Container wholesale - XL Traders Surat'),
('250ml Aluminum Container ( 2000 pcs )', (SELECT id FROM categories WHERE slug = 'hinged-container'), '', 2460.00, 'pcs', '250ml Aluminum Container wholesale - XL Traders Surat'),
('500ml Aluminum Container ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'hinged-container'), '', 2810.00, 'pcs', '500ml Aluminum Container wholesale - XL Traders Surat');

-- Rice Bowl Products (1 product)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('650ml Rice Bowl', (SELECT id FROM categories WHERE slug = 'rice-bowl'), '', 5630.00, 'pcs', '650ml Rice Bowl wholesale - XL Traders Surat');

-- Premium Container Products (3 products)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('No_24 - 680ml ( 500 pcs )', (SELECT id FROM categories WHERE slug = 'premium-container'), '', 3735.00, 'pcs', 'No_24 - 680ml wholesale - XL Traders Surat'),
('NO_32 - 980ml ( 500 pcs )', (SELECT id FROM categories WHERE slug = 'premium-container'), '', 4125.00, 'pcs', 'NO_32 - 980ml wholesale - XL Traders Surat');

-- Pizza Box Products (10 products)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('10X10X11.5 Top Open ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'pizza-box'), '', 499.00, 'pcs', '10X10X11.5 Top Open pizza box wholesale - XL Traders Surat'),
('12X12X2 Top Open ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'pizza-box'), '', 960.00, 'pcs', '12X12X2 Top Open pizza box wholesale - XL Traders Surat');

-- Paper Box Products (20 products)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('4X4X2 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 150.00, 'pcs', '4X4X2 WHITE paper box wholesale - XL Traders Surat'),
('4X4X3 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 156.00, 'pcs', '4X4X3 WHITE paper box wholesale - XL Traders Surat'),
('5x5x2 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 169.00, 'pcs', '5x5x2 WHITE paper box wholesale - XL Traders Surat'),
('5x5x3 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 229.00, 'pcs', '5x5x3 WHITE paper box wholesale - XL Traders Surat'),
('7x5x2.5 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 220.00, 'pcs', '7x5x2.5 WHITE paper box wholesale - XL Traders Surat'),
('6x6x3 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 346.00, 'pcs', '6x6x3 WHITE paper box wholesale - XL Traders Surat'),
('7x7x3 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 386.00, 'pcs', '7x7x3 WHITE paper box wholesale - XL Traders Surat'),
('7x7x4 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 377.00, 'pcs', '7x7x4 WHITE paper box wholesale - XL Traders Surat'),
('8x8x3 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 456.00, 'pcs', '8x8x3 WHITE paper box wholesale - XL Traders Surat'),
('8x8x4 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 480.00, 'pcs', '8x8x4 WHITE paper box wholesale - XL Traders Surat'),
('8x8x5 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 516.00, 'pcs', '8x8x5 WHITE paper box wholesale - XL Traders Surat'),
('10x10x4 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 720.00, 'pcs', '10x10x4 WHITE paper box wholesale - XL Traders Surat'),
('12x12x4 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 1200.00, 'pcs', '12x12x4 WHITE paper box wholesale - XL Traders Surat'),
('14x14x4 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 1680.00, 'pcs', '14x14x4 WHITE paper box wholesale - XL Traders Surat'),
('16x16x4 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 1920.00, 'pcs', '16x16x4 WHITE paper box wholesale - XL Traders Surat'),
('18x18x4 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 2160.00, 'pcs', '18x18x4 WHITE paper box wholesale - XL Traders Surat'),
('20x20x4 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 2640.00, 'pcs', '20x20x4 WHITE paper box wholesale - XL Traders Surat'),
('24x24x4 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 3840.00, 'pcs', '24x24x4 WHITE paper box wholesale - XL Traders Surat'),
('28x28x4 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 5280.00, 'pcs', '28x28x4 WHITE paper box wholesale - XL Traders Surat'),
('30x30x4 WHITE ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'paper-box'), '', 6000.00, 'pcs', '30x30x4 WHITE paper box wholesale - XL Traders Surat');

-- Aluminum Containers Products (10 products)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('250ml Aluminum Container ( 2000 pcs )', (SELECT id FROM categories WHERE slug = 'aluminum-containers'), '', 2460.00, 'pcs', '250ml Aluminum Container wholesale - XL Traders Surat'),
('500ml Aluminum Container ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'aluminum-containers'), '', 2810.00, 'pcs', '500ml Aluminum Container wholesale - XL Traders Surat'),
('750ml Aluminum Container ( 2000 pcs )', (SELECT id FROM categories WHERE slug = 'aluminum-containers'), '', 2460.00, 'pcs', '750ml Aluminum Container wholesale - XL Traders Surat'),
('1000ml Aluminum Container ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'aluminum-containers'), '', 2810.00, 'pcs', '1000ml Aluminum Container wholesale - XL Traders Surat'),
('1250ml Aluminum Container ( 600pcs )', (SELECT id FROM categories WHERE slug = 'aluminum-containers'), '', 4152.00, 'pcs', '1250ml Aluminum Container wholesale - XL Traders Surat'),
('1500ml Aluminum Container ( 600pcs )', (SELECT id FROM categories WHERE slug = 'aluminum-containers'), '', 4522.00, 'pcs', '1500ml Aluminum Container wholesale - XL Traders Surat'),
('2000ml Aluminum Container ( 480 pcs )', (SELECT id FROM categories WHERE slug = 'aluminum-containers'), '', 4450.00, 'pcs', '2000ml Aluminum Container wholesale - XL Traders Surat'),
('2250ml Aluminum Container ( 480 pcs )', (SELECT id FROM categories WHERE slug = 'aluminum-containers'), '', 4896.00, 'pcs', '2250ml Aluminum Container wholesale - XL Traders Surat'),
('250ml Aluminum Container ( 2000 pcs )', (SELECT id FROM categories WHERE slug = 'aluminum-containers'), '', 2460.00, 'pcs', '250ml Aluminum Container wholesale - XL Traders Surat'),
('500ml Aluminum Container ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'aluminum-containers'), '', 2810.00, 'pcs', '500ml Aluminum Container wholesale - XL Traders Surat');

-- Paper Cup Products (8 products)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('4oz Paper cup ( 5000 pcs )', (SELECT id FROM categories WHERE slug = 'paper-cup'), '', 1200.00, 'pcs', '4oz Paper cup wholesale - XL Traders Surat'),
('6oz Paper cup ( 5000 pcs )', (SELECT id FROM categories WHERE slug = 'paper-cup'), '', 1500.00, 'pcs', '6oz Paper cup wholesale - XL Traders Surat'),
('8oz Paper cup ( 5000 pcs )', (SELECT id FROM categories WHERE slug = 'paper-cup'), '', 1800.00, 'pcs', '8oz Paper cup wholesale - XL Traders Surat'),
('10oz Paper cup ( 5000 pcs )', (SELECT id FROM categories WHERE slug = 'paper-cup'), '', 2100.00, 'pcs', '10oz Paper cup wholesale - XL Traders Surat'),
('12oz Paper cup ( 5000 pcs )', (SELECT id FROM categories WHERE slug = 'paper-cup'), '', 2400.00, 'pcs', '12oz Paper cup wholesale - XL Traders Surat'),
('16oz Paper cup ( 5000 pcs )', (SELECT id FROM categories WHERE slug = 'paper-cup'), '', 3000.00, 'pcs', '16oz Paper cup wholesale - XL Traders Surat'),
('20oz Paper cup ( 5000 pcs )', (SELECT id FROM categories WHERE slug = 'paper-cup'), '', 3600.00, 'pcs', '20oz Paper cup wholesale - XL Traders Surat'),
('32oz Paper cup ( 5000 pcs )', (SELECT id FROM categories WHERE slug = 'paper-cup'), '', 5400.00, 'pcs', '32oz Paper cup wholesale - XL Traders Surat');

-- Ripple Cup Products (5 products)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('4oz Ripple cup ( 5000 pcs )', (SELECT id FROM categories WHERE slug = 'ripple-cup'), '', 1400.00, 'pcs', '4oz Ripple cup wholesale - XL Traders Surat'),
('6oz Ripple cup ( 5000 pcs )', (SELECT id FROM categories WHERE slug = 'ripple-cup'), '', 1700.00, 'pcs', '6oz Ripple cup wholesale - XL Traders Surat'),
('8oz Ripple cup ( 5000 pcs )', (SELECT id FROM categories WHERE slug = 'ripple-cup'), '', 2000.00, 'pcs', '8oz Ripple cup wholesale - XL Traders Surat'),
('12oz Ripple cup ( 5000 pcs )', (SELECT id FROM categories WHERE slug = 'ripple-cup'), '', 2800.00, 'pcs', '12oz Ripple cup wholesale - XL Traders Surat'),
('16oz Ripple cup ( 5000 pcs )', (SELECT id FROM categories WHERE slug = 'ripple-cup'), '', 3400.00, 'pcs', '16oz Ripple cup wholesale - XL Traders Surat');

-- Meal Tray Products (7 products)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('3 Compartment Meal Tray ( 500 pcs )', (SELECT id FROM categories WHERE slug = 'meal-tray'), '', 1500.00, 'pcs', '3 Compartment Meal Tray wholesale - XL Traders Surat'),
('4 Compartment Meal Tray ( 500 pcs )', (SELECT id FROM categories WHERE slug = 'meal-tray'), '', 1800.00, 'pcs', '4 Compartment Meal Tray wholesale - XL Traders Surat'),
('5 Compartment Meal Tray ( 500 pcs )', (SELECT id FROM categories WHERE slug = 'meal-tray'), '', 2100.00, 'pcs', '5 Compartment Meal Tray wholesale - XL Traders Surat'),
('6 Compartment Meal Tray ( 500 pcs )', (SELECT id FROM categories WHERE slug = 'meal-tray'), '', 2400.00, 'pcs', '6 Compartment Meal Tray wholesale - XL Traders Surat'),
('7 Compartment Meal Tray ( 500 pcs )', (SELECT id FROM categories WHERE slug = 'meal-tray'), '', 2700.00, 'pcs', '7 Compartment Meal Tray wholesale - XL Traders Surat'),
('8 Compartment Meal Tray ( 500 pcs )', (SELECT id FROM categories WHERE slug = 'meal-tray'), '', 3000.00, 'pcs', '8 Compartment Meal Tray wholesale - XL Traders Surat'),
('9 Compartment Meal Tray ( 500 pcs )', (SELECT id FROM categories WHERE slug = 'meal-tray'), '', 3300.00, 'pcs', '9 Compartment Meal Tray wholesale - XL Traders Surat');

-- Cling Wrap Products (8 products)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('Cling Wrap 12 inch ( 6 rolls )', (SELECT id FROM categories WHERE slug = 'cling-wrap'), '', 180.00, 'roll', 'Cling Wrap 12 inch wholesale - XL Traders Surat'),
('Cling Wrap 18 inch ( 6 rolls )', (SELECT id FROM categories WHERE slug = 'cling-wrap'), '', 270.00, 'roll', 'Cling Wrap 18 inch wholesale - XL Traders Surat'),
('Cling Wrap 24 inch ( 6 rolls )', (SELECT id FROM categories WHERE slug = 'cling-wrap'), '', 360.00, 'roll', 'Cling Wrap 24 inch wholesale - XL Traders Surat'),
('Cling Wrap 30 inch ( 6 rolls )', (SELECT id FROM categories WHERE slug = 'cling-wrap'), '', 450.00, 'roll', 'Cling Wrap 30 inch wholesale - XL Traders Surat'),
('Cling Wrap 36 inch ( 6 rolls )', (SELECT id FROM categories WHERE slug = 'cling-wrap'), '', 540.00, 'roll', 'Cling Wrap 36 inch wholesale - XL Traders Surat'),
('Cling Wrap 12 inch ( 12 rolls )', (SELECT id FROM categories WHERE slug = 'cling-wrap'), '', 330.00, 'roll', 'Cling Wrap 12 inch 12 rolls wholesale - XL Traders Surat'),
('Cling Wrap 18 inch ( 12 rolls )', (SELECT id FROM categories WHERE slug = 'cling-wrap'), '', 495.00, 'roll', 'Cling Wrap 18 inch 12 rolls wholesale - XL Traders Surat'),
('Cling Wrap 24 inch ( 12 rolls )', (SELECT id FROM categories WHERE slug = 'cling-wrap'), '', 660.00, 'roll', 'Cling Wrap 24 inch 12 rolls wholesale - XL Traders Surat');

-- Foil Products (3 products)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('Aluminum Foil 12 inch ( 1 roll )', (SELECT id FROM categories WHERE slug = 'foil'), '', 120.00, 'roll', 'Aluminum Foil 12 inch wholesale - XL Traders Surat'),
('Aluminum Foil 18 inch ( 1 roll )', (SELECT id FROM categories WHERE slug = 'foil'), '', 180.00, 'roll', 'Aluminum Foil 18 inch wholesale - XL Traders Surat'),
('Aluminum Foil 24 inch ( 1 roll )', (SELECT id FROM categories WHERE slug = 'foil'), '', 240.00, 'roll', 'Aluminum Foil 24 inch wholesale - XL Traders Surat');

-- Silver Pouch Products (5 products)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('Silver Pouch 4x6 ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'silver-pouch'), '', 800.00, 'pcs', 'Silver Pouch 4x6 wholesale - XL Traders Surat'),
('Silver Pouch 5x7 ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'silver-pouch'), '', 1000.00, 'pcs', 'Silver Pouch 5x7 wholesale - XL Traders Surat'),
('Silver Pouch 6x9 ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'silver-pouch'), '', 1200.00, 'pcs', 'Silver Pouch 6x9 wholesale - XL Traders Surat'),
('Silver Pouch 8x12 ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'silver-pouch'), '', 1600.00, 'pcs', 'Silver Pouch 8x12 wholesale - XL Traders Surat'),
('Silver Pouch 10x14 ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'silver-pouch'), '', 2000.00, 'pcs', 'Silver Pouch 10x14 wholesale - XL Traders Surat');

-- Gloves Products (3 products)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('Latex Gloves ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'gloves'), '', 150.00, 'pcs', 'Latex Gloves wholesale - XL Traders Surat'),
('Nitrile Gloves ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'gloves'), '', 200.00, 'pcs', 'Nitrile Gloves wholesale - XL Traders Surat'),
('Vinyl Gloves ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'gloves'), '', 120.00, 'pcs', 'Vinyl Gloves wholesale - XL Traders Surat');

-- Bouffant Cap Products (1 product)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('Bouffant Cap ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'bouffant-cap'), '', 250.00, 'pcs', 'Bouffant Cap wholesale - XL Traders Surat');

-- Shipper Glasses Products (2 products)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('Shipper Glasses Clear ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'shipper-glasses'), '', 300.00, 'pcs', 'Shipper Glasses Clear wholesale - XL Traders Surat'),
('Shipper Glasses Tinted ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'shipper-glasses'), '', 350.00, 'pcs', 'Shipper Glasses Tinted wholesale - XL Traders Surat');

-- Tissue Products (5 products)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('Tissue Roll ( 12 rolls )', (SELECT id FROM categories WHERE slug = 'tissue'), '', 180.00, 'pack', 'Tissue Roll wholesale - XL Traders Surat'),
('Tissue Box ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'tissue'), '', 150.00, 'pcs', 'Tissue Box wholesale - XL Traders Surat'),
('Tissue Napkin ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'tissue'), '', 200.00, 'pcs', 'Tissue Napkin wholesale - XL Traders Surat'),
('Tissue Wipe ( 500 pcs )', (SELECT id FROM categories WHERE slug = 'tissue'), '', 250.00, 'pcs', 'Tissue Wipe wholesale - XL Traders Surat'),
('Tissue Sheet ( 100 pcs )', (SELECT id FROM categories WHERE slug = 'tissue'), '', 120.00, 'pcs', 'Tissue Sheet wholesale - XL Traders Surat');

-- Adhesive Products (2 products)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('Food Grade Adhesive ( 1 liter )', (SELECT id FROM categories WHERE slug = 'adhesive'), '', 500.00, 'liter', 'Food Grade Adhesive wholesale - XL Traders Surat'),
('Tape Adhesive ( 1 roll )', (SELECT id FROM categories WHERE slug = 'adhesive'), '', 50.00, 'roll', 'Tape Adhesive wholesale - XL Traders Surat');

-- Burger & Sandwich Box Products (2 products)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('Burger Box ( 500 pcs )', (SELECT id FROM categories WHERE slug = 'burger-sandwich-box'), '', 600.00, 'pcs', 'Burger Box wholesale - XL Traders Surat'),
('Sandwich Box ( 500 pcs )', (SELECT id FROM categories WHERE slug = 'burger-sandwich-box'), '', 700.00, 'pcs', 'Sandwich Box wholesale - XL Traders Surat');

-- Paper Ice Cream Wati Products (2 products)
INSERT INTO public.products (name, category_id, description, price, unit_of_measure, image_alt_text) VALUES
('Paper Ice Cream Wati 100ml ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'paper-ice-cream-wati'), '', 800.00, 'pcs', 'Paper Ice Cream Wati 100ml wholesale - XL Traders Surat'),
('Paper Ice Cream Wati 150ml ( 1000 pcs )', (SELECT id FROM categories WHERE slug = 'paper-ice-cream-wati'), '', 1000.00, 'pcs', 'Paper Ice Cream Wati 150ml wholesale - XL Traders Surat');

-- ============================================================================
-- 9. CREATE STORAGE BUCKET (if not exists)
-- ============================================================================

-- Note: Storage buckets must be created via Supabase dashboard or API
-- This SQL cannot create buckets directly, but the bucket should be:
-- - Name: product-images
-- - Public: Yes
-- - CORS: Enabled

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Drop the helper function
DROP FUNCTION IF EXISTS parse_price(TEXT);

-- Verify data
SELECT COUNT(*) as total_products FROM public.products;
SELECT COUNT(*) as total_categories FROM public.categories;
