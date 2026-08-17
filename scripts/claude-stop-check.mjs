#!/usr/bin/env node
/**
 * Stop hook — runs the storefront guardrails before Claude ends its turn.
 *
 * WHY: the guardrails already run in CI, which means a violation is discovered
 * AFTER a push. This moves the discovery to before the turn ends, while the
 * context to fix it is still loaded.
 *
 * BEHAVIOUR
 *   exit 0  nothing to check, or the checker passed  -> stop proceeds
 *   exit 2  the checker failed                       -> stop is BLOCKED and
 *           stderr is fed back to Claude as the reason to keep working
 *   exit 1  the hook itself broke                    -> non-blocking notice
 *
 * Exit 2 is the loud failure the task asks for: Claude cannot end the turn on
 * a guardrail violation.
 *
 * SCOPING: the checker is fast, but the hook fires on every turn, so it only
 * runs when this session has actually touched client/src — working tree
 * (staged or unstaged) or commits on the branch ahead of origin/main. A
 * docs-only or SQL-only turn skips it entirely.
 *
 * LOOP GUARD: `stop_hook_active` is true when Claude is already continuing
 * because a stop hook blocked it. Blocking again in that state can loop
 * forever, so the hook reports and lets the turn end the second time.
 *
 * No dependencies. Plain .mjs so it runs on the pinned Node 20 — a .ts script
 * would need native type stripping (Node 22.6+) and is exactly how the
 * check:price script came to fail in CI.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: REPO,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

/**
 * The hook payload arrives as JSON on stdin. Reading fd 0 directly avoids
 * spawning anything. Absent or malformed when the script is run by hand, which
 * is fine — an empty payload just means no loop guard.
 */
function readPayload() {
  try {
    return JSON.parse(readFileSync(0, "utf8")) ?? {};
  } catch {
    return {};
  }
}

const payload = readPayload();

// ── Loop guard ──────────────────────────────────────────────────────────────
if (payload.stop_hook_active === true) {
  console.error(
    "[storefront guardrails] already blocked once this turn — not blocking again."
  );
  process.exit(0);
}

// ── Scope: did this session touch client/src? ───────────────────────────────
// `git status --porcelain` covers modified, staged AND untracked in ONE call —
// each spawned process costs ~100ms on Windows, and this hook fires every turn.
let touched = git(["status", "--porcelain", "--", "client/src"]);

// Only if the tree is clean do we pay for the branch comparison: a session that
// committed its work and then stopped still needs checking.
if (!touched && git(["rev-parse", "--verify", "--quiet", "origin/main"])) {
  touched = git(["diff", "--name-only", "origin/main...HEAD", "--", "client/src"]);
}

if (!touched) {
  process.exit(0); // nothing storefront-shaped changed — skip, keep it fast
}

// ── Run the guardrails ──────────────────────────────────────────────────────
const CHECKER = join(REPO, "scripts", "check-storefront.mjs");

// A MISSING checker must warn, not block. Without this guard node exits 1 —
// a *defined* status — so the failure branch below would take it as a
// guardrail violation and trap the turn behind a module-not-found trace.
if (!existsSync(CHECKER)) {
  console.error(
    `[storefront guardrails] checker not found at ${CHECKER} — skipping.`
  );
  process.exit(1); // non-blocking notice
}

try {
  execFileSync(process.execPath, [CHECKER], {
    cwd: REPO,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  process.exit(0);
} catch (err) {
  if (err.status === undefined) {
    // The hook itself failed (checker missing, node error). Non-blocking:
    // a broken hook must not trap the session.
    console.error(`[storefront guardrails] hook could not run: ${err.message}`);
    process.exit(1);
  }
  const out = `${err.stdout ?? ""}${err.stderr ?? ""}`.trim();
  console.error(
    "Storefront guardrails FAILED — fix these before ending the turn.\n" +
      "Each rule exists because breaking it produced a real defect; see docs/STOREFRONT_RULES.md.\n\n" +
      out
  );
  process.exit(2); // blocks the stop, feeds the above back to Claude
}
