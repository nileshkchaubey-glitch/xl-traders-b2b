# Phase A — UI/UX Audit vs Design System

Audit of the storefront + admin against `docs/design-system/colors_and_type.css`
(brand red `#dc2626`, emerald accents, slate neutrals, Inter, radius/shadow scale).
Generated 2026-07-08 on `feat/phase-a-design-tokens` (base: `main` @ 769cdb9).

Severity: **High** = off-token color/font that Phase A must fix ·
**Medium** = token exists but value is hand-written (drift risk) ·
**Low** = cosmetic/arbitrary value, fine to migrate gradually ·
**Info** = third-party/library code, leave as-is.

## 1 · Ad-hoc colors, fonts, spacing

### 1.1 Typography

| File | Issue | Severity |
| --- | --- | --- |
| `client/index.html:16-19` + `client/src/index.css` | **Inter is downloaded but never applied** — no `--font-sans` override, so the whole app renders in the system UI font while paying for the font download. Design system mandates Inter everywhere. | **High** |
| 25 files, 202 occurrences (`Header` 22, `Home` 23, `ProductDetail` 22, `ProductCard` 17, `AdminImageLibrary` 16, `Catalog` 15, …) | Arbitrary px font sizes (`text-[13px]`, `text-[13.5px]`, `text-[11.5px]`, …) instead of a named scale. Design system defines a semantic scale (body 14 / caption 12 / label 14 / h3 18 …). | Low |
| `Home.tsx:269,298`, `AdminDashboard.tsx:246`, `AdminMasters.tsx:239`, `Header.tsx:280`, `Footer.tsx:25`, `HeroBrandsSlider.tsx:10` | Arbitrary letter-spacing (`tracking-[0.08em]`, `tracking-[0.12em]`, `tracking-[0.2em]`) — DS eyebrow style is `0.08em`. | Low |

### 1.2 Hardcoded hex colors

| File | Issue | Severity |
| --- | --- | --- |
| `pages/AdminDashboard.tsx:207,218` | `bg-[#f4f6f9]` app-shell bg, `bg-[#1a1d27]` sidebar — neither exists in the DS palette (nearest: `--slate-100` / `--slate-900`). Repeated per-screen instead of tokenised. | **High** |
| `components/admin/AdminMasters.tsx:200,211` | Same `#f4f6f9` / `#1a1d27` pair duplicated. | **High** |
| `pages/AdminProductEditor.tsx:487,901` | `bg-[#f4f6f9]` (+ `/95` variant) duplicated again. | **High** |
| `components/admin/AdminDailyImprovementsWidget.tsx:92` | `bg-[#1e293b]` — this **is** `slate-800`; should be the Tailwind class. | **High** |
| `components/admin/AdminOverview.tsx:374,383` | Recharts props with raw hex: `stroke="#f1f5f9"`, score colors `#10b981/#f59e0b/#ef4444` (slate-100, emerald-500, amber-500, red-500). | Medium |
| `pages/Home.tsx:108` | Hero radial gradient hardcodes `#fef2f2` / `#ffffff` (red-50 / white). | Medium |
| `components/ui/chart.tsx`, `ui/sidebar.tsx`, `ui/tooltip.tsx`, `ui/checkbox.tsx`, `ui/input-group.tsx`, `ui/scroll-area.tsx` | shadcn/ui library internals (uses its own CSS-var system). | Info — leave |

### 1.3 Hand-written shadows (rgba literals)

All red/emerald CTA glows and float shadows are written inline per call-site with
slightly different blur/opacity each time — the DS defines `--shadow-red`,
`--shadow-emerald` and an xs→xl neutral scale.

| File | Issue | Severity |
| --- | --- | --- |
| `pages/Home.tsx:144,284` | `shadow-[0_6px_20px_rgba(220,38,38,0.28)]` / `…0.35` | Medium |
| `pages/ProductDetail.tsx:637,792` | `shadow-[0_6px_18px…]`, `shadow-[0_6px_16px_rgba(220,38,38,0.28)]` | Medium |
| `pages/ProductDetail.tsx:781` | `shadow-[0_-8px_24px_rgba(15,23,42,0.06)]` (mobile action bar) | Medium |
| `pages/Cart.tsx:293` | `shadow-[0_6px_18px_rgba(5,150,105,0.25)]` (WhatsApp CTA) | Medium |
| `components/Header.tsx:418` | `shadow-[0_4px_14px_rgba(220,38,38,0.25)]` (cart button) | Medium |
| `components/MobileNav.tsx:50` | `shadow-[0_10px_26px_rgba(220,38,38,0.42)]` (cart FAB) | Medium |

### 1.4 Inline `style={{ }}` (10 occurrences / 8 files)

`Home.tsx` + `HeroMotionTiles.tsx` (marquee mask, transition delays),
`AdminOverview.tsx` / `ui/progress.tsx` / `ProductsTable.tsx` (dynamic widths),
`ui/chart.tsx` (chart color vars), `AdminBulkImport/GoogleSheets` (dynamic
progress). All are **dynamic values** that cannot be static classes — acceptable.
Severity: Info.

## 2 · Hardcoded content — Phase B extraction candidates

Copy that the owner should eventually edit from the admin (`business_settings`)
instead of a code deploy:

| Content | File / line | Notes |
| --- | --- | --- |
| Hero headline + subline + checkmark bullets | `pages/Home.tsx:133-141,146-170` | "Packaging Solutions For Growing Businesses…" |
| Rating badge ("4.8 on Google · 500+ businesses served") | `pages/Home.tsx:124-131` | Also duplicated in `TRUST_STATS` |
| Hero motion-tile slides (labels, size ranges, search links) | `components/home/HeroMotionTiles.tsx:8-45` (`SLIDES`) | Images under `/images/hero/` |
| Marquee fallback value-props | `pages/Home.tsx:200-208` | Shown until ≥4 brands exist in DB |
| Trust stats + trust points | `pages/Home.tsx:31-54` (`TRUST_STATS`, `TRUST_POINTS`) | GSTIN placeholder text lives here |
| Service areas chips | `pages/Home.tsx:56-65` (`SERVICE_AREAS`) | |
| FAQ items | `pages/Home.tsx:67-84` (`FAQS`) | |
| Bulk-quote banner copy | `pages/Home.tsx:268-292` | "Ordering 10,000+ units…" |
| Utility-bar copy (GST line, delivery promise, hours) | `components/Header.tsx:238-262` | Announcement-bar candidate |
| "Same-day Surat" mobile pill | `components/Header.tsx:405-414` | |
| Popular search chips | `components/Header.tsx:31-36` (`POPULAR_SEARCHES`) | Could derive from real search logs (`inquiries`) |
| Footer category quick-links | `components/Footer.tsx:9-14` (`categoryLinks`) | Hardcoded group names — should read the 4 canonical `group_name`s from DB |
| Footer ordering bullets + tagline + address | `components/Footer.tsx:96-118,120-127` | |
| Product-detail pincode rule (395/394 = same-day) | `pages/ProductDetail.tsx:262-274` | Business rule → settings |
| WhatsApp number / phone fallbacks | every page (`import.meta.env.VITE_… \|\| "9773239442"`) | Already env-driven; move default to one constants module |

## 3 · Notes for Task 2 (token port)

- The app is **Tailwind CSS v4** — there is no `tailwind.config.ts` and theme
  extension is done in CSS via `@theme` in `client/src/index.css`. The token port
  therefore lands there (equivalent of `theme.extend`), not in a config file.
- shadcn/ui `ui/*` files keep their own oklch token system — out of scope.
- `#1a1d27` / `#f4f6f9` (admin shell) are kept as **named tokens with identical
  values** (`admin-sidebar`, `admin-bg`) so visuals don't shift; migrating them to
  pure slate is a design decision for later.
