---
name: sql-migration
description: Run a database migration under the proven protocol — additive statements only, file into docs/sql/ first, prove the hole before fixing and prove it closed after, paste real verification output, log in CHANGELOG_SQL.md. Use for any schema, RLS, grant or policy change.
argument-hint: [what the migration does]
disable-model-invocation: true
---

# SQL migration protocol

## Invocation policy: NOT model-invocable

`disable-model-invocation: true` **deliberately, and this one stays.** This skill
executes statements against the production database — dev and production are the
same database — so a human should always be the one who starts it. That is true
even though the procedure below is careful: the safety of the procedure is not
the point, the identity of whoever decided to run it is.

**The line, project-wide:** a skill is model-invocable unless its side effects
land **outside version control** — a production database, an external service, a
published artefact. Code changes are inside version control and revertible, so
they do not count. `review-pr` sits on the other side of this line and was
wrongly blocked until #163; see its file.


The procedure proven across PRs #147 (schema), #148 (RLS authorization) and
#158 (storage RLS). Follow it in order.

## What you may run without asking

`ADD COLUMN` · `CREATE TABLE` · `CREATE INDEX` · `CREATE POLICY` · `CREATE VIEW`
· `GRANT` · generated columns · `INSERT … ON CONFLICT DO NOTHING`

## What you must stop and ask for first

`DROP` anything · `TRUNCATE` · `DELETE` · `ALTER … DROP` · replacing an existing
policy · any `UPDATE` that overwrites owner-authored content.

Policy replacement is authorised **per PR**, never standing. If a fix needs it,
say so and wait.

## Procedure

### 1. Write the file first

`docs/sql/<name>.sql`, before executing anything.

- Wrapped in `BEGIN` / `COMMIT`.
- **Idempotent.** `IF NOT EXISTS` for columns, tables and indexes.
  `CREATE POLICY` and `ADD CONSTRAINT` have no `IF NOT EXISTS` in Postgres —
  guard those with a `pg_policy` / `pg_constraint` lookup in a `DO` block.
  (`CREATE POLICY IF NOT EXISTS` is invalid — Critical Rule #4.)
- A header stating what it does, what it deliberately does **not** do, and why.
- A `ROLLBACK` section at the foot, commented out, that restores the prior state
  exactly.

### 2. Prove the hole — BEFORE fixing

For anything security-related, demonstrate the problem as the **real role**,
not by reading the catalog:

```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<non-admin uuid>","role":"authenticated"}';
```

Wrap probes in `BEGIN … ROLLBACK` so nothing persists. Capture results as
returned **rows** — `RAISE NOTICE` output is not returned by the MCP tool.

A policy listing is not proof. A policy can look right and still leak.

### 3. Announce, then execute

Announce destructive or production-affecting operations in the reply **before**
running them — announce, not ask. Dev and production are the same database.

### 4. Prove it closed — AFTER

Same roles, same probes:

- the non-admin action that succeeded before is now **blocked**
- **the legitimate path still works** — admin can still do the thing. A fix that
  also breaks admin is not a fix.
- reads that must stay open are still open
- confirm the probe transaction left **no trace** (row counts back to baseline)

### 5. Paste real output

Into `docs/sql/<name>-verification.md`: the before table, the after table, the
final policy state, and what persisted. Real rows, unedited.

### 6. Log it

Append to `docs/CHANGELOG_SQL.md` **in the same commit**: the statements, a
one-line reason, and — for any `UPDATE` — the previous values, so it can be
reversed.

### 7. State the limits

Name what you could not test and why. Two known ones:

- Supabase's trigger refusing direct `DELETE` on `storage.objects` fires
  **before** RLS, so the DELETE verb is not exercisable from SQL at all.
- `RAISE NOTICE` output does not come back through the MCP tool; return a table.

## Gotchas that have actually bitten

- **A stored `site_content` row wins over `FALLBACKS`.** A copy change in code
  only is cosmetic; update the row too.
- **RLS policies are OR-ed.** Adding a narrower policy cannot take a privilege
  away. `users_read_own_orders` was inert until the broad policy was dropped.
- **`ORDER BY` on an ungranted column is refused exactly like `WHERE`.** Adding
  a column for sorting means checking the grant, not just the SELECT list.
- **A new column is ungranted by default** — `sql/04` revoked the blanket table
  grant. Absence is the safe failure mode; rely on it deliberately, not by luck.
- **Never grant `price_per_piece` to `anon`** — multiplied by the readable
  `quantity_in_unit` it reconstructs the wholesale price exactly.

## Merge policy

Schema and security migrations are **never self-merged**, and they merge
**before** any self-mergeable PR that is waiting.
