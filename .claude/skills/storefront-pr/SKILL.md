---
name: storefront-pr
description: Start a storefront work order. Loads the storefront invariants and ordering spec, then states the standing constraints (branch, size, CI, merge policy, SQL, claims). Use when beginning any change to client/src storefront code.
argument-hint: [what you are building]
---

# Storefront work order

@docs/STOREFRONT_RULES.md

## Ordering

If this change touches quantities, packs, pieces, MOQ, steps or money, read
`docs/ORDERING_MODEL.md` before writing anything — §1 (field design), §2 (the
conversion boundary) and §6 (edge cases) are the operative parts. Not loaded
inline: it is ~1,200 lines and most storefront changes do not touch ordering.

## Settled decisions

Already in context via CLAUDE.md — do not re-derive or re-litigate them:

- **Image pipeline** — no paid Supabase transformations; resize on upload.
- **Selling-unit noun** — `pcs` is an ABSENT value; falls back to "Pack of N".
  Do not hardcode `"pack"`, do not populate the column by hand.
- **Unit of sale** — `price` is the price of ONE selling unit, never per-piece.
- **Critical Rules** — the numbered list at the foot of CLAUDE.md.

## Standing constraints

| Constraint | Rule |
| --- | --- |
| Branch | One at a time. Branch from an up-to-date `main`. |
| Size | ~15 files max. If it grows past that, split it and say how. |
| Gate | `npm run ci` must pass — check, check:storefront, test, build. |
| Merge | **Security and schema PRs are never self-merged.** Neither is anything touching payment/checkout money logic, deletion of a feature, or auth. |
| Order | **A security PR merges before a self-mergeable one.** Never let self-mergeable work overtake a PR awaiting approval. |
| SQL | Additive only — `ADD COLUMN`, `CREATE TABLE/INDEX/POLICY`, `GRANT`. Anything that drops or overwrites: stop and ask. Use `/sql-migration`. |
| Claims | **Never invent a business claim.** Dispatch ≠ delivery. If a number, timing or capability is not confirmed in `docs/`, it does not ship — flag it. |

## Before opening the PR

1. `npm run ci` — paste real output, not a summary of expected output.
2. Verify in the browser if the change is observable there. `tsc` passing is
   not verification: the "5 pcses" defect type-checked cleanly and was only
   caught by reading a real page.
3. If copy changed, update the `site_content` **row** too — a stored row wins
   over `FALLBACKS`, so a code-only change is cosmetic.
4. Run `/review-pr` before asking for review.

## Reporting

State what you could not verify rather than implying you did. If you correct an
earlier claim of your own, say so plainly and move on.
