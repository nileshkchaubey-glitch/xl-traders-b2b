---
name: review-pr
description: Mechanically review a storefront PR before merge — run the CI gate, independently verify every claim the PR body makes, check scope and the forbidden set, and audit new customer-facing strings against docs/. Runs in an isolated subagent.
argument-hint: [PR number, or blank for the current branch]
context: fork
agent: storefront-reviewer
background: false
disable-model-invocation: true
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

Follow the review procedure and output format in your system prompt. Do not
approve anything — report findings and let the lead decide.
