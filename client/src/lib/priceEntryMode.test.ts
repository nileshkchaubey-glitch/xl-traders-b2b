import { describe, it, expect } from "vitest";
import {
  packDivisor,
  packFromPiece,
  pieceFromPack,
  perPieceRate,
} from "./priceEntryMode";

/**
 * Regression checks for the per-piece price-entry helpers.
 *
 * Previously `scripts/check-price-entry.ts`, run by Node's native type
 * stripping. That only ever worked on a machine with Node 22.6+ — CI pins
 * Node 20 via .nvmrc, where `node foo.ts` fails with ERR_UNKNOWN_FILE_EXTENSION.
 * The checks are unchanged; only the runner is, and vitest already handles TS
 * and already runs in CI.
 *
 * ── The invariant that matters ────────────────────────────────────────────
 * It is NOT that the two conversions round-trip cleanly — they cannot, because
 * display rounds to 4 dp and storage to 2. It is that **a price the operator
 * never edited comes back byte-for-byte unchanged**.
 *
 * ₹4897 over a pack of 480 displays as 10.2021 and converts back to ₹4897.01,
 * so any surface that converts unconditionally rewrites a value nobody typed —
 * the DE-01 failure mode this feature exists to prevent.
 *
 * Both editing paths keep the original pack string beside the draft and reuse
 * it when the displayed rate is untouched:
 *   table → CellEdit.originalPack / .seededPiece, via packValueOf()
 *   forms → usePriceEntry's originRef, via onChange()
 */

/**
 * What a surface stores when an edit is committed. Mirrors the real guard in
 * CatalogTreeEditor.packValueOf() and usePriceEntry's onChange: convert only
 * when the DISPLAYED rate differs from what the box was seeded with, and
 * otherwise hand back the stored string untouched.
 *
 * `typed === undefined` models opening the editor and closing it without
 * touching the value. Deliberately written so that DELETING THE GUARD (i.e.
 * always returning packFromPiece) makes the first block below fail.
 */
function commitEdit(
  storedPack: string,
  quantityInUnit: number,
  typed?: string
): string {
  const divisor = packDivisor(quantityInUnit);
  if (divisor == null) return typed ?? storedPack;
  const seeded = pieceFromPack(storedPack, divisor);
  const shown = typed ?? seeded;
  if (shown === seeded) return storedPack;
  return packFromPiece(shown, divisor);
}

describe("open and close without editing must not change the price", () => {
  // 4897 is the CodeRabbit case: 4897/480 = 10.2020833… → 10.2021 → 4897.008.
  const cases: [string, number][] = [
    ["4897", 480],
    ["12", 480],
    ["9.4", 600],
    ["5.25", 900],
    ["1", 900],
    ["4450", 1],
    ["0.75", 480],
    ["123456.78", 37],
  ];

  for (const [pack, qty] of cases) {
    it(`₹${pack} / pack of ${qty} survives untouched`, () => {
      expect(commitEdit(pack, qty)).toBe(pack);
    });
  }

  it("typing the rate back to what was shown also preserves it", () => {
    expect(commitEdit("4897", 480, pieceFromPack("4897", 480))).toBe("4897");
  });
});

describe("a genuinely changed rate does get converted", () => {
  it("₹4897 → type 10.50", () => {
    expect(commitEdit("4897", 480, "10.50")).toBe("5040");
  });
  it("₹12 → type 0.03", () => {
    expect(commitEdit("12", 480, "0.03")).toBe("14.4");
  });
});

describe("the conversion pair is genuinely lossy — why the guard exists", () => {
  it("4897 → per piece", () => {
    expect(pieceFromPack("4897", 480)).toBe("10.2021");
  });
  it("…and back again drifts", () => {
    expect(packFromPiece("10.2021", 480)).toBe("4897.01");
  });
});

describe("an edited rate does convert", () => {
  it("10.20 typed → pack", () => {
    expect(packFromPiece("10.20", 480)).toBe("4896");
  });
  it("0.025 typed → pack", () => {
    expect(packFromPiece("0.025", 480)).toBe("12");
  });
});

describe("per-piece entry is unavailable where it has no meaning", () => {
  it("null pack qty", () => expect(packDivisor(null)).toBeNull());
  it("pack qty 1", () => expect(packDivisor(1)).toBeNull());
  it("blank pack qty", () => expect(packDivisor("")).toBeNull());
  it("junk pack qty", () => expect(packDivisor("abc")).toBeNull());
  it("null price", () => expect(perPieceRate(null, 480)).toBeNull());
});

describe("unparseable input passes through for validateEdit to refuse", () => {
  it("junk stays junk", () => expect(packFromPiece("abc", 480)).toBe("abc"));
  it("blank stays blank", () => expect(packFromPiece("", 480)).toBe(""));
  it("blank display stays blank", () => expect(pieceFromPack("", 480)).toBe(""));
});
