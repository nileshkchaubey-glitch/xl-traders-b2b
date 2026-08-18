---
name: review-pr
description: Mechanically review a storefront PR before merge — run the CI gate, independently verify every claim the PR body makes, check scope and the forbidden set, and audit new customer-facing strings against docs/. Runs in an isolated subagent.
argument-hint: [PR number, or blank for the current branch]
context: fork
agent: storefront-reviewer
background: false
disable-model-invocation: false
---

Review the current branch against `main` — or the PR given as an argument.

Runs in a forked subagent (`storefront-reviewer`) so that reading the whole
diff, grepping the tree and running the build does not consume the main
conversation's context. Only the verdict comes back.

`background: false` because a review is worth waiting for: its result should
land in the turn that asked for it, not arrive after the next decision has
already been made.

## Steps

1. **Establish the target.**
   - With a PR number: `gh pr view <n> --json title,body,files` for the body
     and file list, and `gh pr diff <n>` for the diff.
   - Without one: `git log --oneline origin/main..HEAD` and
     `git diff origin/main...HEAD`. Use the branch's commit messages as the
     claims to verify.

2. **Run the gate.** `npm run ci`. Paste real output. If it fails, that is the
   headline — report and stop.

3. **Check scope.** File count against the ~15 limit; anything changed that the
   PR body does not mention; anything in `components/admin/**` when the PR
   claims to be storefront-only.

4. **Verify every claim.** For each factual statement in the PR body, run the
   check yourself and report CONFIRMED or CONTRADICTED with the command used.
   Grep for import specifiers, not bare identifiers.

5. **Check the forbidden set.** Per `docs/STOREFRONT_RULES.md`.

6. **Audit customer-facing strings.** Every string added or changed, and where
   in `docs/` it is confirmed. Unconfirmed strings are flagged, not shipped.

## The procedure

@.claude/agents/storefront-reviewer.md

The full procedure, operating rules and output format are imported above rather
than left to the agent's system prompt.

**Why this import exists.** The first run of this skill forked correctly but
executed with a generic subagent prompt — `agent: storefront-reviewer` did not
bind the persona. Everything living only in the agent file was silently skipped:
the output format, the import-direction rule, the positive-control rule, the
customer-facing-strings table. The reviewer noticed and recovered by reading the
file off disk, but a guardrail that depends on the agent noticing is not a
guardrail. Importing it makes the procedure load either way, and keeps one copy
— the agent file stays the single source.

## Invocation policy: model-invocable

`disable-model-invocation: false` **deliberately**. This skill only reads — it
runs the CI gate, greps the tree and inspects a diff. It changes nothing.

It was shipped as `true` in #161 and that was a mistake, found the first time it
mattered: asked to review a branch before opening a PR, the agent could not run
its own review gate. Blocking programmatic invocation on a read-only skill costs
review coverage and buys nothing.

**The line, project-wide:** a skill is model-invocable unless its side effects
land **outside version control** — a production database, an external service, a
published artefact. Code changes are inside version control and revertible, so
they do not count. `sql-migration` is the one skill on the other side of that
line, and its own file says why.

Do not approve anything. Report findings and let the lead decide.
