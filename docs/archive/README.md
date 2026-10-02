# docs/archive

Documents kept for the record, not for guidance.

Everything here was **true, or believed true, when it was written** and is no
longer maintained. Where an archived document disagrees with `CLAUDE.md`,
`docs/STOREFRONT_RULES.md`, `docs/DESIGN_SYSTEM.md` or the code itself, those
win — without exception.

## Why this directory exists

Two of these documents existed **only on a feature branch** while `CLAUDE.md`
cited them by name. Deleting those branches during the Block B cleanup would
have silently deleted the documents the project was pointing at. A branch is a
place work happens, not a place work is kept.

The rule that follows: **if a document is worth citing, it belongs in `main`.**
If it is not worth keeping in `main`, remove the citation instead.

| file                                        | rescued from                                | why archived                                                                                                                              |
| ------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `2026-07-15-storefront-design-proposals.md` | `claude/storefront-design-proposals-77zaju` | Proposals for storefront PR1–PR3. All three shipped; the document describes intent, not the result.                                       |
| `2026-07-25-data-entry-ux-audit.md`         | `docs/data-entry-ux-audit`                  | Findings report behind the inline-edit safety work (PR-A). Its DE-01/DE-04 items shipped.                                                 |
| `sql/`                                      | —                                           | One-time SQL archived by the July 2026 phase-2 cleanup (`07da8e7`). This directory's original purpose; the two documents above joined it. |

## October documentation preservation

The 2026-10-02 snapshots preserve exact pre-cleanup bytes, including the 109 KB
CLAUDE blueprint, ordering design spec, design/rules/reference notes, README,
CODEX, deployment/schema and test-admin history. The inventory is in reports.
These contain superseded permissions, stale names and original relative links;
do not execute historical SQL or infer current implementation from them. Follow
the latest owner task, active root guides and current code instead.
