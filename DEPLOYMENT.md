# XL Traders B2B — Deployment Guide

Production hosting is **Cloudflare Pages**, auto-deploying from the `main` branch.

## How it works

Every merge to `main` triggers a Cloudflare Pages build. There is no separate
CI/CD pipeline to maintain — Cloudflare clones the repo, runs the build, and
publishes the output.

| Setting | Value |
|---|---|
| Build command | `npm install && npm run build` |
| Build output directory | `dist/public` |
| Node version | 20 (`.node-version` / `.nvmrc`) |
| Lockfile | `package-lock.json` (npm). **`pnpm-lock.yaml` must not exist** or the build fails. |

SPA routing and security headers ship from the repo:

- `client/public/_redirects` — `/*  /index.html  200` fallback so deep links
  (e.g. `/admin`) resolve to the SPA.
- `client/public/_headers` — security headers + long-cache for `/assets/*`.

Vite copies `client/public/*` into `dist/public`, so Cloudflare picks these up
automatically.

## First-time setup

1. Push the repo to GitHub.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**,
   select the repository.
3. Set the build command, output directory, and Node version from the table above.
4. Add environment variables (Settings → Environment variables) for both
   Production and Preview:

   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_ADMIN_EMAILS=owner@example.com
   VITE_BUSINESS_NAME=XL Traders
   VITE_BUSINESS_CITY=Surat
   VITE_BUSINESS_STATE=Gujarat
   VITE_BUSINESS_COUNTRY=India
   VITE_WHATSAPP_NUMBER=919773239442
   VITE_EMAIL=xltraders990@gmail.com
   ```

5. Trigger the first deploy. The site goes live at `https://<project>.pages.dev`.

## Custom domain

In the Pages project: **Custom domains → Set up a domain**, enter the domain
(e.g. `xltraders.in`), and follow the DNS instructions. HTTPS is automatic.

## Security checklist (before going live)

- [ ] Supabase RLS policies enabled
- [ ] Admin users configured (`is_admin = TRUE`)
- [ ] No secrets committed (only the public anon key belongs in client code)
- [ ] Authentication flows tested (login/signup)
- [ ] Image uploads work against the `product-images` bucket
- [ ] Admin panel access gated to `VITE_ADMIN_EMAILS`
- [ ] WhatsApp enquiry links open correctly

## Troubleshooting

**Build fails** — check the Cloudflare build log. Common causes: a stray
`pnpm-lock.yaml` (delete it), missing env vars, or a Node version mismatch.

**Site loads but data is missing** — verify `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
and Supabase RLS policies; check the browser console.

**Deep links 404** — confirm `client/public/_redirects` shipped to `dist/public/_redirects`.

**Images not showing** — verify the `product-images` bucket is public and the stored
URLs are valid.

## Environment variables reference

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (publishable) key |
| `VITE_ADMIN_EMAILS` | Comma-separated emails allowed into `/admin` |
| `VITE_BUSINESS_NAME` / `_CITY` / `_STATE` / `_COUNTRY` | Storefront business info |
| `VITE_WHATSAPP_NUMBER` | WhatsApp number for enquiry links |
| `VITE_EMAIL` | Business email |
| `VITE_ANTHROPIC_API_KEY` | Optional — AI Smart Paste (move to an Edge Function before scaling) |

## Post-deployment

- Smoke-test the live site logged out **and** logged in.
- Enable Supabase backups and monitor API/storage usage in the Supabase dashboard.
