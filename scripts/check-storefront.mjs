#!/usr/bin/env node
/**
 * Storefront guardrails.
 *
 * Mechanically enforces the invariants in docs/STOREFRONT_RULES.md. Every rule
 * here exists because breaking it produced a real defect — see the doc for the
 * incident behind each one.
 *
 * Design notes:
 *  * No dependencies. Run by plain node, like scripts/check-price-entry.ts.
 *  * `components/admin/**` is OUT OF SCOPE. The admin PIM predates these rules
 *    and is explicitly not being rewritten; scanning it would produce noise
 *    nobody will action.
 *  * A rule that cannot be checked without false positives is NOT included.
 *    A checker people learn to ignore is worse than no checker.
 *  * Comments are stripped before matching, so a rule can be *discussed* in a
 *    comment without tripping the check that forbids it in code.
 *
 * Usage:  node scripts/check-storefront.mjs [--verbose]
 * Exit:   0 clean, 1 violations found.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC = join(ROOT, "client", "src");
const VERBOSE = process.argv.includes("--verbose");

// ── File collection ─────────────────────────────────────────────────────────

/** Admin is grandfathered; tests and the guardrail docs describe rules rather than break them. */
const EXCLUDED_DIRS = [
  join("components", "admin"),
  join("components", "ui"),
];
const EXCLUDED_FILES = [/\.test\.tsx?$/];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

function inScope(file) {
  const rel = relative(SRC, file);
  if (EXCLUDED_DIRS.some(d => rel.startsWith(d + sep))) return false;
  if (EXCLUDED_FILES.some(re => re.test(rel))) return false;
  return true;
}

/**
 * Strip comments and JSX text so a rule can be *described* without tripping the
 * check that forbids it. Keeps line count stable so reported numbers are real.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

const FILES = walk(SRC).filter(inScope);

// ── Rule harness ────────────────────────────────────────────────────────────

const violations = [];
const ran = [];

function rule(id, description, fn) {
  const found = [];
  fn((file, line, detail) =>
    found.push({ file: relative(ROOT, file).replaceAll("\\", "/"), line, detail })
  );
  ran.push({ id, count: found.length });
  for (const f of found) violations.push({ id, description, ...f });
}

/** Scan in-scope files line by line with comments stripped. */
function scan(cb, files = FILES) {
  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    const code = stripComments(raw);
    code.split("\n").forEach((text, i) => cb({ file, line: i + 1, text, raw }));
  }
}

function readIfExists(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

// ── §1 Price gate ───────────────────────────────────────────────────────────

const FORBIDDEN_GUEST_COLS = [
  "price",
  "mrp",
  "discount_percent",
  "price_per_piece",
  "bulk_price",
  "bulk_threshold",
];

rule(
  "guest-price-columns",
  "GUEST_PRODUCT_COLS must never name a price column (STOREFRONT_RULES §1.2)",
  report => {
    const svc = join(SRC, "lib", "productService.ts");
    const code = stripComments(readIfExists(svc));
    const m = code.match(/const GUEST_PRODUCT_COLS\s*=([\s\S]*?);/);
    if (!m) {
      report(svc, 0, "GUEST_PRODUCT_COLS not found — has it been renamed?");
      return;
    }
    // Only the string literals, so a nearby identifier can't false-positive.
    const cols = (m[1].match(/"([^"]*)"/g) ?? [])
      .join(",")
      .replace(/"/g, "")
      .split(",")
      .map(c => c.trim())
      .filter(Boolean);
    const lineNo = code.slice(0, m.index).split("\n").length;
    for (const bad of FORBIDDEN_GUEST_COLS) {
      if (cols.includes(bad)) {
        report(svc, lineNo, `"${bad}" is selectable by guests — this opens the price gate`);
      }
    }
  }
);

rule(
  "public-select-star",
  'Public reads of `products` must not use .select("*") (STOREFRONT_RULES §1.3)',
  report => {
    // Services only; a component doing this is caught by supabase-in-component.
    const files = FILES.filter(f => relative(SRC, f).startsWith("lib" + sep));
    scan(({ file, line, text }) => {
      if (!/\.from\((["'`])products\1\)/.test(text)) return;
      const src = stripComments(readFileSync(file, "utf8")).split("\n");
      const window = src.slice(line - 1, line + 6).join(" ");
      if (!/\.select\(\s*["'`]\*["'`]\s*\)/.test(window)) return;

      // Which FUNCTION is this in? Scan BACKWARDS to the nearest method
      // declaration. A forward window cannot see the name — which is why this
      // previously flagged getVariantsByMasterIdAdmin, a legitimate admin call.
      let fnName = "";
      for (let i = line - 1; i >= 0 && i > line - 40; i--) {
        const m = src[i]?.match(/^\s{0,4}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/);
        if (m) {
          fnName = m[1];
          break;
        }
      }
      if (/admin/i.test(fnName)) return;
      report(
        file,
        line,
        `select("*") on products in ${fnName || "a service"}() — use publicProductQueryShape()`
      );
    }, files);
  }
);

rule(
  "unguarded-price-order",
  'ORDER BY price must be guarded by an auth check (STOREFRONT_RULES §1.3)',
  report => {
    const files = FILES.filter(f => relative(SRC, f).startsWith("lib" + sep));
    scan(({ file, line, text }) => {
      if (!/\.order\(\s*["'`]price["'`]/.test(text)) return;
      const src = stripComments(readFileSync(file, "utf8")).split("\n");

      // The guard must be LOCAL to the enclosing function. Accepting it
      // anywhere in the file was useless: productService.ts always contains
      // the string "Admin" somewhere, so every price sort in it looked
      // guarded — the rule could never fail.
      let fnName = "";
      let fnStart = 0;
      for (let i = line - 1; i >= 0 && i > line - 60; i--) {
        const m = src[i]?.match(/^\s{0,4}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/);
        if (m) {
          fnName = m[1];
          fnStart = i;
          break;
        }
      }
      if (/admin/i.test(fnName)) return;

      const body = src.slice(fnStart, line).join("\n");
      if (!/canSortByPrice|hasSession|publicProductQueryShape/.test(body)) {
        report(
          file,
          line,
          `ORDER BY price in ${fnName || "a service"}() with no auth guard — anon cannot read that column`
        );
      }
    }, files);
  }
);

// ── §2 Ordering arithmetic ──────────────────────────────────────────────────

rule(
  "arithmetic-outside-model",
  "pack/pcs/money arithmetic belongs in orderingModel.ts (STOREFRONT_RULES §2.1)",
  report => {
    const ALLOWED = [
      join("lib", "orderingModel.ts"),
      join("lib", "priceEntryMode.ts"),
      join("lib", "priceUtils.ts"),
    ];
    const PATTERNS = [
      [/\bprice\s*\*\s*(?:quantity|packs|qty)\b/i, "price × quantity outside orderingModel"],
      [/\b(?:quantity|packs|qty)\s*\*\s*price\b/i, "quantity × price outside orderingModel"],
      [/\bprice\s*\/\s*quantity_in_unit\b/, "per-piece division outside orderingModel"],
      [/\.price\s*\*\s*\w+\.packs\b/, "price × packs outside orderingModel"],
    ];
    scan(({ file, line, text }) => {
      const rel = relative(SRC, file);
      if (ALLOWED.includes(rel)) return;
      for (const [re, msg] of PATTERNS) {
        if (re.test(text)) report(file, line, msg);
      }
    });
  }
);

rule(
  "inline-orderspec",
  "OrderSpec is built only by orderingModel (STOREFRONT_RULES §2.3)",
  report => {
    scan(({ file, line, text }) => {
      if (relative(SRC, file) === join("lib", "orderingModel.ts")) return;
      // An object literal carrying the spec's own shape is a hand-rolled spec.
      if (/\bminPcs\s*:/.test(text) && /Math\.(ceil|floor)/.test(text)) {
        report(file, line, "hand-built OrderSpec — use resolveOrderSpec/specFromSnapshot");
      }
    });
  }
);

rule(
  "local-cart-total",
  "Cart totals come from cartTotals, not a local reduce (STOREFRONT_RULES §2.4)",
  report => {
    const ALLOWED = [join("stores", "cartStore.ts")];
    scan(({ file, line, text }) => {
      if (ALLOWED.includes(relative(SRC, file))) return;
      // NOTE: `[^)]*` cannot be used here — the arrow params themselves contain
      // a `)`, e.g. `.reduce((sum, i) => sum + i.price * i.packs, 0)`, so a
      // paren-excluding pattern never matches the real shape it is meant to
      // catch. Match the accumulator, then look for price/packs on the line.
      if (
        /\.reduce\(/.test(text) &&
        /\+/.test(text) &&
        /\b(?:price|packs|pieces)\b/.test(text)
      ) {
        report(file, line, "local total over cart items — use cartTotals()");
      }
    });
  }
);

// ── §3 Copy ─────────────────────────────────────────────────────────────────

const BANNED_CLAIMS = [
  [/\b\d[\d,]*\+?\s*(?:businesses|customers|clients)\s+served\b/i, "customer count"],
  [/\b\d[\d,]*\+\s*(?:SKUs|products)\b/i, "SKU/product count"],
  [/\b[0-9]\.[0-9]\s*(?:★|stars?\b|on Google\b)/i, "rating claim"],
  [/\b\d+\+\s*years\s+in\s+business\b/i, "years-in-business claim"],
  [/\bfree\s+(?:delivery|shipping)\b/i, "freight claim"],

  // ── "delivery" used as a TIMING promise ────────────────────────────────
  // Dispatch is when goods LEAVE; delivery is when they ARRIVE. The owner
  // confirmed a DISPATCH promise, and the hero read "Same-day delivery in
  // Surat" while the tier line directly beneath it said the correct thing —
  // technically clean code quietly making a new commercial promise. That is
  // the most dangerous shape a copy defect takes, so it gets its own rule.
  //
  // Deliberately narrow: it fires only when a TIMING sits next to
  // deliver/delivery, so it does NOT catch the brand tagline ("You Order, We
  // Deliver."), a service offering ("scheduled deliveries available"), a form
  // label ("Delivery instructions"), or a plain question ("Do you deliver
  // outside Surat?"). Say "dispatch" when you mean dispatch.
  [
    /\b(?:same[-\s]?day|next[-\s]?day|\d+\s*(?:-|\s)?\s*(?:hour|hr|day)s?)\b[^"'`]{0,24}\bdeliver(?:y|ed|ies)?\b/i,
    "delivery used as a timing promise — say 'dispatch' unless arrival is guaranteed",
  ],
  [
    /\bdeliver(?:y|ed|s)?\b[^"'`]{0,24}\b(?:same[-\s]?day|next[-\s]?day|within\s+\d+|in\s+\d+\s*(?:-|\s)?\s*(?:hour|hr|day)s?)\b/i,
    "delivery used as a timing promise — say 'dispatch' unless arrival is guaranteed",
  ],
  [/\bslab\s+pricing\b/i, "slab pricing"],
  [/\bunlock\s+better\s+rates\b/i, "tiered-pricing claim"],
  [/\b(?:in|out\s+of)\s+stock\b/i, "stock-availability claim"],
  [/\bMRP\b/, "MRP"],
  [/\b\d+%\s*off\b/i, "discount badge"],
];

/**
 * Admin-only libraries, excluded from the COPY rule only.
 *
 * `mrp` is a real column on `products` and "out of stock" is ordinary admin
 * vocabulary; neither is ever rendered to a customer, so scanning these for
 * customer-facing claims produces pure noise — and a checker people learn to
 * ignore is worse than no checker.
 *
 * `settingsService` and `catalogHealth` are deliberately NOT excluded: both
 * emit customer-facing text. `catalogHealth` generates the SEO meta
 * description, which is exactly where "free delivery" was found reaching
 * search results.
 */
const ADMIN_ONLY_LIBS = [
  // Admin PAGES, not just components/admin/**. AdminProductEditor renders a
  // <label>MRP (₹)</label> for a real DB column the operator must be able to
  // edit — flagging that as customer copy is noise. Found when JSX-text
  // scanning was added.
  join("pages", "AdminProductEditor.tsx"),
  join("lib", "adminDailyImprovements.ts"),
  join("lib", "aiService.ts"),
  join("lib", "templateService.ts"),
  join("lib", "bulkImportService.ts"),
  join("lib", "googleSheetsService.ts"),
  join("lib", "healthService.ts"),
  join("lib", "productValidation.ts"),
  join("lib", "priceEntryMode.ts"),
  join("lib", "demoData.ts"),
];

rule(
  "banned-claims",
  "Customer-facing copy must not make unbacked claims (STOREFRONT_RULES §3.1)",
  report => {
    scan(({ file, line, text }) => {
      if (ADMIN_ONLY_LIBS.includes(relative(SRC, file))) return;

      // String literals only. JSX text is handled by `banned-claims-jsx`,
      // which scans whole files — a per-line scan cannot see wrapped copy.
      const literals = text.match(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g) ?? [];
      for (const lit of literals) {
        for (const [re, label] of BANNED_CLAIMS) {
          if (re.test(lit)) report(file, line, `${label}: ${lit.slice(0, 60)}`);
        }
      }
    });
  }
);

rule(
  "banned-claims-jsx",
  "Rendered JSX text must not make unbacked claims (STOREFRONT_RULES §3.1)",
  report => {
    // A PER-LINE scan cannot see the dominant shape of JSX copy. With
    // prettier's printWidth 80, real copy wraps:
    //
    //     <p>
    //       Same-day delivery in Surat
    //     </p>
    //
    // The first version of this check matched `>text<` on a single line only,
    // so the identical claim was caught inline and missed when wrapped —
    // leaving open the very hole the rule was added to close. This pass reads
    // each file whole. Found by a review subagent probing both shapes.
    for (const file of FILES) {
      if (ADMIN_ONLY_LIBS.includes(relative(SRC, file))) continue;
      const code = stripComments(readFileSync(file, "utf8"));
      const re = />([^<>]{4,}?)</gs;
      let m;
      while ((m = re.exec(code))) {
        const raw = m[1];
        // Prose, not code: needs letters and a space, and must not look like an
        // expression. `{}` is deliberately allowed through so interpolated copy
        // ("same-day {city} delivery") is still checked.
        if (!/[A-Za-z]{3}/.test(raw) || !/\s/.test(raw)) continue;
        if (/[;=]|=>|&&|\|\||\breturn\b|\bimport\b/.test(raw)) continue;
        const flat = raw.replace(/\s+/g, " ").trim();
        const lineNo = code.slice(0, m.index).split("\n").length;
        for (const [pattern, label] of BANNED_CLAIMS) {
          if (pattern.test(flat)) {
            report(file, lineNo, `${label}: ${flat.slice(0, 70)}`);
          }
        }
      }
    }
  }
);

// ── §4 Presentation ─────────────────────────────────────────────────────────

rule(
  "base64-image",
  "No base64 image data in source (STOREFRONT_RULES §4.5)",
  report => {
    scan(({ file, line, text }) => {
      if (/data:image\/[a-z+]+;base64/i.test(text)) {
        report(file, line, "base64 image embedded in the bundle");
      }
    });
  }
);

rule(
  "raw-internal-anchor",
  'Internal nav uses wouter <Link>, not <a href="/…"> (STOREFRONT_RULES §4.6)',
  report => {
    scan(({ file, line, text }) => {
      const m = text.match(/<a\s[^>]*href=["']\/(?!\/)[^"']*["']/);
      if (m) report(file, line, `raw anchor to an internal route: ${m[0].slice(0, 60)}`);
    });
  }
);

rule(
  "theme-block-scope",
  "[data-xl-theme] blocks set colour only (STOREFRONT_RULES §4.4)",
  report => {
    const css = join(SRC, "index.css");
    const src = readIfExists(css);
    const re = /\[data-xl-theme=[^\]]+\]\s*\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(src))) {
      const lineNo = src.slice(0, m.index).split("\n").length;
      for (const decl of m[1].split(";")) {
        const prop = decl.split(":")[0]?.trim();
        if (!prop) continue;
        // Only the two theming variables are permitted.
        if (!/^--xl-(accent|accent-soft|hero-grad)$/.test(prop)) {
          report(css, lineNo, `theme block sets "${prop}" — themes may set colour only`);
        }
      }
    }
  }
);

// ── §5 Architecture ─────────────────────────────────────────────────────────

rule(
  "supabase-in-component",
  "Components go through lib/*Service.ts, never supabase directly (STOREFRONT_RULES §5.1)",
  report => {
    const files = FILES.filter(f => {
      const rel = relative(SRC, f);
      return rel.startsWith("components" + sep) || rel.startsWith("pages" + sep);
    });
    scan(({ file, line, text }) => {
      if (/from\s+["'](?:@\/lib\/supabase|\.\.?\/.*\/supabase)["']/.test(text)) {
        // Type-only imports are fine — they carry no runtime coupling.
        if (/^\s*import\s+type\b/.test(text)) return;
        if (/\bimport\s*\{[^}]*\}\s*from/.test(text)) {
          const names = text.match(/\{([^}]*)\}/)?.[1] ?? "";
          if (/\bsupabase\b/.test(names)) {
            report(file, line, "component imports the supabase client directly");
          }
        }
      }
    }, files);
  }
);

rule(
  "revived-getitemcount",
  "getItemCount was deleted deliberately and must not return (STOREFRONT_RULES §5.2)",
  report => {
    scan(({ file, line, text }) => {
      if (/\bgetItemCount\b/.test(text)) {
        report(file, line, "getItemCount is ambiguous — use getPackCount/getPieceCount/getLineCount");
      }
    });
  }
);

// ── Report ──────────────────────────────────────────────────────────────────

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

console.log(`\nStorefront guardrails — ${FILES.length} files in scope\n`);

if (VERBOSE) {
  for (const r of ran) {
    const ok = r.count === 0;
    console.log(
      `  ${ok ? GREEN + "ok  " : RED + "FAIL"}${RESET}  ${r.id}${DIM}${ok ? "" : ` (${r.count})`}${RESET}`
    );
  }
  console.log("");
}

if (violations.length === 0) {
  console.log(`${GREEN}All storefront guardrails passed.${RESET}\n`);
  process.exit(0);
}

const byRule = new Map();
for (const v of violations) {
  if (!byRule.has(v.id)) byRule.set(v.id, { description: v.description, items: [] });
  byRule.get(v.id).items.push(v);
}

for (const [id, { description, items }] of byRule) {
  console.log(`${RED}✗ ${id}${RESET} — ${description}`);
  for (const it of items) {
    console.log(`    ${it.file}:${it.line}  ${DIM}${it.detail}${RESET}`);
  }
  console.log("");
}

console.log(
  `${RED}${violations.length} violation${violations.length === 1 ? "" : "s"}.${RESET} ` +
    `See docs/STOREFRONT_RULES.md for why each rule exists.\n`
);
process.exit(1);
