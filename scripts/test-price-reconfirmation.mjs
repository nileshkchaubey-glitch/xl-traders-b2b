import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Synthetic, disposable database only. This is not full-schema staging.
const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const db = await PGlite.create();
const priced = "50000000-0000-0000-0000-000000000001";
const enquiry = "50000000-0000-0000-0000-000000000002";
const line = (price = 125, quantity = 8, product_id = priced) => ({ product_id, quantity, expected_price: price });
let checks = 0;
const check = text => console.log(`ok ${++checks} - ${text}`);
try {
  for (const path of ["supabase/test-fixtures/order-minimum-baseline.sql",
    "supabase/migrations/20260919123000_atomic_order_creation.sql",
    "supabase/migrations/20260920042455_enforce_minimum_order_value.sql"]) await db.exec(await read(path));
  const migration = await read("supabase/migrations/20260923165549_require_cart_price_reconfirmation.sql");
  await db.exec(migration);
  await db.exec(migration);
  const call = async (items, role = "authenticated", endpoint = "place_order_from_confirmed_cart") => {
    assert.ok(["anon", "authenticated"].includes(role));
    assert.ok(["place_order_from_confirmed_cart", "place_order_from_cart"].includes(endpoint));
    await db.exec(`set role ${role}; set request.jwt.claim.sub = '60000000-0000-0000-0000-000000000001'`);
    try {
      return await db.query(`select public.${endpoint}($1,$2,$3::jsonb) as id`, ["Synthetic", "9876543210", JSON.stringify(items)]);
    } finally { await db.exec("reset role"); }
  };
  const empty = async () => {
    const result = await db.query("select (select count(*) from orders)::int as headers, (select count(*) from order_items)::int as lines");
    assert.deepEqual(result.rows[0], { headers: 0, lines: 0 });
  };
  const rejected = async (items, code, description, role, endpoint) => {
    await assert.rejects(call(items, role, endpoint), error => error.code === code);
    await empty(); check(description);
  };
  await rejected([line(100)], "P0001", "price increase rejects without writing");
  await rejected([line(150)], "P0001", "price decrease also needs reconfirmation");
  await rejected([{ product_id: priced, quantity: 8 }], "22023", "missing expected price fails closed");
  await rejected([line(-1)], "22023", "negative expected price is rejected");
  await rejected([line("125")], "22023", "string expected price is rejected");
  await rejected([line(125, 1, enquiry)], "P0001", "priced-to-enquiry transition needs review");
  await rejected([line(0)], "P0001", "enquiry-to-priced transition needs review");
  await rejected([line(125, 1)], "22023", "confirmed prices cannot bypass minimum order");
  await rejected([line()], "42501", "anonymous role cannot call confirmed endpoint", "anon");
  await rejected([line()], "42501", "customer cannot bypass through the old endpoint", "authenticated", "place_order_from_cart");
  await db.exec(`update products set status='draft' where id='${priced}'`);
  await rejected([line(1)], "22023", "unpublished product does not return a price-change response");
  await db.exec(`update products set status='published' where id='${priced}'`);
  await call([line()]);
  const totals = await db.query("select total_amount, (select sum(subtotal) from order_items) as lines from orders");
  assert.equal(Number(totals.rows[0].total_amount), 1000);
  assert.equal(Number(totals.rows[0].lines), 1000);
  check("confirmed price is used consistently in header and lines");
  await db.exec("truncate order_items,orders");
  await call([line(0, 1, enquiry)]);
  assert.equal(Number((await db.query("select total_amount from orders")).rows[0].total_amount), 0);
  check("confirmed enquiry order retains the existing exemption");
  console.log(`${checks} price reconfirmation checks passed after two migration applications; synthetic local schema only.`);
} finally { await db.close(); }
