/**
 * Regression check for lib/seriesModel.ts — series collapsing.
 *
 * The bug this exists to prevent is not a crash: it is ten cards that all say
 * "Hinged box", filling the storefront's entire first screen with the same
 * name, the same photo and the same price state. That renders perfectly and
 * looks like broken data, which is exactly the class of bug a type checker
 * cannot see.
 *
 * Run with `npm run check:series` — Node's native type stripping, no test
 * runner and no new dependency (same arrangement as check:card / check:price).
 */
import { collapseSeries } from "../client/src/lib/seriesModel.ts";

const MASTER = { id: "m1", name: "Hinged box" };

const variant = (id: string, label: string, price?: number, qty = 100): never =>
  ({
    id,
    name: `Hinged box ${label}`,
    master_id: "m1",
    variant_label: label,
    quantity_in_unit: qty,
    unit_of_measure: "pcs",
    category_id: "c1",
    price,
  }) as never;

const standalone = (id: string, name: string): never =>
  ({
    id,
    name,
    master_id: null,
    variant_label: null,
    quantity_in_unit: 100,
    unit_of_measure: "pcs",
    category_id: "c1",
    price: 500,
  }) as never;

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.error(`FAIL  ${label}\n      expected: ${e}\n      actual:   ${a}`);
  }
};

// ── The headline case: ten variants become ONE entry ────────────────────────
{
  const products = [
    variant("v1", "2000 ml", 4800, 480),
    variant("v2", "1500 ml", 3600, 600),
    variant("v3", "100 ml", 900, 3000),
    variant("v4", "750 ml", 2700, 900),
  ];
  const entries = collapseSeries(products, [MASTER], true);

  check("four variants collapse to one entry", entries.length, 1);
  check("entry is a series", entries[0].kind, "series");

  const s = entries[0] as Extract<(typeof entries)[number], { kind: "series" }>;
  check("keeps every variant", s.variants.length, 4);
  check("name comes from the master", s.name, "Hinged box");
  // Range must span the real min and max, NOT the first two seen.
  check("size range spans min–max", s.sizeRange, "100–2000");
  check("shared unit detected", s.sizeUnit, "ml");
  // Lead variant is the SMALLEST size, so the PDP opens somewhere predictable.
  check("lead variant is the smallest", s.leadVariant.id, "v3");
  // Cheapest per-piece across the series: 900/3000 = 0.30 beats 4800/480 = 10.
  check("cheapest rate wins", s.fromPerPiece, 0.3);
  check("not all on enquiry", s.allOnEnquiry, false);
}

// ── Order is preserved: a series sits where its first variant sat ───────────
{
  const products = [
    standalone("p1", "News paper"),
    variant("v1", "500 ml", 100),
    standalone("p2", "Cling Wrap"),
    variant("v2", "250 ml", 100),
  ];
  const entries = collapseSeries(products, [MASTER], true);
  check(
    "series takes its first variant's position",
    entries.map(e => e.id),
    ["p1", "m1", "p2"]
  );
}

// ── A series with no usable price is On Enquiry, never ₹0 ───────────────────
{
  const entries = collapseSeries(
    [variant("v1", "500 ml"), variant("v2", "250 ml")],
    [MASTER],
    true
  );
  const s = entries[0] as Extract<(typeof entries)[number], { kind: "series" }>;
  check("all-on-enquiry series flagged", s.allOnEnquiry, true);
  check("no rate invented", s.fromPerPiece, null);
}

// ── Signed OUT sees no wholesale figure leaking through the series ──────────
{
  const entries = collapseSeries(
    [variant("v1", "500 ml", 4800, 480)],
    [MASTER],
    false // signed out, and these rows carry no mrp
  );
  const s = entries[0] as Extract<(typeof entries)[number], { kind: "series" }>;
  check("signed-out series is on enquiry", s.allOnEnquiry, true);
  check("signed-out series has no rate", s.fromPerPiece, null);
}

// ── A variant whose master we weren't given must not vanish ─────────────────
{
  const entries = collapseSeries([variant("v1", "500 ml", 100)], [], true);
  check("orphan variant renders standalone", entries.length, 1);
  check("orphan variant is a product entry", entries[0].kind, "product");
}

// ── Unparseable labels still count toward the total ─────────────────────────
{
  const entries = collapseSeries(
    [variant("v1", "500 ml", 100), variant("v2", "assorted", 100)],
    [MASTER],
    true
  );
  const s = entries[0] as Extract<(typeof entries)[number], { kind: "series" }>;
  check("unparseable variant still counted", s.variants.length, 2);
  check("single parseable size shows one figure", s.sizeRange, "500");
}

// ── Mixed units refuse to claim a shared unit ───────────────────────────────
{
  const entries = collapseSeries(
    [variant("v1", "500 ml", 100), variant("v2", "2 kg", 100)],
    [MASTER],
    true
  );
  const s = entries[0] as Extract<(typeof entries)[number], { kind: "series" }>;
  check("mixed units yield no unit", s.sizeUnit, null);
}

if (failures > 0) {
  console.error(`\n${failures} series-model assertion(s) failed.`);
  process.exit(1);
}
console.log("check-series-model: all assertions passed.");
