/**
 * Regression check for lib/cardModel.ts — the mapper every product name on the
 * storefront passes through.
 *
 * It rewrites names by deletion (pack parentheticals, size tokens), so a
 * regression here does not throw or blank the page: it quietly ships a mangled
 * or duplicated product name to every visitor. The cases below are real rows
 * from the live catalogue, each one chosen because it broke an earlier draft:
 *
 *   - the pack parenthetical must be removed BEFORE the size is parsed, or
 *     "5X7 SILVER POUCH ( 10 KG )" reads its PACK WEIGHT as the product size;
 *   - the size token is lifted out only at the start or end of a name, and
 *     only when two words survive, or "8x8x3 WHITE" collapses to "WHITE";
 *   - a name with no parseable capacity falls back to the pack COUNT as its
 *     figure, and must flag sizeIsPackCount so the image slot doesn't print
 *     that same number twice.
 *
 * Run with `npm run check:card` — Node's native type stripping, no test
 * runner and no new dependency (the same arrangement as check:price). Note
 * tsconfig.json only includes client/src, so this file is executed rather
 * than type-checked.
 */
import { toCardModel } from "../client/src/lib/cardModel.ts";

interface Case {
  name: string;
  variant_label?: string | null;
  quantity_in_unit?: number;
  unit_of_measure?: string;
  price?: number;
  mrp?: number;
  expect: {
    name?: string;
    size?: string | null;
    sizeUnit?: string | null;
    sizeIsPackCount?: boolean;
    rateTab?: string;
    onEnquiry?: boolean;
  };
  signedIn?: boolean;
}

const cases: Case[] = [
  // ── Size parsing + name cleanup ───────────────────────────────────────────
  {
    name: "500ml Round Container Milky. ( 1000 pcs )",
    quantity_in_unit: 1000,
    expect: { name: "Round Container Milky", size: "500", sizeUnit: "ml" },
  },
  {
    // The parenthetical holds a WEIGHT. Parsing before stripping it read
    // "10 KG" as the product's size instead of the 5×7 sheet dimension.
    name: "5X7 SILVER POUCH ( 10 KG )",
    quantity_in_unit: 10,
    expect: { name: "Silver Pouch", size: "5×7", sizeUnit: null },
  },
  {
    // Stripping the leading dimension would leave the single word "WHITE".
    name: "8x8x3 WHITE ( 100 pcs )",
    quantity_in_unit: 100,
    expect: { name: "8x8x3 WHITE", size: "8×8×3" },
  },
  {
    // variant_label wins over the name, and the token is lifted from the END.
    name: "Hinged box 2000 ml",
    variant_label: "2000 ml",
    quantity_in_unit: 480,
    expect: { name: "Hinged box", size: "2000", sizeUnit: "ml" },
  },
  {
    name: "3 COMPARTMENT MEAL TRAY MINI ( 900pcs )",
    quantity_in_unit: 900,
    expect: { name: "Meal Tray Mini", size: "3", sizeUnit: "cmp" },
  },
  {
    name: "8 Inch Pizza Box (Pack of 100pcs)",
    quantity_in_unit: 100,
    expect: { name: "Pizza Box", size: "8", sizeUnit: "in" },
  },
  {
    // Trailing zeros must not invent precision: "1.60" would be wrong too.
    name: "PACKWORLD 1.6KG - 600M ( 6 ROLL )",
    quantity_in_unit: 6,
    expect: { size: "1.6", sizeUnit: "kg" },
  },
  {
    // A size mid-name is left in place rather than punching a hole; only the
    // trailing/leading positions are safe to lift.
    name: "PACKWORLD 150ML RIPPLE GLASS (2000pcs)",
    quantity_in_unit: 2000,
    expect: {
      name: "Packworld 150ml Ripple Glass",
      size: "150",
      sizeUnit: "ml",
    },
  },

  // ── Casing: only SHOUTING is corrected (lib/displayName.ts) ───────────────
  {
    // An all-caps name is title-cased so it stops shouting next to its
    // neighbours in the grid.
    name: "BURGER BOX",
    expect: { name: "Burger Box" },
  },
  {
    // A name the owner deliberately mixed-cased is left EXACTLY as authored —
    // the rule must not "tidy" data it was not asked to touch.
    name: "Paper Ice Cream Wati",
    expect: { name: "Paper Ice Cream Wati" },
  },
  {
    // Separators survive, and unit tokens keep their conventional casing.
    name: "CAP & GLOVES",
    expect: { name: "Cap & Gloves" },
  },

  // ── Pack-count fallback ───────────────────────────────────────────────────
  {
    name: "News paper",
    quantity_in_unit: 10,
    expect: {
      name: "News paper",
      size: "10",
      sizeUnit: "pcs",
      sizeIsPackCount: true,
    },
  },
  {
    name: "Mystery Item",
    expect: { size: null, sizeUnit: null, sizeIsPackCount: false },
  },

  // ── The pricing rule: signed out → MRP, signed in → wholesale ─────────────
  {
    name: "Round Container",
    quantity_in_unit: 1000,
    price: 3465,
    mrp: 3850,
    signedIn: true,
    expect: { rateTab: "₹3.47/pc", onEnquiry: false },
  },
  {
    name: "Round Container",
    quantity_in_unit: 1000,
    price: 3465,
    mrp: 3850,
    signedIn: false,
    // MRP, NOT the wholesale figure — a signed-out visitor must never see it.
    expect: { rateTab: "₹3.85/pc", onEnquiry: false },
  },
  {
    // No MRP (today's reality for anon: the column isn't even granted).
    // Must fall to enquiry, never to the wholesale price and never to ₹0.
    name: "Round Container",
    quantity_in_unit: 1000,
    price: 3465,
    signedIn: false,
    expect: { onEnquiry: true, rateTab: "" },
  },
  {
    // A stored 0 is enquiry, not free (isPriceOnEnquiry is the only gate).
    name: "Zero Priced",
    quantity_in_unit: 100,
    price: 0,
    signedIn: true,
    expect: { onEnquiry: true, rateTab: "" },
  },
  {
    // No usable pack quantity → no per-piece rate can be derived, so the tab
    // carries the pack price rather than dividing by null.
    name: "Loose Item",
    price: 180,
    signedIn: true,
    expect: { rateTab: "₹180" },
  },
  {
    // unit_of_measure names the pieces INSIDE the pack, so it labels the rate.
    name: "Tissue Napkin",
    quantity_in_unit: 25,
    unit_of_measure: "pkt",
    price: 180,
    signedIn: true,
    expect: { rateTab: "₹7.20/pkt" },
  },
];

let failures = 0;

for (const c of cases) {
  const model = toCardModel(
    {
      name: c.name,
      variant_label: c.variant_label ?? null,
      quantity_in_unit: c.quantity_in_unit,
      unit_of_measure: c.unit_of_measure ?? "pcs",
      price: c.price,
      mrp: c.mrp,
    } as never,
    c.signedIn ?? true
  );

  const actual: Record<string, unknown> = {
    name: model.name,
    size: model.size,
    sizeUnit: model.sizeUnit,
    sizeIsPackCount: model.sizeIsPackCount,
    rateTab: model.rateTab,
    onEnquiry: model.price.onEnquiry,
  };

  for (const [key, want] of Object.entries(c.expect)) {
    const got = actual[key];
    if (got !== want) {
      failures++;
      console.error(
        `FAIL  ${JSON.stringify(c.name)} [${key}]\n` +
          `      expected: ${JSON.stringify(want)}\n` +
          `      actual:   ${JSON.stringify(got)}`
      );
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} card-model assertion(s) failed.`);
  process.exit(1);
}
console.log(`check-card-model: ${cases.length} cases passed.`);
