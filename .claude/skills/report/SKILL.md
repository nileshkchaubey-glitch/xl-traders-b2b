---
name: report
description: Write a Chat-ready summary of merged work — what shipped, what it changed, what is still open. Reads git and the GitHub API; edits nothing. Use when reporting Claude Code work back into Claude Chat, or for a stand-up / status update.
argument-hint: [range, e.g. "today", "since #170", "this week" — default: since the last report]
allowed-tools: Read, Bash(git log:*), Bash(git show:*), Bash(git diff:*), Bash(gh pr list:*), Bash(gh pr view:*), Write
model: inherit
---

# Work report

Read-only over the repo. It produces a summary for a **human reader in Claude
Chat**, not a changelog. Chat has no access to this machine — assume the reader
sees only what this file writes.

## Why this exists

Claude Chat cannot connect to a local Claude Code session. Chat plans, Code
executes, and the only bridge is text the reader can paste or open. So the
report has to stand alone: no "as discussed", no bare PR numbers, no reference
to a conversation the reader is not in.

## Source of truth, in this order

1. **Merged PR bodies** — the richest record. Each one already states what
   changed, what was measured, and what was deliberately not done.
2. **`git log`** — commit messages carry the same detail for anything squashed.
3. **`CLAUDE.md` Shipped section** — the durable prose, already reviewed.

Do **not** re-derive findings by reading source files. If a claim is not in a
PR body, a commit message or CLAUDE.md, it is not established, and the report
says so rather than reconstructing it.

## Resolve the range

- no argument → merged PRs since the newest entry in the last report, or the
  last 7 days if there is none
- `today` / `this week` → by merge date
- `since #N` → PRs numbered above N

Run `gh pr list --state merged --json number,title,mergedAt,body,additions,deletions`
and read the bodies. Include still-open PRs in a separate section — work in
review is part of the status.

## Shape

Write to `docs/reports/YYYY-MM-DD-report.md` (create the directory if needed).
Keep it under roughly 700 words; a status update that needs scrolling does not
get read.

```
# <what this batch of work was about> — <date range>

<Two or three sentences. The through-line, not a list. What is materially
different about the product now that was not true before.>

## Shipped

**#N — <plain-English title, not the commit subject>**
<Two to four sentences. Lead with the user-visible effect, then the measured
evidence. Numbers over adjectives: "all 22 rows measure exactly 28px" beats
"improved spacing".>

## In review

**#N — <title>** — <one line: what it does, and what it is waiting on.>

## Open questions

<Only decisions that are genuinely the reader's to make. Each one: the choice,
the two options, and your recommendation. If there are none, omit the section.>

## Known gaps

<Anything shipped with a caveat, deferred deliberately, or verified less
thoroughly than the rest. Also anything that broke a project rule — state it
plainly here rather than burying it.>
```

## Rules

- **Every number must come from a PR body or commit message.** Never estimate,
  round, or infer a measurement. If a PR body says a thing was "verified", the
  report may say so; if it does not, the report does not.
- **No unexplained jargon.** Internal shorthand (`A2.4`, `§4.7`, `S2`) means
  nothing to a Chat reader — expand it once, or drop it.
- **Do not flatter the work.** No "successfully", "robust", "comprehensive". A
  report that only contains good news is not a report.
- **Rule breaks and unverified claims go in Known gaps**, always, even when
  nothing went wrong in the end.
- **Link PRs as full URLs**, since Chat cannot resolve `#178`.

## Deliver

Write the file, then send it to the user with `SendUserFile`. Offer — do not
assume — to publish it as an Artifact: that produces a claude.ai URL the reader
can open directly from Chat, which is the closest thing to a Code → Chat
handoff that exists. Ask first; a report may name things the user would rather
not put on a shareable page.
