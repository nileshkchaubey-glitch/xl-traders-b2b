# XL Traders B2B - Product Import Guide

This guide explains how to import 133 products from the Google Sheet into your Supabase database.

## Quick Start (5 minutes)

### 1. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to **SQL Editor** and run the migration SQL:
   - Copy the contents of `supabase-migration-with-products.sql`
   - Paste into the SQL editor
   - Click **Execute**
4. Go to **Storage** and create a bucket:
   - Name: `product-images`
   - Public: **Yes**
   - Click **Create bucket**

### 2. Get Your Credentials

1. Go to **Settings → API**
2. Copy these values:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Create `.env.local`

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 4. Run the Import

**Option A: Python (Recommended - Faster)**

```bash
# Install dependencies
pip install supabase requests

# Run import
python3 scripts/import_products.py
```

**Option B: TypeScript**

```bash
# Install dependencies
pnpm add csv-parse node-fetch

# Run import
npx ts-node scripts/import-from-sheet.ts
```

## What Gets Imported

- **133 Products** across 21 categories
- **Product Images** downloaded from Google Drive
- **SEO Alt Text** automatically generated
- **Product Descriptions** with category and company info
- **Pricing** from the sheet

## Database Schema

### Categories Table

- 21 product categories (Round Container, Paper Box, etc.)
- Each category has an emoji icon and display order

### Products Table

- Product name, category, description
- Price (₹ format converted to decimal)
- Image URL and alt text
- Active/Featured flags
- Created/Updated timestamps

### Product Images Table

- Multiple images per product
- Alt text and description for each image
- Display order for gallery

### User Profiles Table

- User authentication data
- Company information
- GST number
- Admin flag

### Enquiries Table

- Customer enquiries for products
- WhatsApp integration
- Status tracking

## Row Level Security (RLS)

The database is configured with RLS policies:

| Table          | Public Read | Authenticated | Admin Only |
| -------------- | ----------- | ------------- | ---------- |
| Categories     | ✓           | ✓             | CRUD       |
| Products       | ✓           | ✓             | CRUD       |
| Product Images | ✓           | ✓             | CRUD       |
| User Profiles  | Own only    | Own           | All        |
| Enquiries      | Own only    | Own           | All        |

**Price Protection**: Prices are visible to all users (no hiding). To hide prices until login, modify the RLS policy in the SQL file.

## Troubleshooting

### "Missing Supabase credentials"

- Check `.env.local` file exists
- Verify `VITE_SUPABASE_URL` and keys are correct
- Restart dev server after adding .env.local

### "Category not found"

- The category must exist in the database first
- Run the SQL migration to create all 21 categories
- Check category names match exactly

### "Failed to download image"

- Google Drive link might be expired
- Check the image_download_link in the sheet
- Verify Google Drive folder is publicly accessible

### "Storage bucket not found"

- Create the bucket manually in Supabase dashboard
- Name must be: `product-images`
- Must be set to **Public**

## Manual Product Addition

After import, add products via the Admin Panel:

1. Go to `/admin` (requires login)
2. Click **Add Product**
3. Fill in details:
   - Name
   - Category
   - Price
   - Description
   - Upload image
4. Click **Save**

## Updating Products

To update existing products:

```bash
# Run import again - it will update matching products
python3 scripts/import_products.py
```

Products are matched by name. If the name changes, it creates a new product.

## Image Management

### Automatic Image Processing

The import script:

1. Downloads images from Google Drive
2. Uploads to Supabase Storage
3. Generates public URLs
4. Creates alt text: `"[Product name] wholesale - XL Traders Surat"`
5. Creates description: `"High-quality [category] - [product name]..."`

### Manual Image Upload

1. Go to Admin Panel
2. Click product → **Edit Images**
3. Upload new image
4. Add alt text and description
5. Save

### Image Storage Structure

```
product-images/
├── [product-id]/
│   ├── image1.jpg
│   ├── image2.jpg
│   └── image3.jpg
└── [product-id]/
    └── image.jpg
```

## API Usage

### Fetch All Products

```typescript
const { data: products } = await supabase
  .from("products")
  .select("*")
  .eq("is_active", true);
```

### Search Products

```typescript
const { data } = await supabase
  .from("products")
  .select("*")
  .or(`name.ilike.%query%,description.ilike.%query%`);
```

### Get Products by Category

```typescript
const { data } = await supabase
  .from("products")
  .select("*")
  .eq("category_id", categoryId);
```

### Create Enquiry

```typescript
const { data } = await supabase.from("enquiries").insert({
  product_id: productId,
  customer_name: "John Doe",
  customer_email: "john@example.com",
  customer_phone: "9773239442",
  quantity_requested: 100,
  message: "Interested in bulk order",
});
```

## CSV Format Reference

The Google Sheet must have these columns:

| Column              | Type | Example                                              |
| ------------------- | ---- | ---------------------------------------------------- |
| item_name           | Text | "50ml Attach Lid container (2550 pcs)"               |
| category            | Text | "Round Container"                                    |
| description         | Text | "Food-grade container"                               |
| price               | Text | "₹3,187.00"                                          |
| image_download_link | URL  | "https://drive.google.com/uc?export=download&id=..." |
| image_file_name     | Text | "50ml_Attach_Lid_container.jpg"                      |

## Performance Notes

- Import of 133 products: ~2-5 minutes
- Image downloads: ~30 seconds
- Database inserts: ~1 minute
- Total time: ~5 minutes

To speed up:

1. Use Python script (faster than TypeScript)
2. Increase `BATCH_SIZE` in import script
3. Use service role key (faster than anon key)

## Next Steps

1. ✅ Run SQL migration
2. ✅ Create `.env.local`
3. ✅ Run import script
4. ✅ Test product catalog page
5. ✅ Test search functionality
6. ✅ Test admin panel
7. ✅ Deploy to production

## Support

For issues:

1. Check the troubleshooting section above
2. Verify Supabase credentials
3. Check database tables exist
4. Check storage bucket is public
5. Review import script logs

## Files Included

- `supabase-migration-with-products.sql` - Database schema and seed data
- `scripts/import_products.py` - Python import script (recommended)
- `scripts/import-from-sheet.ts` - TypeScript import script
- `IMPORT_GUIDE.md` - This file
