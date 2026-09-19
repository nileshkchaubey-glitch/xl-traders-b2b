import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgtap } from "@electric-sql/pglite-pgtap";

// Always ephemeral: no URL, environment credentials, disk database or network.
const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const [baseline, migration, tests] = await Promise.all([
  read("supabase/test-fixtures/authorization-baseline.sql"),
  read("supabase/migrations/20260919104358_authorization_security_hardening.sql"),
  read("supabase/tests/authorization_security_roles_test.sql"),
]);

async function run(hardened) {
  const db = await PGlite.create({ extensions: { pgtap } });
  try {
    await db.exec(baseline);
    if (hardened) {
      await db.exec(migration);
      await db.exec(migration); // rerun must succeed and preserve role behavior
    }
    const result = await db.exec(tests);
    const lines = result.flatMap(r => r.rows.flatMap(row => Object.values(row)))
      .filter(value => typeof value === "string").flatMap(value => value.split("\n"));
    const failures = lines.filter(line => /^not ok\b|^Bail out!/.test(line));
    const assertions = lines.filter(line => /^(?:not )?ok\s+\d+/.test(line));
    const plan = lines.find(line => /^1\.\.\d+$/.test(line));
    assert.ok(plan, "pgTAP must emit a test plan");
    assert.equal(assertions.length, Number(plan.slice(3)), "pgTAP must execute the entire plan");
    if (hardened) {
      console.log(lines.filter(line => /^(?:not )?ok\b|^1\.\.|^#/.test(line)).join("\n"));
      assert.deepEqual(failures, [], "authorization regressions failed");
      const { rows } = await db.query("select count(*)::int as count from auth.users");
      assert.equal(rows[0].count, 0, "test transaction must leave no identity fixtures");
    } else {
      assert.ok(failures.some(line => /promote themselves/.test(line)), "baseline must reproduce self-promotion");
      assert.ok(failures.some(line => /customer updates to business_settings/.test(line)), "baseline must reproduce settings writes");
      assert.ok(failures.some(line => /customer deletes from import_logs/.test(line)), "baseline must reproduce log deletion");
      assert.ok(failures.some(line => /anonymous users cannot read v_product_health/.test(line)), "baseline must reproduce health disclosure");
      console.log(`Pre-fix control: reproduced ${failures.length} failing security assertions.`);
    }
  } finally {
    await db.close();
  }
}

await run(false);
await run(true);
console.log("Authorization migration passed role tests after two applications; no external database used.");
