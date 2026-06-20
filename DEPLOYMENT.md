# XL Traders B2B - Deployment Guide

This guide covers deploying the XL Traders B2B website to production.

## 🚀 Quick Start Deployment

### Option 1: Deploy to Netlify (Recommended)

**Easiest option with automatic deployments from Git**

1. **Push code to GitHub**

   ```bash
   git init
   git add .
   git commit -m "Initial commit: XL Traders B2B website"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/xl-traders-b2b.git
   git push -u origin main
   ```

2. **Connect to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Click "New site from Git"
   - Select GitHub and authorize
   - Select your repository
   - Build command: `pnpm install && pnpm build`
   - Publish directory: `dist`

3. **Set Environment Variables**
   - Go to Site settings → Build & deploy → Environment
   - Add these variables:
     ```
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=your-anon-key
     VITE_BUSINESS_NAME=XL Traders
     VITE_BUSINESS_CITY=Surat
     VITE_BUSINESS_STATE=Gujarat
     VITE_BUSINESS_COUNTRY=India
     VITE_WHATSAPP_NUMBER=919773239442
     VITE_PHONE_1=9773239442
     VITE_PHONE_2=7778052990
     VITE_EMAIL=xltraders990@gmail.com
     ```

4. **Deploy**
   - Netlify will automatically build and deploy
   - Your site will be live at `https://your-site-name.netlify.app`

### Option 2: Deploy to Vercel

1. **Push to GitHub** (same as above)

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Select framework: "Other"

3. **Configure Build Settings**
   - Build command: `pnpm install && pnpm build`
   - Output directory: `dist`
   - Install command: `pnpm install`

4. **Set Environment Variables**
   - Add the same variables as Netlify option above

5. **Deploy**
   - Click "Deploy"
   - Your site will be live at `https://your-project.vercel.app`

### Option 3: Deploy to Railway

1. **Push to GitHub**

2. **Connect to Railway**
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Authorize and select your repository

3. **Configure**
   - Build command: `pnpm install && pnpm build`
   - Start command: `pnpm start`
   - Add environment variables in Railway dashboard

4. **Deploy**
   - Railway will automatically deploy
   - Your site will be live at the provided Railway URL

### Option 4: Deploy to Render

1. **Push to GitHub**

2. **Connect to Render**
   - Go to [render.com](https://render.com)
   - Click "New +"
   - Select "Web Service"
   - Connect your GitHub account
   - Select your repository

3. **Configure**
   - Build command: `pnpm install && pnpm build`
   - Start command: `pnpm start`
   - Add environment variables

4. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy automatically

## 🌐 Custom Domain Setup

### Add Custom Domain to Netlify

1. Go to Site settings → Domain management
2. Click "Add custom domain"
3. Enter your domain (e.g., `packaging.xltraders.com`)
4. Follow DNS configuration instructions
5. Update DNS records with your domain provider

### Add Custom Domain to Vercel

1. Go to Settings → Domains
2. Click "Add"
3. Enter your domain
4. Follow DNS configuration instructions

## 🔒 Security Checklist

Before deploying to production:

- [ ] Verify Supabase RLS policies are enabled
- [ ] Check that admin users are properly configured
- [ ] Enable HTTPS (automatic on Netlify/Vercel)
- [ ] Set up proper CORS policies in Supabase
- [ ] Review environment variables (no secrets in code)
- [ ] Test authentication flows
- [ ] Verify image uploads work correctly
- [ ] Test admin panel access
- [ ] Check WhatsApp integration
- [ ] Verify email configuration

## 📊 Performance Optimization

### Build Size

Current build size: ~367 KB (gzip: ~105 KB)

To optimize further:

1. **Code splitting** - Dynamic imports for pages
2. **Image optimization** - Use WebP format
3. **Lazy loading** - Implement intersection observer
4. **Caching** - Configure cache headers

### Database Optimization

1. **Indexes** - Already configured in schema
2. **Query optimization** - Use proper filters
3. **Connection pooling** - Supabase handles automatically

## 🔄 CI/CD Pipeline

### GitHub Actions (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: "22"
          cache: "pnpm"

      - run: pnpm install
      - run: pnpm build
      - run: pnpm run test # if you add tests

      # Deploy to Netlify
      - uses: nwtgck/actions-netlify@v2
        with:
          publish-dir: "./dist"
          production-branch: main
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deploy-message: "Deploy from GitHub Actions"
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

## 📈 Monitoring

### Netlify Analytics

1. Go to Site settings → Analytics
2. Enable Netlify Analytics
3. View traffic, performance metrics

### Supabase Monitoring

1. Go to Supabase dashboard
2. Check "Database" → "Logs"
3. Monitor API usage
4. Check storage usage

## 🆘 Troubleshooting Deployment

### Build Fails

Check build logs in deployment platform:

- Verify Node version (22.13.0+)
- Check environment variables are set
- Verify all dependencies are installed

### Site Not Loading

- Check if Supabase URL and key are correct
- Verify CORS settings in Supabase
- Check browser console for errors
- Clear cache and reload

### Images Not Showing

- Verify Supabase Storage bucket is public
- Check image URLs in database
- Verify CORS headers are set

### Auth Not Working

- Check Supabase auth is enabled
- Verify email configuration
- Check RLS policies
- Clear browser cookies

## 📝 Environment Variables Reference

| Variable                 | Purpose              | Example                   |
| ------------------------ | -------------------- | ------------------------- |
| `VITE_SUPABASE_URL`      | Supabase project URL | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key    | `eyJhbGc...`              |
| `VITE_BUSINESS_NAME`     | Company name         | `XL Traders`              |
| `VITE_BUSINESS_CITY`     | City                 | `Surat`                   |
| `VITE_BUSINESS_STATE`    | State                | `Gujarat`                 |
| `VITE_BUSINESS_COUNTRY`  | Country              | `India`                   |
| `VITE_WHATSAPP_NUMBER`   | WhatsApp number      | `919773239442`            |
| `VITE_PHONE_1`           | Primary phone        | `9773239442`              |
| `VITE_PHONE_2`           | Secondary phone      | `7778052990`              |
| `VITE_EMAIL`             | Business email       | `xltraders990@gmail.com`  |

## 🚀 Post-Deployment

After deployment:

1. **Test all features**
   - Browse products
   - Search functionality
   - Filter by category
   - Login/signup
   - Admin panel
   - WhatsApp integration

2. **Monitor performance**
   - Check Core Web Vitals
   - Monitor error rates
   - Track user analytics

3. **Set up backups**
   - Enable Supabase backups
   - Regular database exports

4. **Update DNS**
   - Point domain to deployment
   - Update contact information
   - Update social media links

## 📞 Support

For deployment issues:

- Check deployment platform documentation
- Review Supabase docs
- Contact support via WhatsApp: 919773239442

---

Happy deploying! 🎉
