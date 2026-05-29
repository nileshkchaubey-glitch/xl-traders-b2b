# Admin Panel - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Make Your Account Admin

Run this in Supabase SQL Editor:

```sql
UPDATE user_profiles 
SET is_admin = true 
WHERE email = 'your-email@example.com';
```

### Step 2: Login

1. Go to `/auth`
2. Sign in with your email
3. You'll see `/admin` link in header

### Step 3: Access Admin Panel

- Click `/admin` in header, OR
- Go directly to `yoursite.com/admin`

---

## 📊 What You Can Do

### Products Tab
- ✅ Add new products (name, price, images, category)
- ✅ Edit product details
- ✅ Click price to edit inline
- ✅ Toggle active/inactive
- ✅ Delete products
- ✅ Search and filter by category
- ✅ Upload up to 5 images per product

### Categories Tab
- ✅ Add new categories
- ✅ Edit category details
- ✅ Delete categories
- ✅ Drag to reorder

### Enquiries Tab
- ✅ View all customer enquiries
- ✅ Filter by status (new/contacted/quoted/closed)
- ✅ Update enquiry status
- ✅ Send WhatsApp messages
- ✅ View full enquiry details

### Settings Tab
- ✅ Update WhatsApp number
- ✅ Update phone numbers
- ✅ Update email
- ✅ Update company info
- ✅ Update address and GST number

---

## 🎯 Common Tasks

### Add a Product

```
1. Click "Add Product"
2. Fill in:
   - Product Name: "50ml Attach Lid Container"
   - Category: Select from dropdown
   - Price: 3187
   - Unit: Per Piece
   - Description: (optional)
3. Upload image (optional)
4. Click "Create Product"
```

### Edit Product Price

```
1. Find product in table
2. Click on the price
3. Type new price
4. Press Enter
5. Done!
```

### Update WhatsApp Number

```
1. Go to Settings tab
2. Update "WhatsApp Number" field
3. Include country code (e.g., 919773239442)
4. Click "Save Settings"
```

### Track Enquiries

```
1. Go to Enquiries tab
2. See all customer enquiries
3. Click status to change it
4. Click WhatsApp icon to reply
```

---

## 🔑 Key Features

| Feature | Location | How |
|---------|----------|-----|
| Add Product | Products tab | Click "Add Product" button |
| Edit Product | Products tab | Click Edit icon |
| Delete Product | Products tab | Click Delete icon |
| Search | Products tab | Type in search box |
| Filter | Products tab | Select category |
| Reorder Categories | Categories tab | Drag and drop |
| View Enquiry | Enquiries tab | Click Eye icon |
| Send WhatsApp | Enquiries tab | Click WhatsApp icon |
| Update Settings | Settings tab | Edit and Save |

---

## 💡 Pro Tips

### Product Images
- Upload up to 5 images per product
- First image is the main product image
- Add alt text for SEO: "[Product] wholesale - XL Traders Surat"

### Pricing
- Click price directly to edit inline
- No need to open edit dialog
- Changes save immediately

### Enquiries
- Check "new" enquiries daily
- Update status as you progress
- Use WhatsApp to reply quickly

### Categories
- Add emoji icons (🥤, 📦, etc.)
- Drag to reorder display order
- Slug auto-generates from name

---

## ⚠️ Important Notes

### Before Deleting
- ✅ Deleting product removes it from catalog
- ✅ Deleting category doesn't delete products
- ❌ Deletion is permanent (no undo)

### Price Format
- Enter prices as numbers (3187, not ₹3,187)
- System converts to decimal (3187.00)

### Images
- Max 5 per product
- Formats: JPG, PNG, WebP
- Max size: 5MB each

### WhatsApp
- Include country code (91 for India)
- Format: 919773239442 (not +91-9773-239442)

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't access admin | Check if `is_admin = true` in database |
| Product not showing | Verify `is_active = true` |
| Image won't upload | Check file size (< 5MB) and format |
| Settings not saving | Check Supabase connection |
| Can't send WhatsApp | Verify phone number format |

---

## 📞 Support

- **Email**: xltraders990@gmail.com
- **WhatsApp**: 919773239442
- **Phone**: 9773239442

---

## 🔐 Security

- ✅ Only admins can access `/admin`
- ✅ All changes logged in database
- ✅ Passwords encrypted
- ✅ Sessions expire after 1 hour
- ✅ Log out when done

---

## 📚 Full Documentation

See `ADMIN_PANEL.md` for complete documentation with:
- Detailed feature explanations
- Database schema
- API reference
- Best practices
- Advanced tips

---

**Ready to manage your products?** Go to `/admin` now! 🚀
