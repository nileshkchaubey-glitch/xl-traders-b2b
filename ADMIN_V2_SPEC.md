# admin-v2 — Parallel Admin Experience Spec

**Status:** Planning approved by owner (Nilesh). Ready for Claude Code execution.
**Repo:** `nileshkchaubey-glitch/xl-traders-b2b`
**Branch strategy:** `feat/admin-v2-phase1`, `feat/admin-v2-phase2`, ... (one branch per phase, one PR per phase — never combine phases in one PR)
**Execution model:** Remote-first via **Claude Code Cloud sessions** (`claude.ai/code`) — see Section 0. This is the primary path because Nilesh's PC is off every evening; Cloud sessions run on Anthropic's infrastructure, not his machine. GitHub Actions and local Claude Code remain available as alternatives.

---

## 0. Remote Execution Setup — PC-Off-Every-Evening Workflow

Goal: Nilesh's PC shuts down every evening. He needs to trigger, monitor, and merge admin-v2 work from home without the PC being on. Three options exist — **Cloud sessions is the primary one** because it doesn't depend on the PC at all.

| Option | Runs on | Needs PC on? | Best for |
|---|---|---|---|
| **Cloud sessions** (`claude.ai/code`) | Anthropic's infrastructure | ❌ No | **Primary — Nilesh's daily workflow** |
| GitHub Actions (`@claude` in Issue/PR) | GitHub Actions runner | ❌ No | Backup path, or team/automation triggers later |
| Remote Control (`claude rc`) | Nilesh's own PC | ✅ Yes | Only if PC is left on overnight — not the default case here |

### 0.1 Primary path: Cloud sessions (`claude.ai/code`)

**One-time setup:**
1. Go to `claude.ai/code` (any browser, phone or laptop), sign in with the same Claude account.
2. Connect GitHub → authorize access to `nileshkchaubey-glitch/xl-traders-b2b`.
3. No API key or repo secret needed for this path — it uses Nilesh's own Claude plan (Pro/Max/Team), not a separate billed key.

**Daily workflow from home (PC off):**
1. Open `claude.ai/code` in a browser or the Claude mobile app.
2. Start a new session on `xl-traders-b2b`, type the phase task (see Section 4 prompt), hit enter.
3. Claude clones the repo into an isolated cloud sandbox, does the work, and opens a PR — same as local Claude Code, just not on Nilesh's machine.
4. Session **persists even if the browser/phone is closed** — check back later from any device.
5. Review the PR from claude.ai/code or the GitHub app; merge when satisfied.

**Constraints to know:**
- Cloud sandbox is a **fresh container per session** — nothing besides what's in the committed repo is available. No local `.env`, no local-only files. If a Phase needs a secret (rare — this project's guardrails already say no new services / no new keys), it must be added to the Cloud environment's variables in the web UI, never hardcoded.
- Sessions expire after a period of inactivity — reopen from the session list, conversation history is restored.
- Same Claude usage/rate limits as regular chat — no separate cloud compute cost.

### 0.2 Backup path: GitHub Actions (`@claude` mentions)

Useful if Nilesh wants triggers to come from GitHub itself (e.g., opening an Issue from the GitHub mobile app) rather than claude.ai/code directly, or later wants automated triggers (e.g., auto-review on every PR).

1. In a terminal in the repo (one-time, needs PC on once): `claude` → run `/install-github-app`. Installs the Claude GitHub App and creates `.github/workflows/claude.yml`.
2. Add `ANTHROPIC_API_KEY` to **repo Settings → Secrets and variables → Actions** (separate, build-time-only secret — never `VITE_*`).
3. Confirm workflow permissions in `claude.yml`: `contents: write`, `pull-requests: write`, `issues: write`.
4. Trigger by opening a GitHub Issue and commenting `@claude implement this` — works from GitHub mobile app, no PC needed once set up.
5. Restrict triggers to write-access collaborators only — do NOT set `allowed_non_write_users: "*"`.

### 0.3 Not the default: Remote Control (`claude rc`)

Only relevant if Nilesh decides to leave the PC on overnight for a specific long-running task. Requires the terminal to stay open on the PC; phone is just a window into that session. Since the PC is off every evening by default, this is **not** part of the regular workflow — listed here only so it isn't confused with Cloud sessions.

### 0.4 Guardrails apply to every path

Whether triggered from claude.ai/code, GitHub Actions, or locally, every session must read `CLAUDE.md` and this spec first. **Add a short pointer in `CLAUDE.md`** telling any session to read `ADMIN_V2_SPEC.md` before touching anything under `admin-v2` — Cloud and Actions sessions have no memory of this conversation, only what's in the repo.

- SQL migrations: still manual, via Supabase SQL Editor only — never via any automated path.
- One branch per phase, one PR per phase — applies identically across all three paths.
- Every path produces a **PR, never a direct push to `main`**.
- `git status` / PR-diff review before merge — verify-first principle matters even more here since no one is watching live.

---

## 1. Non-negotiable Guardrails

Claude Code must follow these on every phase. If a task seems to require breaking one of these, STOP and flag it instead of proceeding.

1. **Do NOT modify anything under `client/src/pages/admin/` or existing `/admin` routes.** Existing admin stays fully functional and unchanged until Nilesh explicitly approves a cutover.
2. **Do NOT create new `*Service.ts` files or new Supabase tables/views.** All data access goes through the existing service layer (`productService`, `masterService`, `orderService`, `healthService`, `bulkImportService`, `googleSheetsService`, `templateService`, `aiService`). If a service is missing a method admin-v2 needs, ADD a method to the existing service file — don't create a parallel one.
3. **Do NOT touch `v_product_health` or re-implement missing-data logic in components.** Query the view via `healthService` only.
4. **Do NOT touch `productSelectCols()` / price-gating logic.** Reuse as-is.
5. **No SQL migrations in this project.** If a DB change is ever genuinely needed, stop and tell Nilesh — migrations go through Supabase SQL Editor manually, never via agent.
6. **Reuse `useAuthStore` for auth/admin-gating.** Same `isAdmin` check as `/admin`.
7. One branch = one phase. No mixing.

---

## 2. Architecture

```
client/src/
  admin-v2/
    layout/
      AdminV2Shell.tsx        # top-level shell: sidebar + topbar + content outlet
      Sidebar.tsx
      CommandPalette.tsx       # Cmd+K quick actions (Airtable/Notion-style)
    pages/
      ProductGridPage.tsx      # main spreadsheet-style product view
      ProductEntryPage.tsx     # single product create/edit (drawer or route)
      ImageLibraryPage.tsx
      VariantsPage.tsx
      AiWorkspacePage.tsx
    components/
      grid/                    # virtualized table, column config, inline cell editors
      variants/                # variant matrix UI
      bulk/                    # multi-select toolbar + bulk action modals
      ai/                      # Smart Paste panel, AI chat/assist panel
    hooks/
      useProductGrid.ts        # wraps productService + healthService, no new logic
      useBulkSelection.ts
    routes.tsx                 # admin-v2 route table, mounted at /admin-v2/*
```

**Routing:** Add one route block in the existing router (Wouter) for `/admin-v2/*` → `AdminV2Shell`. Gate with the same `isAdmin` check used by `/admin`.

**State:** Zustand for local UI state (selection, grid filters) — same library already in the project. No new state library.

**Design inspiration (UI only, not architecture):**
- **Airtable** → grid interactions, inline cell editing, keyboard nav
- **Saleor Dashboard** → clean product detail layout, variant matrix pattern
- **Akeneo PIM** → completeness/attribute grouping (maps directly to `v_product_health`)
- **Shopify Admin** → bulk action toolbar, resource list UX

---

## 3. Phase Plan

| Phase | Scope | Classification | Depends on |
|---|---|---|---|
| 1 | Scaffold: route, shell, sidebar, auth gate, empty pages | Quick Win | — |
| 2 | Product Grid: virtualized table reading `productService` + `v_product_health`, sort/filter/search | Major | Phase 1 |
| 3 | Product Entry: create/edit panel, reuses existing validation + save logic from `/admin` (extract shared logic if duplicated) | Medium | Phase 2 |
| 4 | Image Library: reuse Supabase Storage bucket logic from existing admin, new grid UI | Medium | Phase 1 |
| 5 | Variants: matrix view on top of `masterService` (masters + variants model already exists) | Major | Phase 3 |
| 6 | Bulk Editing: multi-select + bulk update actions (reuse existing bulk update logic from `/admin`) | Medium | Phase 2 |
| 7 | AI Workspace: Smart Paste UI reusing `aiService`, plus a chat-style assist panel | Major | Phase 3 |

**Rule while building Phase 3+:** if logic in `/admin`'s product form is genuinely shared (not just similar), extract it into a shared hook/util under `client/src/lib/` — don't copy-paste, don't duplicate. This is the one case where touching shared (non-admin-v2, non-admin-page) code is expected.

---

## 4. Phase 1 — Kickoff

### Primary: Cloud session (`claude.ai/code`)

Open `claude.ai/code` on any device (phone or laptop, PC doesn't need to be on), start a new session on `xl-traders-b2b`, and send:

```
Read CLAUDE.md and ADMIN_V2_SPEC.md first — both are in repo root.

Task: Phase 1 scaffold for /admin-v2.

1. Create client/src/admin-v2/ with layout/AdminV2Shell.tsx, layout/Sidebar.tsx,
   and empty placeholder pages: ProductGridPage.tsx, ProductEntryPage.tsx,
   ImageLibraryPage.tsx, VariantsPage.tsx, AiWorkspacePage.tsx (each just a
   heading + "Coming in Phase N" placeholder).
2. Add route /admin-v2/* in the existing router, gated by the same isAdmin
   check used by /admin (reuse useAuthStore — do not create new auth logic).
3. Sidebar nav links to each placeholder page.
4. Do NOT touch anything under client/src/pages/admin/.
5. Do NOT create any new service files.
6. Branch: feat/admin-v2-phase1. Open a PR when done — do not merge to main.

If anything here is ambiguous, ask before writing code.
```

Claude clones the repo into a cloud sandbox, does the work, opens a PR. Nilesh reviews and merges from the same session or the GitHub app — from home, PC off.

### Backup: GitHub Issue + `@claude` (if GitHub Actions is set up per Section 0.2)

Open a GitHub Issue titled `admin-v2 Phase 1: Scaffold`, paste the same task body above, comment `@claude implement this`.

### Fallback: local Claude Code

Same prompt pasted into a local `claude` session if Nilesh happens to be at the laptop. All three paths converge on the same PR-based review flow.

---

## 5. Open Decisions (Nilesh to confirm before Phase 2)

- Product Entry: full-page route (`/admin-v2/products/:id`) vs slide-over drawer? (Airtable/Saleor lean drawer for speed, route for deep-linking — either works with current architecture)
- AI Workspace: Smart Paste only, or also a persistent chat panel for ad-hoc queries against product data?
- Cutover plan: once admin-v2 is approved, do we redirect `/admin` → `/admin-v2`, or keep both indefinitely?
- Confirm one-time setup (Section 0.1) is done — `/install-github-app` + `ANTHROPIC_API_KEY` repo secret — before opening the Phase 1 issue, otherwise `@claude` mentions won't trigger anything.
