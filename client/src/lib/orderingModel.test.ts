import { describe, it, expect } from "vitest";
import {
  asPacks,
  resolveOrderSpec,
  pcsFromPacks,
  packsFromPcs,
  snapPcsToStep,
  stepPcs,
  stepPacks,
  initialPacks,
  lineTotal,
  formatOrderQty,
  packChipLabel,
  moqChipLabel,
  perPiecePrice,
  formatPerPiecePrice,
  type OrderSpec,
} from "./orderingModel";

/** A product row, only the fields resolveOrderSpec reads. */
const row = (o: Partial<Parameters<typeof resolveOrderSpec>[0]> = {}) =>
  ({
    order_unit: "pack",
    order_step: null,
    quantity_in_unit: 3000,
    moq: 1,
    unit_of_measure: "box",
    ...o,
  }) as Parameters<typeof resolveOrderSpec>[0];

describe("resolveOrderSpec", () => {
  it("defaults a plain pack product", () => {
    const s = resolveOrderSpec(row({ order_unit: "pack" }));
    expect(s).toMatchObject({
      unit: "pack",
      packSize: 3000,
      step: 3000,
      minPacks: 1,
      minPcs: 3000,
      noun: "box",
    });
  });

  it("enables pcs mode when the pack size is usable", () => {
    expect(resolveOrderSpec(row({ order_unit: "pcs" })).unit).toBe("pcs");
  });

  // ── §6.1 — quantity_in_unit NULL / 0 / 1 ──────────────────────────────────
  describe("unusable pack size downgrades pcs mode to pack (§6.1)", () => {
    for (const qiu of [null, undefined, 0, 1, -5, "" as unknown as number]) {
      it(`quantity_in_unit = ${JSON.stringify(qiu)}`, () => {
        const s = resolveOrderSpec(
          row({ order_unit: "pcs", quantity_in_unit: qiu as number })
        );
        expect(s.unit).toBe("pack");
        expect(s.packSize).toBe(1);
      });
    }

    it("never divides by an unknown pack size", () => {
      const s = resolveOrderSpec(
        row({ order_unit: "pcs", quantity_in_unit: null as unknown as number, moq: 4 })
      );
      expect(s.minPcs).toBe(4);
      expect(Number.isFinite(s.minPcs)).toBe(true);
    });
  });

  // ── §6.2 — order_step that is not a multiple of the pack size ─────────────
  describe("order_step must be a whole multiple of packSize (§6.2)", () => {
    it("accepts an exact multiple", () => {
      expect(
        resolveOrderSpec(row({ order_unit: "pcs", order_step: 6000 })).step
      ).toBe(6000);
    });

    it("falls back to one pack for a non-multiple (half-case)", () => {
      // 1500 on a 3000 pack would make `packs` fractional, and packs is what
      // money multiplies. Degrade rather than accept it.
      expect(
        resolveOrderSpec(row({ order_unit: "pcs", order_step: 1500 })).step
      ).toBe(3000);
    });

    it("falls back for zero, negative and non-finite steps", () => {
      for (const bad of [0, -3000, NaN, Infinity]) {
        expect(
          resolveOrderSpec(row({ order_unit: "pcs", order_step: bad })).step
        ).toBe(3000);
      }
    });

    it("snaps the MOQ floor UP to a whole step", () => {
      // MOQ 1 pack (3000 pcs) against a 2-pack step must not leave the floor
      // unreachable by the stepper.
      const s = resolveOrderSpec(
        row({ order_unit: "pcs", order_step: 6000, moq: 1 })
      );
      expect(s.minPcs).toBe(6000);
    });
  });

  describe("moq", () => {
    it("treats null/0/negative as 1 pack", () => {
      for (const m of [null, undefined, 0, -3]) {
        expect(resolveOrderSpec(row({ moq: m as number })).minPacks).toBe(1);
      }
    });

    it("derives the pieces floor as moq × packSize (§1.5)", () => {
      const s = resolveOrderSpec(row({ order_unit: "pcs", moq: 2 }));
      expect(s.minPcs).toBe(6000);
    });
  });

  describe("selling-unit noun (§8.1)", () => {
    it("uses unit_of_measure when it names the pack", () => {
      expect(resolveOrderSpec(row({ unit_of_measure: "box" })).noun).toBe("box");
      expect(resolveOrderSpec(row({ unit_of_measure: "roll" })).noun).toBe("roll");
    });

    it("falls back to 'pack' when unit_of_measure names the pieces", () => {
      for (const u of ["pcs", "PCS", " pieces ", "nos", "unit"]) {
        expect(resolveOrderSpec(row({ unit_of_measure: u })).noun).toBe("pack");
      }
    });

    it("falls back to 'pack' when unit_of_measure is missing", () => {
      expect(resolveOrderSpec(row({ unit_of_measure: "" })).noun).toBe("pack");
    });
  });

  it("survives a null product", () => {
    const s = resolveOrderSpec(null);
    expect(s).toMatchObject({ unit: "pack", packSize: 1, step: 1, minPacks: 1 });
  });
});

// ── Conversion ──────────────────────────────────────────────────────────────
describe("pcsFromPacks / packsFromPcs", () => {
  const spec = resolveOrderSpec(row({ order_unit: "pcs" }));

  it("round-trips a whole number of packs", () => {
    expect(pcsFromPacks(asPacks(2), spec)).toBe(6000);
    expect(packsFromPcs(6000, spec)).toBe(2);
  });

  it("rounds a partial pack UP, never short-changing the customer", () => {
    expect(packsFromPcs(3001, spec)).toBe(2);
    expect(packsFromPcs(1, spec)).toBe(1);
  });

  it("maps zero and junk to zero packs", () => {
    for (const bad of [0, -100, NaN, Infinity]) {
      expect(packsFromPcs(bad, spec)).toBe(0);
    }
  });
});

// ── The brief's worked example ──────────────────────────────────────────────
describe("the ladder from the brief", () => {
  const spec = resolveOrderSpec(
    row({ order_unit: "pcs", quantity_in_unit: 3000, moq: 1, order_step: 3000 })
  );

  it("climbs and descends in whole steps, then removes the line", () => {
    let pcs = spec.minPcs;
    expect(pcs).toBe(3000);
    pcs = stepPcs(pcs, 1, spec);
    expect(pcs).toBe(6000);
    pcs = stepPcs(pcs, 1, spec);
    expect(pcs).toBe(9000);
    pcs = stepPcs(pcs, -1, spec);
    expect(pcs).toBe(6000);
    pcs = stepPcs(pcs, -1, spec);
    expect(pcs).toBe(3000);
    pcs = stepPcs(pcs, -1, spec);
    expect(pcs).toBe(0); // line removed
  });

  it("never RETAINS 1000, 2000 or 4500", () => {
    expect(snapPcsToStep(4500, spec)).toBe(6000); // ties round up
    expect(snapPcsToStep(1000, spec)).toBe(3000); // nearest is 0, clamped to floor
    expect(snapPcsToStep(2000, spec)).toBe(3000);
    for (const typed of [1000, 2000, 4500]) {
      expect([1000, 2000, 4500]).not.toContain(snapPcsToStep(typed, spec));
    }
  });

  it("computes the total from packs, not pieces", () => {
    const packs = packsFromPcs(6000, spec);
    expect(packs).toBe(2);
    expect(lineTotal(packs, 4897)).toBe(9794);
  });
});

describe("snapPcsToStep", () => {
  const spec = resolveOrderSpec(row({ order_unit: "pcs", quantity_in_unit: 100, moq: 5 }));

  it("preserves 0 so the stepper can still reach 'remove'", () => {
    expect(snapPcsToStep(0, spec)).toBe(0);
    expect(snapPcsToStep(-50, spec)).toBe(0);
  });

  it("clamps up to the MOQ floor", () => {
    expect(spec.minPcs).toBe(500);
    expect(snapPcsToStep(100, spec)).toBe(500);
  });

  it("rounds ties up", () => {
    expect(snapPcsToStep(550, spec)).toBe(600);
  });

  it("is idempotent — snapping a snapped value changes nothing", () => {
    for (const v of [0, 137, 550, 4500, 99999]) {
      const once = snapPcsToStep(v, spec);
      expect(snapPcsToStep(once, spec)).toBe(once);
    }
  });
});

describe("stepPacks", () => {
  const spec = resolveOrderSpec(row({ moq: 2 }));

  it("drops to 0 below the MOQ rather than to moq-1", () => {
    expect(stepPacks(asPacks(3), -1, spec)).toBe(2);
    expect(stepPacks(asPacks(2), -1, spec)).toBe(0);
  });

  it("increments freely upward", () => {
    expect(stepPacks(asPacks(2), 1, spec)).toBe(3);
  });
});

describe("initialPacks", () => {
  it("seeds a new line at the MOQ", () => {
    expect(initialPacks(resolveOrderSpec(row({ moq: 5 })))).toBe(5);
    expect(initialPacks(resolveOrderSpec(row({ moq: null as unknown as number })))).toBe(1);
  });
});

// ── Money ───────────────────────────────────────────────────────────────────
describe("lineTotal", () => {
  it("multiplies packs by the pack price", () => {
    expect(lineTotal(asPacks(2), 4897)).toBe(9794);
    expect(lineTotal(asPacks(0), 4897)).toBe(0);
  });

  it("treats a null/absent price as 0, never NaN (on enquiry)", () => {
    expect(lineTotal(asPacks(3), null)).toBe(0);
    expect(lineTotal(asPacks(3), undefined)).toBe(0);
  });

  it("treats 0 and negative prices as on-enquiry, per the single price rule", () => {
    expect(lineTotal(asPacks(3), 0)).toBe(0);
    expect(lineTotal(asPacks(3), -50)).toBe(0);
  });

  it("never returns NaN for any price input", () => {
    for (const p of [null, undefined, 0, -1, NaN]) {
      expect(Number.isNaN(lineTotal(asPacks(2), p as number))).toBe(false);
    }
  });
});

describe("asPacks", () => {
  it("floors fractions and clamps negatives — a pack is indivisible", () => {
    expect(asPacks(2.9)).toBe(2);
    expect(asPacks(-4)).toBe(0);
    expect(asPacks(NaN)).toBe(0);
  });
});

// ── Variant override (§6.4) ─────────────────────────────────────────────────
describe("variants resolve independently of their master", () => {
  it("a variant's own columns drive its spec", () => {
    const small = resolveOrderSpec(
      row({ order_unit: "pcs", quantity_in_unit: 1000, moq: 1 })
    );
    const large = resolveOrderSpec(
      row({ order_unit: "pcs", quantity_in_unit: 3000, moq: 1 })
    );
    expect(small.packSize).toBe(1000);
    expect(large.packSize).toBe(3000);

    // The reason a piece count must never be carried across a variant switch:
    // the same 6000 pieces is a different number of packs, and packs is money.
    expect(packsFromPcs(6000, small)).toBe(6);
    expect(packsFromPcs(6000, large)).toBe(2);
    expect(lineTotal(packsFromPcs(6000, small), 100)).toBe(600);
    expect(lineTotal(packsFromPcs(6000, large), 100)).toBe(200);
  });
});

// ── Copy ────────────────────────────────────────────────────────────────────
describe("formatOrderQty", () => {
  it("pack mode keeps a bare selling-unit count with no secondary line", () => {
    const spec = resolveOrderSpec(row({ order_unit: "pack", unit_of_measure: "box" }));
    expect(formatOrderQty(asPacks(2), spec)).toEqual({
      primary: "2 boxes",
      secondary: null,
    });
    expect(formatOrderQty(asPacks(1), spec).primary).toBe("1 box");
  });

  it("pcs mode leads with pieces and shows packs beneath (§8.4)", () => {
    const spec = resolveOrderSpec(row({ order_unit: "pcs", unit_of_measure: "box" }));
    const label = formatOrderQty(asPacks(2), spec);
    expect(label.primary).toBe("6,000 pcs");
    expect(label.secondary).toBe("2 boxes × 3,000 pcs");
  });
});

// ── Card labels ─────────────────────────────────────────────────────────────
describe("packChipLabel", () => {
  it("names the selling unit and its size", () => {
    expect(packChipLabel(resolveOrderSpec(row({ unit_of_measure: "box", quantity_in_unit: 900 })))).toBe("Box of 900");
    expect(packChipLabel(resolveOrderSpec(row({ unit_of_measure: "roll", quantity_in_unit: 72 })))).toBe("Roll of 72");
  });

  it("falls back to 'Pack' when unit_of_measure names the pieces", () => {
    expect(packChipLabel(resolveOrderSpec(row({ unit_of_measure: "pcs", quantity_in_unit: 1500 })))).toBe("Pack of 1,500");
  });

  it("renders nothing when the pack size says nothing", () => {
    for (const qiu of [null, 0, 1]) {
      expect(packChipLabel(resolveOrderSpec(row({ quantity_in_unit: qiu as number })))).toBeNull();
    }
  });
});

describe("moqChipLabel", () => {
  it("counts in the unit the customer is counting in", () => {
    expect(moqChipLabel(resolveOrderSpec(row({ order_unit: "pcs", quantity_in_unit: 3000, moq: 1 })))).toBe("MOQ 3,000 pcs");
    expect(moqChipLabel(resolveOrderSpec(row({ order_unit: "pack", unit_of_measure: "box", moq: 2 })))).toBe("MOQ 2 boxes");
    expect(moqChipLabel(resolveOrderSpec(row({ order_unit: "pack", unit_of_measure: "box", moq: 1 })))).toBe("MOQ 1 box");
  });
});

describe("perPiecePrice", () => {
  it("divides the pack price by the pack size", () => {
    const spec = resolveOrderSpec(row({ quantity_in_unit: 480 }));
    expect(perPiecePrice(4897, spec)).toBeCloseTo(10.2021, 4);
  });

  it("returns null when there is no usable pack size — never a bogus rate", () => {
    for (const qiu of [null, 0, 1]) {
      expect(perPiecePrice(100, resolveOrderSpec(row({ quantity_in_unit: qiu as number })))).toBeNull();
    }
  });

  it("returns null for an absent or on-enquiry price", () => {
    const spec = resolveOrderSpec(row({ quantity_in_unit: 480 }));
    for (const p of [null, undefined, 0, -5, NaN]) {
      expect(perPiecePrice(p as number, spec)).toBeNull();
    }
  });

  it("keeps sub-paisa rates visible rather than rounding them to zero", () => {
    const spec = resolveOrderSpec(row({ quantity_in_unit: 3000 }));
    expect(formatPerPiecePrice(perPiecePrice(2.1, spec)!)).toBe("0.0007");
  });
});

// ── The invariant, stated as a property ─────────────────────────────────────
describe("invariant: money is packs × price, never pieces × anything", () => {
  const specs: OrderSpec[] = [
    resolveOrderSpec(row({ order_unit: "pcs", quantity_in_unit: 3000 })),
    resolveOrderSpec(row({ order_unit: "pcs", quantity_in_unit: 100, moq: 5 })),
    resolveOrderSpec(row({ order_unit: "pack", quantity_in_unit: 1 })),
  ];

  it("total always equals packs × price for any snapped quantity", () => {
    for (const spec of specs) {
      for (const typed of [0, 1, 137, 3000, 4500, 12345]) {
        const packs = packsFromPcs(snapPcsToStep(typed, spec), spec);
        expect(lineTotal(packs, 12.5)).toBeCloseTo(packs * 12.5, 10);
      }
    }
  });

  it("a snapped piece count always divides into whole packs", () => {
    for (const spec of specs) {
      for (const typed of [1, 137, 3000, 4500, 12345]) {
        const pcs = snapPcsToStep(typed, spec);
        expect(pcs % spec.packSize).toBe(0);
      }
    }
  });
});
