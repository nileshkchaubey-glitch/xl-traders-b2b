# XL Traders Admin Panel - Complete Guide

## Overview

The Admin Panel is a complete product management system built into the XL Traders B2B website. Admins have full control over products, categories, enquiries, and business settings without depending on external tools.

## Access & Authentication

### Login

1. Go to `/auth` or click "Sign In" button
2. Enter admin email and password
3. Click "Sign In"
4. You'll be redirected to `/admin` automatically

### Admin Requirements

- Account must have `is_admin = true` in the database
- Use Supabase to set admin status:

```sql
UPDATE user_profiles SET is_admin = true WHERE email = 'admin@xltraders.com';
```

### Create First Admin

1. Sign up normally via the website
2. In Supabase SQL Editor, run:

```sql
UPDATE user_profiles
SET is_admin = true
WHERE email = 'your-email@example.com';
```

## Admin Dashboard Layout

The admin panel has 4 main sections accessible via tabs:

```
┌─────────────────────────────────────────────────────────┐
│  XL Traders Admin Panel          [User] [Logout]        │
├─────────────────────────────────────────────────────────┤
│  [Products] [Categories] [Enquiries] [Settings]         │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [Active Tab Content]                                    │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Products Management

### Overview

Manage all products in your catalog with full CRUD operations.

**Features:**

- ✅ Add new products
- ✅ Edit existing products
- ✅ Delete products
- ✅ Upload up to 5 images per product
- ✅ Inline price editing
- ✅ Quick active/inactive toggle
- ✅ Search and filter by category
- ✅ SEO fields (alt text, descriptions)

### Product Table Columns

| Column   | Description                         |
| -------- | ----------------------------------- |
| Image    | Product thumbnail                   |
| Name     | Product name                        |
| Category | Product category                    |
| Price    | Wholesale price (clickable to edit) |
| Status   | Active/Inactive badge               |
| Actions  | Edit and Delete buttons             |

### Add Product

1. Click **"Add Product"** button
2. Fill in the form:

| Field        | Required | Notes                                     |
| ------------ | -------- | ----------------------------------------- |
| Product Name | ✓        | e.g., "50ml Attach Lid Container"         |
| Category     | ✓        | Select from dropdown                      |
| Price        | ✓        | Wholesale price in ₹                      |
| MRP          | ✗        | Maximum retail price                      |
| Unit         | ✓        | Per Piece / Per Box / Per Pack / Per Roll |
| Discount %   | ✗        | 0-100                                     |
| Description  | ✗        | Product details                           |
| Images       | ✗        | Up to 5 images                            |
| Active       | ✓        | Toggle to activate/deactivate             |

3. For each image:
   - Add **Alt Text** (for SEO): "50ml Attach Lid Container wholesale - XL Traders Surat"
   - Add **Description**: "High-quality plastic container..."

4. Click **"Create Product"**

### Edit Product

1. Find product in the table
2. Click **Edit** button (pencil icon)
3. Update fields as needed
4. Click **"Update Product"**

### Delete Product

1. Find product in the table
2. Click **Delete** button (trash icon)
3. Confirm deletion

### Quick Price Edit

1. Click on the price in the table
2. Enter new price
3. Press Enter or click away
4. Price updates immediately

### Toggle Active/Inactive

1. Click the status badge (Active/Inactive)
2. Status toggles immediately
3. Inactive products don't show in catalog

### Search & Filter

**Search by name:**

- Type in search box
- Results filter in real-time

**Filter by category:**

- Select category from dropdown
- Shows only products in that category

**Combine filters:**

- Use both search and category filter together

---

## 2. Categories Management

### Overview

Manage product categories with drag-to-reorder functionality.

**Features:**

- ✅ Add new categories
- ✅ Edit category details
- ✅ Delete categories
- ✅ Drag to reorder (display order)
- ✅ Add emoji icons

### Add Category

1. Click **"Add Category"** button
2. Fill in:

| Field         | Required | Notes                        |
| ------------- | -------- | ---------------------------- |
| Category Name | ✓        | e.g., "Round Container"      |
| Slug          | ✓        | Auto-generated, URL-friendly |
| Icon Emoji    | ✗        | e.g., "🥤"                   |
| Description   | ✗        | Category description         |

3. Click **"Create"**

### Edit Category

1. Click **Edit** button on category card
2. Update fields
3. Click **"Update"**

### Delete Category

1. Click **Delete** button on category card
2. Confirm deletion
3. ⚠️ Note: Products in this category won't be deleted

### Reorder Categories

1. Drag category card to new position
2. Drop to reorder
3. Order saves automatically

### Current Categories (21 total)

- 🥤 Round Container
- 📦 Rectangle Container
- 🔗 Hinged Container
- 🥫 Aluminum Container
- 🍕 Pizza Box
- 📄 Paper Box
- 🎁 Gift Box
- 🍔 Burger Box
- 🍜 Noodle Box
- 🥗 Salad Box
- 🧁 Bakery Box
- 📮 Mailer Box
- 🎪 Tent Card
- 🏷️ Label Roll
- 📋 Takeaway Box
- 🛍️ Shopping Bag
- 🥤 Disposable Cup
- 🍴 Cutlery Set
- 🧊 Ice Pack
- 📦 Packing Material
- 🎯 Other

---

## 3. Enquiries Log

### Overview

Track all customer enquiries submitted through the website.

**Features:**

- ✅ View all enquiries
- ✅ Filter by status
- ✅ Update enquiry status
- ✅ Send WhatsApp messages
- ✅ View full enquiry details

### Enquiry Table Columns

| Column   | Description                       |
| -------- | --------------------------------- |
| Customer | Customer name and phone           |
| Product  | Company name (if provided)        |
| Quantity | Requested quantity                |
| Status   | new / contacted / quoted / closed |
| Date     | Enquiry submission date           |
| Actions  | View details / Send WhatsApp      |

### Enquiry Status

| Status        | Meaning                              |
| ------------- | ------------------------------------ |
| **new**       | Just received, not contacted         |
| **contacted** | Reached out to customer              |
| **quoted**    | Sent price quote                     |
| **closed**    | Order placed or no longer interested |

### Update Status

1. Click status dropdown in table
2. Select new status
3. Status updates immediately

### Send WhatsApp

1. Click WhatsApp icon in Actions
2. Pre-filled message opens in WhatsApp Web
3. Send message to customer

### View Details

1. Click Eye icon in Actions
2. Dialog shows:
   - Customer information
   - Enquiry details
   - Message (if provided)
   - Action buttons

### Filter by Status

1. Select status from dropdown
2. Table shows only enquiries with that status

---

## 4. Settings

### Overview

Manage business information and contact details displayed throughout the site.

**Sections:**

#### Business Information

| Field        | Usage                   |
| ------------ | ----------------------- |
| Company Name | Header and invoices     |
| GST Number   | Invoice generation      |
| Address      | Footer and contact page |
| City         | Contact information     |
| State        | Contact information     |
| Pincode      | Shipping and contact    |
| Description  | About company section   |

#### Contact Information

| Field           | Usage                               |
| --------------- | ----------------------------------- |
| WhatsApp Number | Enquiry buttons (with country code) |
| Phone 1         | Header and footer                   |
| Phone 2         | Header and footer                   |
| Email           | Header and footer                   |

### Update Settings

1. Edit fields as needed
2. Click **"Save Settings"**
3. Settings save to database and localStorage

### Preview

At the bottom, see how settings appear on the website:

- Company name
- Full address
- WhatsApp number
- Email
- GST number (if set)

---

## Product Import & Bulk Operations

### Import from Google Sheet

Use the Python import script to bulk import products:

```bash
# Set environment variables
export VITE_SUPABASE_URL=your-url
export SUPABASE_SERVICE_ROLE_KEY=your-key

# Run import
python3 scripts/import_products.py
```

This will:

- ✅ Fetch 133 products from Google Sheet
- ✅ Download images from Google Drive
- ✅ Upload to Supabase Storage
- ✅ Insert into database
- ✅ Generate SEO alt text

### Manual Bulk Upload

For multiple products:

1. Use import script (faster)
2. Or add one by one via admin panel

---

## Database Integration

### Supabase Tables

**Products Table:**

```sql
id, name, category_id, description, price, mrp,
unit_of_measure, discount_percent, image_url,
image_alt_text, image_description, is_active,
is_featured, display_order, created_at, updated_at
```

**Categories Table:**

```sql
id, name, slug, description, icon_emoji,
display_order, is_active, created_at, updated_at
```

**Enquiries Table:**

```sql
id, user_id, product_id, customer_name,
customer_email, customer_phone, customer_company,
quantity_requested, message, enquiry_source,
status, created_at, updated_at
```

**User Profiles Table:**

```sql
id, email, company_name, contact_person, phone,
address, city, state, pincode, gst_number,
is_admin, is_active, created_at, updated_at
```

### Row Level Security (RLS)

- **Products**: Admins can CRUD, everyone can read active products
- **Categories**: Admins can CRUD, everyone can read active categories
- **Enquiries**: Admins can view all, users see their own
- **User Profiles**: Users see only their own, admins see all

---

## Keyboard Shortcuts

| Shortcut | Action                          |
| -------- | ------------------------------- |
| `Tab`    | Navigate between fields         |
| `Enter`  | Submit form / Save inline edit  |
| `Esc`    | Close dialog                    |
| `Ctrl+S` | Save settings (on Settings tab) |

---

## Tips & Best Practices

### Product Management

✅ **Do:**

- Use clear, descriptive product names
- Add all 5 images for better visibility
- Write detailed descriptions for SEO
- Set accurate prices
- Use relevant categories
- Add emoji icons to categories

❌ **Don't:**

- Leave prices at 0
- Use vague product names
- Upload low-quality images
- Forget to add alt text
- Create duplicate products

### SEO Optimization

**Alt Text Format:**

```
[Product Name] wholesale - XL Traders Surat
```

**Description Format:**

```
High-quality [category] - [product name].
Wholesale packaging solutions from XL Traders, Surat.
Fast delivery, GST invoicing available.
```

### Enquiry Management

1. **New** → Contact within 24 hours
2. **Contacted** → Send quote within 48 hours
3. **Quoted** → Follow up after 3 days
4. **Closed** → Archive old enquiries

---

## Troubleshooting

### Can't Access Admin Panel

**Problem:** Redirected to login page
**Solution:**

- Ensure you're logged in with admin account
- Check `is_admin = true` in database

**Problem:** "Admin access required" message
**Solution:**

- Your account is not admin
- Ask another admin to promote you
- Run SQL: `UPDATE user_profiles SET is_admin = true WHERE email = '...'`

### Products Not Showing

**Problem:** Added product but can't see it
**Solution:**

- Check `is_active = true`
- Verify category exists
- Refresh page

### Images Not Uploading

**Problem:** "Failed to upload image" error
**Solution:**

- Check file size (< 5MB)
- Check file format (JPG, PNG, WebP)
- Verify Supabase Storage bucket exists
- Check storage permissions

### Settings Not Saving

**Problem:** Settings revert after refresh
**Solution:**

- Check Supabase connection
- Settings save to localStorage as fallback
- Try again in a few seconds

---

## Security Notes

### Admin Privileges

- ✅ Can add/edit/delete all products
- ✅ Can manage categories
- ✅ Can view all enquiries
- ✅ Can update business settings
- ✅ Can promote other admins (via SQL)

### Data Protection

- ✅ All operations logged in Supabase
- ✅ Row Level Security prevents unauthorized access
- ✅ Passwords encrypted by Supabase
- ✅ Session tokens expire after 1 hour

### Best Practices

1. **Use strong passwords** (12+ characters, mixed case)
2. **Don't share admin credentials**
3. **Log out when done** (especially on shared computers)
4. **Backup database regularly**
5. **Review enquiries daily**

---

## API Reference

### Product Service

```typescript
// Get all products
const products = await productService.getAll();

// Get single product
const product = await productService.get(productId);

// Create product
const newProduct = await productService.create(productData);

// Update product
const updated = await productService.update(productId, updates);

// Delete product
await productService.delete(productId);

// Toggle active
await productService.toggleActive(productId, isActive);
```

### Category Service

```typescript
// Get all categories
const categories = await categoryService.getAll();

// Create category
const newCat = await categoryService.create(categoryData);

// Update category
const updated = await categoryService.update(categoryId, updates);
```

### Storage Service

```typescript
// Upload product image
const url = await storageService.uploadProductImage(file, productId);

// Get public URL
const publicUrl = storageService.getPublicUrl(path);
```

---

## Support & Contact

For issues or questions:

1. Check troubleshooting section above
2. Review Supabase logs
3. Check browser console for errors
4. Contact: xltraders990@gmail.com

---

## Version History

| Version | Date     | Changes         |
| ------- | -------- | --------------- |
| 1.0     | May 2026 | Initial release |

---

## Glossary

- **Admin**: User with full access to manage products and settings
- **Category**: Product grouping (e.g., Round Container)
- **Enquiry**: Customer request for product information
- **RLS**: Row Level Security - database access control
- **Supabase**: Backend database and authentication service
- **SKU**: Stock Keeping Unit - product identifier
- **MRP**: Maximum Retail Price
- **GST**: Goods and Services Tax (India)
