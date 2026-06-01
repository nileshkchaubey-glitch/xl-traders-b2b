# XL Traders B2B — Project Context

> Yeh document project ka complete context hai. Cursor, Claude Code,
> ya kisi bhi AI tool ko yeh do — wo project turant samajh jayega.

---

## 1. Project Kya Hai

**XL Traders** — Surat (India) ka B2B wholesale packaging supplier.
Yeh website ek **product catalog + enquiry platform** hai:
- Customers products browse karte hain (containers, cups, boxes, etc.)
- Prices sirf logged-in users ko dikhte hain (B2B price protection)
- "Enquire on WhatsApp" se order/price poochte hain
- Admin panel se products + categories + enquiries manage hote hain

**Business contact:** WhatsApp 9773239442, email xltraders990@gmail.com, Pandesara Surat

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 7 + TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui |
| State | Zustand |
| Routing | Wouter |
| Backend | Supabase (Postgres + Auth + Storage) |
| Hosting | Netlify (auto-deploy from GitHub) |
| Animation | Framer Motion |
| CSV/Excel | papaparse, xlsx (for bulk import) |

**Repo:** https://github.com/nileshkchaubey-glitch/xl-traders-b2b
**Live:** https://animated-cuchufli-dd5a16.netlify.app

---

## 3. Supabase Setup

- **Project ID:** danoeaftaazhbldeeuxj
- **URL:** https://danoeaftaazhbldeeuxj.supabase.co
- **Region:** Tokyo (ap-northeast-1)
- **Auth key:** publishable key (sb_publishable_...) — frontend env var
- **Storage bucket:** product-images (public)

**Tables:** user_profiles, categories, products, product_images, enquiries

**Env vars (Netlify):**
```
VITE_SUPABASE_URL = https://danoeaftaazhbldeeuxj.supabase.co
VITE_SUPABASE_ANON_KEY = sb_publishable_... (frontend-safe)
VITE_WHATSAPP_NUMBER = 919773239442
```

---

## 4. Data

- **132 products** across **21 categories** (Round Container, Rectangle
  Container, Hinged Container, Aluminum Containers, Paper Box, Pizza Box,
  Meal Tray, Ripple Cup, Paper Cup, Tissue & Napkin, Foil, etc.)
- Source: Google Sheet → imported via SQL
- **Images:** Google Drive thumbnail URLs
  (format: `https://drive.google.com/thumbnail?id=FILE_ID&sz=w800`)
  — Drive folder must be "Anyone with link" for these to load.

---

## 5. Build & Deploy

```
Build command:     npm install && npm run build
Publish directory: dist/public
```
Netlify auto-deploys on every push to `main`. SPA redirect + security
headers are in `netlify.toml`.

**IMPORTANT — yeh packages/plugins HATAYE gaye the (Netlify pe fail karte the):**
- `vite-plugin-manus-runtime` (Manus-only)
- `@builder.io/vite-plugin-jsx-loc` (vite 7 ke saath conflict)
- `@netlify/plugin-nextjs` (yeh Vite app hai, Next.js nahi)
DO NOT re-add these.

---

## 6. Fixes Already Applied (DON'T re-break)

1. **Deploy config:** netlify.toml uses npm (not pnpm), publish=dist/public,
   no Next.js plugin.
2. **Missing deps added:** tw-animate-css, papaparse, xlsx.
3. **RLS infinite recursion fixed:** Created `public.is_admin()` SECURITY
   DEFINER function. All admin policies use it instead of inline
   `(SELECT is_admin FROM user_profiles...)` subquery — that subquery
   caused recursion → HTTP 500 → products didn't load.
4. **Signup fixed:** Added INSERT policy on user_profiles
   (`WITH CHECK (auth.uid() = id)`).
5. **Email confirmation:** Disabled in Supabase Auth (B2B quick signup).
6. **GST text removed** from Header top bar.

---

## 7. Key Files

```
client/src/
├── components/
│   ├── Header.tsx          ← top bar + nav
│   ├── Footer.tsx          ← footer
│   ├── ProductCard.tsx     ← product card (has onError image fallback)
│   └── admin/              ← admin panel components
├── pages/
│   ├── Home.tsx            ← homepage
│   ├── Catalog.tsx         ← product catalog
│   └── ProductDetail.tsx   ← single product page
├── lib/
│   ├── supabase.ts         ← Supabase client
│   ├── productService.ts   ← product/category queries (has demo fallback)
│   ├── bulkImportService.ts← CSV/Excel bulk import
│   └── authStore.ts        ← auth state (Zustand)
supabase-schema.sql          ← database schema + RLS
```

**Note:** productService falls back to demo data if Supabase query fails.
If you see demo products ("Corrugated Boxes" etc.), the real query is failing.

---

## 8. Pending / Future Work

- [ ] Supplier management feature (track suppliers, link to products)
- [ ] Inquiry tracking (admin dashboard for enquiries)
- [x] Admin panel improvements — inline price edit + table pagination done.
      Bulk actions (multi-select) still pending.
- [ ] Migrate images from Drive thumbnails → Supabase Storage (more reliable).
      Interim: all product images now run through `normalizeImageUrl()` so raw
      Drive share links render correctly.
- [ ] Custom domain (xltraders.in)
- [x] Removed leftover Manus files (ManusDialog.tsx, public/__manus__/) and the
      dead legacy `pages/Admin.tsx` (superseded by AdminDashboard).

### Recently shipped (this branch)
- Admin "Add Product": paste an image URL (e.g. Google Drive link) instead of
  uploading a file, plus a "Save & Add Another" flow for fast bulk entry.
- Shared `ProductImage` component with shimmer skeleton + branded fallback;
  used across catalog grid/list, product detail and admin.
- Google Drive URL normalisation (`lib/imageUtils.ts`) so share links load.
- Route-level code-splitting (admin/auth/product-detail lazy-loaded): initial
  JS bundle roughly halved (~1.0 MB → ~0.52 MB) by keeping xlsx/papaparse out
  of the public bundle.

---

## 9. Admin Access

To make a user admin (after they sign up):
```sql
UPDATE public.user_profiles SET is_admin = TRUE
WHERE email = 'nileshk.chaubey@gmail.com';
```
Then `/admin` route is accessible.

---

## 10. Owner / Working Style

Owner: **Nilesh** (Surat). Learning AI-augmented development.
Prefers: simple Hinglish explanations, step-by-step, understanding WHY.
This project was built using Manus (initial) + Claude (fixes/SQL) +
manual GitHub commits + Netlify auto-deploy.
