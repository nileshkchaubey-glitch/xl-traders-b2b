# XL Traders B2B - Self-Hosted Setup Guide

Complete step-by-step guide to deploy XL Traders website on Netlify + Supabase.

## Prerequisites

- Node.js 18+ installed
- npm or pnpm package manager
- Git account (for version control)
- Netlify account (free tier available)
- Supabase account (free tier available)

---

## Step 1: Create Supabase Project

### 1.1 Create Account & Project

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with email or GitHub
4. Create a new organization
5. Create a new project:
   - **Project name**: `xl-traders` (or your choice)
   - **Database password**: Create strong password (save this!)
   - **Region**: Choose closest to your users
   - **Pricing plan**: Free tier is fine

### 1.2 Wait for Project to Initialize

- This takes 2-3 minutes
- You'll see a "Connecting..." status
- Once ready, you'll see the dashboard

### 1.3 Get Your API Keys

1. Go to **Settings → API**
2. Copy these values and save them:

```
Project URL:           https://your-project.supabase.co
Anon Public Key:       eyJhbGc...
Service Role Key:      eyJhbGc...
```

### 1.4 Create Storage Bucket

1. Go to **Storage** in left sidebar
2. Click **"Create a new bucket"**
3. Name it: `product-images`
4. Make it **Public** (toggle on)
5. Click **Create bucket**

### 1.5 Run SQL Migration

1. Go to **SQL Editor** in left sidebar
2. Click **"New query"**
3. Copy entire contents of `supabase-migration-with-products.sql`
4. Paste into the SQL editor
5. Click **"Run"** (or press Ctrl+Enter)
6. Wait for completion (should show "Success")

**Result**: All tables created with 133 sample products!

---

## Step 2: Set Up Local Project

### 2.1 Download & Extract Code

1. Extract the ZIP file to your computer
2. Open terminal/command prompt
3. Navigate to project folder:
   ```bash
   cd xl-traders-b2b
   ```

### 2.2 Install Dependencies

```bash
npm install
```

This installs all required packages (takes 2-3 minutes).

### 2.3 Create .env.local File

1. Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

2. Open `.env.local` in a text editor

3. Fill in your Supabase credentials:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   ```

   Replace with actual values from Step 1.3

### 2.4 Test Locally

```bash
npm run dev
```

- Opens at `http://localhost:3000`
- Try browsing products
- Try signing in (create test account)
- Try admin panel (`/admin`)

Press `Ctrl+C` to stop.

---

## Step 3: Build for Production

### 3.1 Create Production Build

```bash
npm run build
```

This creates optimized files in `dist/public/` folder.

**Result**: Production-ready code (~367 KB gzipped)

### 3.2 Verify Build

```bash
npm run preview
```

- Opens production build locally
- Verify everything works
- Press `Ctrl+C` to stop

---

## Step 4: Deploy to Netlify

### 4.1 Create Netlify Account

1. Go to [netlify.com](https://netlify.com)
2. Sign up (free tier available)
3. Verify email

### 4.2 Connect GitHub (Recommended)

1. Push your code to GitHub:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/xl-traders-b2b.git
   git branch -M main
   git push -u origin main
   ```

2. In Netlify dashboard:
   - Click **"Add new site"**
   - Select **"Import an existing project"**
   - Choose **GitHub**
   - Select your `xl-traders-b2b` repository

3. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist/public`
   - Click **Deploy**

### 4.3 Add Environment Variables

1. In Netlify dashboard, go to **Site settings**
2. Click **"Environment variables"**
3. Add your Supabase credentials:
   - **Key**: `VITE_SUPABASE_URL`
   - **Value**: `https://your-project.supabase.co`
   - Click **Save**

4. Add second variable:
   - **Key**: `VITE_SUPABASE_ANON_KEY`
   - **Value**: `eyJhbGc...`
   - Click **Save**

5. Redeploy:
   - Go to **Deploys**
   - Click **"Trigger deploy"** → **"Deploy site"**

### 4.4 Get Your Live URL

- Netlify generates a URL like: `https://xl-traders-abc123.netlify.app`
- Your site is now live! 🎉

### 4.5 (Optional) Custom Domain

1. In Netlify, go to **Domain settings**
2. Click **"Add custom domain"**
3. Enter your domain (e.g., `xltraders.com`)
4. Follow DNS setup instructions
5. Wait for DNS propagation (5-30 minutes)

---

## Step 5: Import Products from Google Sheet

### 5.1 Prepare Environment

```bash
# Set environment variables
export VITE_SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### 5.2 Run Import Script

```bash
# Install dependencies
pip install supabase requests

# Run import
python3 scripts/import_products.py
```

This will:

- Fetch 133 products from Google Sheet
- Download images from Google Drive
- Upload to Supabase Storage
- Insert into database

**Result**: All products imported with images! ✅

---

## Step 6: Create Admin User

### 6.1 Sign Up

1. Go to your live site
2. Click **"Sign In"**
3. Click **"Sign Up"**
4. Create account with email and password

### 6.2 Make Admin

1. Go to Supabase dashboard
2. Click **SQL Editor**
3. Run this query:

   ```sql
   UPDATE user_profiles
   SET is_admin = true
   WHERE email = 'your-email@example.com';
   ```

4. Go back to your site
5. Sign out and sign in again
6. You should now see `/admin` link in header

---

## Step 7: Configure Business Settings

### 7.1 Update Settings

1. Go to `/admin` → **Settings tab**
2. Update:
   - Company name
   - WhatsApp number (with country code: 919773239442)
   - Phone numbers
   - Email
   - Address
   - GST number
3. Click **"Save Settings"**

### 7.2 Add Products

1. Go to `/admin` → **Products tab**
2. Click **"Add Product"**
3. Fill in details:
   - Name
   - Category
   - Price
   - Description
   - Upload images
4. Click **"Create Product"**

---

## Troubleshooting

### Build Fails

**Error**: `Cannot find module '@supabase/supabase-js'`

**Solution**:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Blank Page on Netlify

**Error**: Site shows blank page

**Solution**:

1. Check environment variables are set
2. Check Supabase URL and key are correct
3. Check browser console for errors (F12)
4. Redeploy: Netlify → Deploys → Trigger deploy

### Products Not Showing

**Error**: Catalog page is empty

**Solution**:

1. Check SQL migration ran successfully
2. Check products are marked `is_active = true`
3. Check Supabase connection in `.env.local`
4. Try importing products again

### Images Not Loading

**Error**: Product images show broken image icon

**Solution**:

1. Check `product-images` bucket exists in Supabase Storage
2. Check bucket is set to **Public**
3. Check images uploaded successfully
4. Try re-importing products

### Can't Access Admin Panel

**Error**: Redirected to login when visiting `/admin`

**Solution**:

1. Sign in first
2. Check your account has `is_admin = true` in database
3. Run SQL: `UPDATE user_profiles SET is_admin = true WHERE email = '...'`

### WhatsApp Not Working

**Error**: WhatsApp button doesn't work

**Solution**:

1. Check WhatsApp number includes country code (91 for India)
2. Format should be: `919773239442` (not `+91-9773-239442`)
3. Update in Settings tab

---

## File Structure

```
xl-traders-b2b/
├── client/
│   ├── src/
│   │   ├── pages/              # Page components
│   │   ├── components/         # Reusable components
│   │   ├── lib/                # Utilities (Supabase, auth, etc.)
│   │   ├── contexts/           # React contexts
│   │   ├── App.tsx             # Main app component
│   │   └── main.tsx            # React entry point
│   ├── index.html              # HTML template
│   └── public/                 # Static files
├── scripts/
│   ├── import_products.py      # Product import script
│   └── import-from-sheet.ts    # Alternative import script
├── package.json                # Dependencies
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.ts          # Tailwind CSS configuration
├── netlify.toml                # Netlify deployment config
├── .env.example                # Environment variables template
├── supabase-migration-with-products.sql  # Database schema
└── README.md                   # Documentation
```

---

## Environment Variables

### Required for Development

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### Optional for Import Script

```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Do NOT Commit

- `.env.local` (contains secrets)
- `.env.production.local`
- `node_modules/`

---

## Database Schema

### Tables Created

1. **categories** - Product categories (21 total)
2. **products** - Product listings (133 sample)
3. **product_images** - Product images with alt text
4. **user_profiles** - User accounts and admin status
5. **enquiries** - Customer enquiries

### Row Level Security

- Public can read active products/categories
- Users can only see their own enquiries
- Admins can manage everything

---

## Performance

### Build Size

- **JavaScript**: ~150 KB (gzipped)
- **CSS**: ~50 KB (gzipped)
- **Total**: ~367 KB (gzipped)

### Page Load

- **Homepage**: < 2 seconds
- **Catalog**: < 1 second
- **Product Detail**: < 1 second

### Optimization Tips

1. **Images**: Compress before uploading
2. **Categories**: Don't create too many (keep < 50)
3. **Products**: Index by category for faster queries
4. **Cache**: Netlify caches static files automatically

---

## Security

### Best Practices

1. **Never commit `.env.local`** to Git
2. **Use strong passwords** (12+ characters)
3. **Enable 2FA** on Supabase account
4. **Rotate API keys** periodically
5. **Review RLS policies** regularly

### Data Protection

- ✅ Passwords encrypted by Supabase
- ✅ HTTPS enabled by default
- ✅ Row Level Security prevents unauthorized access
- ✅ All API calls use HTTPS

---

## Maintenance

### Regular Tasks

1. **Review enquiries** daily
2. **Update products** as needed
3. **Monitor performance** (Netlify Analytics)
4. **Backup database** (Supabase auto-backups)

### Monitoring

- **Netlify**: Site settings → Analytics
- **Supabase**: Logs → API requests
- **Browser**: DevTools → Network tab

---

## Support & Resources

### Documentation

- [Supabase Docs](https://supabase.com/docs)
- [Netlify Docs](https://docs.netlify.com)
- [React Docs](https://react.dev)
- [Vite Docs](https://vitejs.dev)

### Contact

- **Email**: xltraders990@gmail.com
- **WhatsApp**: 919773239442
- **Phone**: 9773239442

---

## Next Steps

1. ✅ Create Supabase project
2. ✅ Run SQL migration
3. ✅ Set up local environment
4. ✅ Deploy to Netlify
5. ✅ Import products
6. ✅ Create admin account
7. ✅ Configure business settings
8. ✅ Test all features
9. ✅ Go live!

---

## Version History

| Version | Date     | Changes         |
| ------- | -------- | --------------- |
| 1.0     | May 2026 | Initial release |

---

**Ready to launch?** Follow the steps above and your site will be live in 30 minutes! 🚀
