# XL Traders B2B Website

A professional, production-ready B2B website for XL Traders, a wholesale packaging supplier in Surat, India.

## 🚀 Features

- **Product Catalog**: Browse and search 1000+ packaging products
- **User Authentication**: Supabase-powered login/signup with price protection
- **Admin Panel**: Add, edit, delete products with image uploads
- **WhatsApp Integration**: Direct enquiry button on every product
- **Responsive Design**: Desktop-first layout with mobile support
- **Fast Search**: Real-time product search across name and description
- **Category Filtering**: Browse by product categories
- **Grid/List Toggle**: Switch between grid and list views
- **GST Invoice Support**: Mention throughout the site
- **Image Management**: Upload and manage product images via Supabase Storage

## 🛠️ Tech Stack

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **State Management**: Zustand
- **Routing**: Wouter
- **UI Components**: shadcn/ui
- **Deployment**: Netlify

## 📋 Prerequisites

- Node.js 22.13.0+
- pnpm 10.15.1+
- Supabase account (free tier available)
- Google Sheets (for data import)
- Google Drive (for image storage)

## ⚙️ Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd xl-traders-b2b
pnpm install
```

### 2. Supabase Setup

#### Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Get your **Project URL** and **Anon Key** from Settings → API

#### Create Database Schema

1. In Supabase, go to SQL Editor
2. Copy the entire content of `supabase-schema.sql`
3. Paste and execute in the SQL Editor
4. This creates all tables, indexes, RLS policies, and sample categories

#### Create Storage Buckets

1. Go to Storage in Supabase dashboard
2. Create a new bucket named `product-images` (public)
3. Set it to public so images are accessible

### 3. Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Business Information
VITE_BUSINESS_NAME=XL Traders
VITE_BUSINESS_CITY=Surat
VITE_BUSINESS_STATE=Gujarat
VITE_BUSINESS_COUNTRY=India

# Contact Information
VITE_WHATSAPP_NUMBER=919773239442
VITE_PHONE_1=9773239442
VITE_PHONE_2=7778052990
VITE_EMAIL=xltraders990@gmail.com

# Feature Flags
VITE_ENABLE_PRICE_PROTECTION=true
VITE_ENABLE_ADMIN_PANEL=true
VITE_ENABLE_ENQUIRY_FORM=true
```

### 4. Run Development Server

```bash
pnpm dev
```

Visit `http://localhost:3000` in your browser.

## 📊 Data Import

### Option A: Import from Google Sheets (Recommended)

#### Prerequisites

```bash
pip install google-auth-oauthlib google-auth-httplib2 google-api-python-client supabase requests
```

#### Run Import Script

```bash
python3 import_products.py \
  --sheets-id "1FEUf8vFpKmtK-hpnrc3DDoN93dBfOhI2Em8or-T7o6w" \
  --supabase-url "https://your-project.supabase.co" \
  --supabase-key "your-anon-key-here"
```

This script will:
- Fetch products from Google Sheets
- Download images from Google Drive
- Upload images to Supabase Storage
- Create products in the database
- Automatically create categories

#### Optional Flags

```bash
--skip-images          # Skip image download/upload
--sheet-name "products"  # Specify sheet name (default: "products")
```

### Option B: Manual Entry

1. Sign in to the admin panel (`/admin`)
2. Click "Add Product"
3. Fill in product details
4. Upload images
5. Click "Add Product"

## 🔐 Authentication

### User Roles

- **Guest**: Can browse catalog but cannot see prices
- **Authenticated User**: Can see prices and manage enquiries
- **Admin**: Full access to admin panel (manage products, categories, images)

### Make User Admin

In Supabase SQL Editor:

```sql
UPDATE public.user_profiles
SET is_admin = TRUE
WHERE email = 'admin@example.com';
```

## 📁 Project Structure

```
xl-traders-b2b/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx          # Navigation header
│   │   │   ├── Footer.tsx          # Footer with contact info
│   │   │   └── ProductCard.tsx     # Product card component
│   │   ├── pages/
│   │   │   ├── Home.tsx            # Homepage
│   │   │   ├── Catalog.tsx         # Product catalog
│   │   │   ├── ProductDetail.tsx   # Product detail page
│   │   │   ├── Auth.tsx            # Login/signup
│   │   │   └── Admin.tsx           # Admin panel
│   │   ├── lib/
│   │   │   ├── supabase.ts         # Supabase client
│   │   │   ├── authStore.ts        # Auth state (Zustand)
│   │   │   └── productService.ts   # Product API calls
│   │   ├── App.tsx                 # Main app component
│   │   └── index.css               # Global styles
│   ├── index.html                  # HTML template
│   └── public/                     # Static files
├── supabase-schema.sql             # Database schema
├── import_products.py              # Data import script
├── netlify.toml                    # Netlify deployment config
├── package.json                    # Dependencies
└── README.md                       # This file
```

## 🎨 Design System

### Colors

- **Primary**: Navy `#0f172a`
- **Accent**: Red `#dc2626`
- **Background**: Slate `#f1f5f9`
- **Cards**: White `#ffffff`

### Typography

- **Font**: Inter (Google Fonts)
- **Weights**: 400, 500, 600, 700, 800
- **Headings**: Bold (700-800)
- **Body**: Regular (400-500)

### Spacing

- Uses Tailwind's default spacing scale
- Responsive padding/margin for mobile-first design

## 🚀 Deployment

### Deploy to Netlify

1. Push code to GitHub
2. Connect GitHub repo to Netlify
3. Set environment variables in Netlify dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - All business contact variables
4. Deploy

### Build for Production

```bash
pnpm build
```

Output will be in the `dist/` directory.

### Deploy to Other Platforms

The code is self-hostable and can be deployed to:
- Vercel
- AWS Amplify
- Railway
- Render
- Any static hosting with Node.js support

## 📱 Features Breakdown

### Homepage

- Top info bar with contact details
- Hero section with CTA buttons
- Category cards
- Featured products grid
- Why Choose Us section
- CTA section

### Product Catalog

- Sidebar category filter
- Search functionality
- Sort options (newest, name, price)
- Grid/List view toggle
- Responsive product cards
- Mobile-friendly filters

### Product Detail

- Large product image gallery
- Product specifications
- Price display (login required)
- WhatsApp enquiry button
- Call button
- Share functionality
- Related information

### Authentication

- Email/password signup
- Email/password signin
- Company name collection
- Profile management
- Price protection (hidden until login)

### Admin Panel

- Product CRUD operations
- Image upload to Supabase Storage
- Category management
- Product active/inactive toggle
- Bulk product management
- Admin-only access

## 🔧 Customization

### Change Colors

Edit `client/src/index.css` to modify Tailwind theme colors.

### Change Business Information

Update environment variables in `.env.local`:

```env
VITE_BUSINESS_NAME=Your Company
VITE_WHATSAPP_NUMBER=your-whatsapp-number
VITE_PHONE_1=your-phone
VITE_EMAIL=your-email
```

### Add New Pages

1. Create new file in `client/src/pages/`
2. Add route in `client/src/App.tsx`
3. Import components as needed

### Modify Product Fields

1. Update database schema in `supabase-schema.sql`
2. Update TypeScript types in `client/src/lib/supabase.ts`
3. Update forms in admin panel and import script

## 🐛 Troubleshooting

### Products not loading

- Check Supabase connection in browser console
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Check RLS policies in Supabase

### Images not uploading

- Verify `product-images` bucket exists and is public
- Check Supabase Storage permissions
- Check file size (max 50MB)

### Auth not working

- Verify Supabase auth is enabled
- Check email confirmation settings
- Clear browser cookies and try again

### Admin panel not accessible

- Verify user is marked as admin in database
- Check RLS policies allow admin operations
- Clear cache and reload

## 📚 API Documentation

### Product Service

```typescript
// Get all products
const products = await productService.getAll();

// Get product by ID
const product = await productService.getById(id);

// Search products
const results = await productService.search('container');

// Get featured products
const featured = await productService.getFeatured(6);

// Create product
const newProduct = await productService.create({...});

// Update product
await productService.update(id, {...});

// Delete product
await productService.delete(id);
```

### Auth Store

```typescript
// Initialize auth
await useAuthStore().initialize();

// Sign up
const { error } = await useAuthStore().signUp(email, password, company);

// Sign in
const { error } = await useAuthStore().signIn(email, password);

// Sign out
await useAuthStore().signOut();

// Check auth state
const { isAuthenticated, isAdmin, user, profile } = useAuthStore();
```

## 📝 License

This project is proprietary to XL Traders.

## 📞 Support

For issues or questions:
- WhatsApp: 919773239442
- Email: xltraders990@gmail.com
- Phone: 9773239442

## 🎯 Future Enhancements

- [ ] Payment integration (Stripe/Razorpay)
- [ ] Order management system
- [ ] Inventory tracking
- [ ] Customer reviews
- [ ] Bulk order discounts
- [ ] Email notifications
- [ ] SMS notifications
- [ ] Analytics dashboard
- [ ] Multi-language support
- [ ] Mobile app

---

Built with ❤️ for XL Traders
