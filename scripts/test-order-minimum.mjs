import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// No URL, credentials, network or persistent database. Only synthetic fixtures.
const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const baseline = await read("supabase/test-fixtures/order-minimum-baseline.sql");
const original = await read("supabase/migrations/20260919123000_atomic_order_creation.sql");
const pricedId = "50000000-0000-0000-0000-000000000001";
const enquiryId = "50000000-0000-0000-0000-000000000002";
const item = (quantity, product_id = pricedId) => ({ product_id, quantity });
const db = await PGlite.create();
let checks = 0;
try {
  await db.exec(baseline);
  await db.exec(original);
  const call = async items => {
    await db.exec("set role authenticated; set request.jwt.claim.sub = '60000000-0000-0000-0000-000000000001'");
    try {
      return await db.query("select public.place_order_from_cart($1, $2, $3::jsonb) as id", [
        "Synthetic test", "9876543210", JSON.stringify(items),
      ]);
    } finally {
      await db.exec("reset role");
    }
  };
  const orderCount = async () => (await db.query("select count(*)::int as n from public.orders")).rows[0].n;
  const clear = () => db.exec("truncate public.order_items, public.orders");
  const settings = (enabled, value) => db.query(
    "insert into public.site_content values ('min_order_enabled', $1::jsonb), ('min_order_value', $2::jsonb) on conflict (key) do update set value=excluded.value",
    [JSON.stringify(enabled), JSON.stringify(value)]
  );
  const accepted = async (items, expectedTotal, description) => {
    const { rows } = await call(items);
    const stored = await db.query("select total_amount from public.orders where id = $1", [rows[0].id]);
    assert.equal(Number(stored.rows[0].total_amount), expectedTotal, description);
    const lines = await db.query("select sum(subtotal) as total from public.order_items where order_id = $1", [rows[0].id]);
    assert.equal(Number(lines.rows[0].total), expectedTotal, `${description}: line total`);
    console.log(`ok ${++checks} - ${description}`);
    await clear();
  };

  await accepted([item(1)], 125, "pre-fix control reproduces order below configured 1000 minimum");
  if (!process.argv.includes("--baseline-only")) {
    const migration = await read("supabase/migrations/20260920042455_enforce_minimum_order_value.sql");
    await db.exec(migration);
    await db.exec(migration);
    const rejected = async (items, description) => {
      const before = await orderCount();
      await assert.rejects(call(items), error => error.code === "22023" && /minimum order value/.test(error.message));
      assert.equal(await orderCount(), before, "rejection must not leave an order header");
      assert.equal((await db.query("select count(*)::int as n from public.order_items")).rows[0].n, 0);
      console.log(`ok ${++checks} - ${description}`);
    };
    await rejected([item(1)], "customer cannot bypass the minimum through the RPC");
    await rejected([{ ...item(1), price: 10000 }], "client-supplied price cannot satisfy the minimum");
    await rejected([item(1), item(1, enquiryId)], "enquiry lines do not exempt a mixed priced order");
    await accepted([item(8)], 1000, "exactly at the minimum is accepted");
    await accepted([item(9)], 1125, "above the minimum is accepted");
    await accepted([item(1, enquiryId)], 0, "all-enquiry order retains its existing exemption");
    await settings(false, 1000);
    await accepted([item(1)], 125, "disabled minimum does not block orders");
    await settings(true, 0);
    await accepted([item(1)], 125, "zero minimum does not block orders");
    await db.exec("delete from public.site_content");
    await accepted([item(1)], 125, "missing settings retain disabled fallback");
    await db.exec("insert into public.site_content values ('min_order_enabled', 'true')");
    await accepted([item(1)], 125, "missing amount retains zero fallback");
    await db.exec("set role anon");
    await assert.rejects(db.query("select public.place_order_from_cart('Test', '9876543210', '[]')"), error => error.code === "42501");
    await db.exec("reset role");
    console.log(`ok ${++checks} - anonymous RPC access remains denied`);
    console.log("Minimum-order migration passed after two applications; no external database used.");
  }
} finally {
  await db.close();
}
