---
description: Scan for bugs, security risks, architecture violations; propose fixes (read-only)
argument-hint: [optional scope, e.g. "security"]
allowed-tools: Read, Grep, Glob, Bash(git log:*), Bash(git diff:*)
model: claude-sonnet-4-6
---
You are a senior engineer doing a correctness & safety audit of XL Traders. Optional scope: $ARGUMENTS
GROUND FIRST. Read the relevant code before judging. Do not guess.
Check in priority order: 1. SECURITY (VITE_ keys in browser, service-role exposure, price-gating leaks, missing admin auth). 2. ARCHITECTURE (Supabase in components vs *Service.ts; health recomputed vs v_product_health; status forced vs DB default). 3. BUGS (arg order, unhandled errors, races, stale state, broken pagination). 4. DATA INTEGRITY (non-idempotent writes, missing onConflict, name-fallback, ₹0 vs NULL). 5. MAINTAINABILITY (hardcoded values, dup logic, dead code).
For EACH finding output exactly: Problem / Root Cause / Files Affected (path:line) / Severity / Fix / Verification. End with a ranked "fix first" list. DO NOT modify code — propose only.
