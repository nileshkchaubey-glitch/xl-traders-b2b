# XL Traders B2B - SQL Schema Documentation

Complete database schema for the B2B packaging wholesale website.

## Database Tables

### 1. Categories

Stores product categories with display metadata.

```sql
CREATE TABLE categories (
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
```

**Indexes:**
- `idx_categories_slug` - Fast lookup by slug
- `idx_categories_is_active` - Filter active categories

**Sample Data:**
- Round Container 🥤
- Rectangle Container 📦
- Hinged Container 🍱
- Paper Box 📫
- Pizza Box 🍕
- Aluminum Containers 🥘
- And 15 more...

---

### 2. Products

Main products table with pricing and metadata.

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id),
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
```

**Indexes:**
- `idx_products_category_id` - Filter by category
- `idx_products_is_active` - Filter active products
- `idx_products_is_featured` - Get featured products
- `idx_products_name` - Full-text search on name
- `idx_products_description` - Full-text search on description

**Fields:**
- `price` - Wholesale price in ₹
- `mrp` - Maximum retail price (optional)
- `discount_percent` - Discount percentage (0-100)
- `image_url` - URL to primary product image
- `image_alt_text` - SEO alt text for image
- `image_description` - Detailed image description
- `specifications` - JSON object for custom specs
- `is_featured` - Show on homepage
- `display_order` - Sort order in listings

**Sample Products:**
- 50ml Attach Lid container (2550 pcs) - ₹3,187
- 100ml Round Container Black (1500 pcs) - ₹2,490
- 4X4X2 WHITE Paper Box (100 pcs) - ₹150
- And 130 more...

---

### 3. Product Images

Multiple images per product for gallery views.

```sql
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Indexes:**
- `idx_product_images_product_id` - Get images for product

**Fields:**
- `image_url` - URL to image in Supabase Storage
- `alt_text` - SEO alt text
- `description` - Image description for accessibility
- `display_order` - Order in gallery (0 = primary)

**Usage:**
- Product detail page gallery
- Multiple angles/variations
- Packaging examples

---

### 4. User Profiles

Extended user information linked to auth.users.

```sql
CREATE TABLE user_profiles (
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
```

**Indexes:**
- `idx_user_profiles_email` - Email lookup
- `idx_user_profiles_is_admin` - Find admin users

**Fields:**
- `company_name` - Business name
- `gst_number` - GST registration number
- `is_admin` - Admin panel access
- `is_active` - Account status

**Usage:**
- User authentication
- Company information
- Invoice generation
- Admin access control

---

### 5. Enquiries

Customer product enquiries and requests.

```sql
CREATE TABLE enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
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
```

**Indexes:**
- `idx_enquiries_user_id` - Get user's enquiries
- `idx_enquiries_product_id` - Get product enquiries
- `idx_enquiries_status` - Filter by status

**Fields:**
- `enquiry_source` - 'whatsapp', 'email', 'form'
- `status` - 'new', 'contacted', 'quoted', 'closed'
- `quantity_requested` - Bulk order quantity

**Usage:**
- WhatsApp enquiry tracking
- Sales pipeline
- Customer follow-up

---

## Row Level Security (RLS) Policies

### Categories

```sql
-- Public read access
SELECT: is_active = TRUE

-- Admin only write
INSERT/UPDATE/DELETE: user.is_admin = TRUE
```

### Products

```sql
-- Public read access
SELECT: is_active = TRUE

-- Admin only write
INSERT/UPDATE/DELETE: user.is_admin = TRUE
```

### Product Images

```sql
-- Public read access
SELECT: TRUE (always visible)

-- Admin only write
INSERT/UPDATE/DELETE: user.is_admin = TRUE
```

### User Profiles

```sql
-- Users see only their own profile
SELECT: auth.uid() = id

-- Admins see all profiles
SELECT: user.is_admin = TRUE

-- Users update only their own
UPDATE: auth.uid() = id

-- Admins update any
UPDATE: user.is_admin = TRUE
```

### Enquiries

```sql
-- Users see only their own enquiries
SELECT: user_id = auth.uid()

-- Admins see all
SELECT: user.is_admin = TRUE

-- Anyone can create
INSERT: TRUE

-- Admins can update status
UPDATE: user.is_admin = TRUE
```

---

## Indexes and Performance

### Full-Text Search

Products table has GIN indexes for fast text search:

```sql
-- Search by product name
SELECT * FROM products 
WHERE to_tsvector('english', name) @@ plainto_tsquery('english', 'container');

-- Search by description
SELECT * FROM products 
WHERE to_tsvector('english', description) @@ plainto_tsquery('english', 'food');
```

### Category Filtering

Fast category lookups:

```sql
-- Get all products in category
SELECT * FROM products 
WHERE category_id = 'uuid-here' AND is_active = TRUE
ORDER BY display_order;
```

### Featured Products

Quick homepage query:

```sql
-- Get featured products
SELECT * FROM products 
WHERE is_featured = TRUE AND is_active = TRUE
ORDER BY display_order
LIMIT 6;
```

---

## Data Types

### DECIMAL(10, 2)
Used for prices to avoid floating-point errors:
- Max value: 99,999,999.99
- Precision: 2 decimal places
- Perfect for currency

### JSONB
Used for flexible specifications:
```json
{
  "material": "Plastic",
  "capacity": "500ml",
  "color": "Transparent",
  "pack_size": "1000 pcs"
}
```

### UUID
Primary keys are UUIDs for:
- Distributed systems
- Privacy (non-sequential)
- Collision resistance

---

## Relationships

```
Categories (1) ──── (Many) Products
                         │
                         ├── (Many) Product Images
                         └── (Many) Enquiries

Auth Users (1) ──── (1) User Profiles
                        │
                        └── (Many) Enquiries
```

---

## Migration Steps

1. **Create tables** - Run all CREATE TABLE statements
2. **Create indexes** - Automatic with CREATE TABLE
3. **Enable RLS** - ALTER TABLE ... ENABLE ROW LEVEL SECURITY
4. **Create policies** - CREATE POLICY statements
5. **Insert categories** - 21 categories
6. **Insert products** - 133 products
7. **Create storage bucket** - `product-images` (public)

---

## Backup and Recovery

### Backup

```bash
# Export database
pg_dump postgresql://user:password@host/db > backup.sql

# Export specific table
pg_dump -t products postgresql://... > products.sql
```

### Recovery

```bash
# Restore database
psql postgresql://user:password@host/db < backup.sql

# Restore specific table
psql postgresql://user:password@host/db < products.sql
```

---

## Maintenance

### Vacuum and Analyze

```sql
-- Optimize table performance
VACUUM ANALYZE products;
VACUUM ANALYZE categories;
```

### Check Index Health

```sql
-- Find unused indexes
SELECT * FROM pg_stat_user_indexes 
WHERE idx_scan = 0;
```

### Monitor Growth

```sql
-- Table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Common Queries

### Get All Products with Category

```sql
SELECT 
  p.id,
  p.name,
  p.price,
  c.name as category,
  p.image_url
FROM products p
JOIN categories c ON p.category_id = c.id
WHERE p.is_active = TRUE
ORDER BY p.display_order;
```

### Search Products

```sql
SELECT * FROM products
WHERE to_tsvector('english', name || ' ' || COALESCE(description, '')) 
      @@ plainto_tsquery('english', 'container')
AND is_active = TRUE;
```

### Get Product with All Images

```sql
SELECT 
  p.*,
  json_agg(json_build_object(
    'id', pi.id,
    'url', pi.image_url,
    'alt_text', pi.alt_text
  )) as images
FROM products p
LEFT JOIN product_images pi ON p.id = pi.product_id
WHERE p.id = 'product-uuid'
GROUP BY p.id;
```

### Get Enquiries by Status

```sql
SELECT 
  e.*,
  p.name as product_name,
  u.company_name
FROM enquiries e
JOIN products p ON e.product_id = p.id
LEFT JOIN user_profiles u ON e.user_id = u.id
WHERE e.status = 'new'
ORDER BY e.created_at DESC;
```

---

## Notes

- All timestamps use UTC timezone
- Prices are in Indian Rupees (₹)
- Product names are unique (prevents duplicates)
- Category slugs are URL-friendly (lowercase, hyphens)
- RLS policies ensure data privacy and security
