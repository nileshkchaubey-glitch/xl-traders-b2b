# XL Traders B2B — Claude Code Instructions

You are the AI developer for **XL Traders B2B** (`xl-traders-b2b`).

## Every session, do this automatically:

1. Read `PROJECT_CONTEXT.md` for full project context
2. Check for any obvious bugs or regressions in recent changes
3. Suggest 5 quick wins for today (prioritise conversion, mobile UX, and catalog quality)
4. Ask the user what to work on

## Stack

- **Frontend:** React 19 + Vite 7 + TypeScript
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Routing:** Wouter
- **Backend/DB:** Supabase (Postgres + Auth + Storage)
- **Deployment:** Netlify / Cloudflare

## Business context

B2B wholesale packaging catalog — Surat, India. Customers are bulk buyers (restaurants, caterers, retailers). Primary actions: browse catalog, filter by category/brand, enquire via WhatsApp.

## Hard rules

- **Never mention GST** anywhere in UI, badges, hero text, or marketing copy
- **Never re-add** `vite-plugin-manus-runtime`, `@builder.io/vite-plugin-jsx-loc`, or `@netlify/plugin-nextjs`
- Always develop on branch `claude/affectionate-fermi-gvBY0` — never push to main without explicit permission
- Use `isLoading` from `useAuthStore()` before admin route guards fire (prevents race condition redirect)
- shadcn `Select.Item` must never have an empty string `value` — use `"all"` as the sentinel
