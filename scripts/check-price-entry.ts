/**
 * Regression check for the per-piece price-entry helpers.
 *
 * Run: npm run check:price
 * (Node strips the types natively — no test runner, no new dependency.)
 *
 * The invariant that matters is NOT that the two conversions round-trip
 * cleanly — they cannot, because display rounds to 4 dp and storage to 2. It
 * is that a price the operator never edited comes back byte-for-byte
 * unchanged. ₹4897 over a pack of 480 shows as 10.2021 and converts back to
 * ₹4897.01, so any surface that converts unconditionally rewrites a value
 * nobody typed — the DE-01 failure mode this whole feature exists to prevent.
 *
 * Both editing paths therefore keep the original pack string beside the draft
 * and reuse it when the displayed rate is untouched:
 *   - table   → CellEdit.originalPack / .seededPiece, used by packValueOf()
 *   - forms   → usePriceEntry's originRef, used by onChange()
 * This file exercises the shared arithmetic those two rely on, and asserts
 * the untouched-open-and-close case directly.
 */
import {
  packDivisor,
  packFromPiece,
  pieceFromPack,
  perPieceRate,
} from "../client/src/lib/priceEntryMode.ts";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = Object.is(actual, expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "  ok  " : "  FAIL"}  ${label}` +
      (ok
        ? ""
        : `\n          expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  );
}

/**
 * What a surface stores when an edit is committed. Mirrors the real guard in
 * CatalogTreeEditor.packValueOf() and usePriceEntry's onChange: convert only
 * when the DISPLAYED rate differs from what the box was seeded with, and
 * otherwise hand back the stored string untouched.
 *
 * `typed === undefined` models opening the editor and closing it without
 * touching the value. Deliberately written so that deleting the guard (i.e.
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

console.log("\nopen-and-close without editing must not change the price");
// 4897 is the CodeRabbit case: 4897/480 = 10.2020833… → 10.2021 → 4897.008.
for (const [pack, qty] of [
  ["4897", 480],
  ["12", 480],
  ["9.4", 600],
  ["5.25", 900],
  ["1", 900],
  ["4450", 1],
  ["0.75", 480],
  ["123456.78", 37],
] as const) {
  check(`₹${pack} / pack of ${qty}`, commitEdit(pack, qty), pack);
}

console.log("\ntyping the rate back to what was shown also preserves it");
check(
  "₹4897 → retype 10.2021",
  commitEdit("4897", 480, pieceFromPack("4897", 480)),
  "4897"
);

console.log("\na genuinely changed rate does get converted");
check("₹4897 → type 10.50", commitEdit("4897", 480, "10.50"), "5040");
check("₹12 → type 0.03", commitEdit("12", 480, "0.03"), "14.4");

console.log("\nthe conversion pair is genuinely lossy (why the guard exists)");
check("4897 → per piece", pieceFromPack("4897", 480), "10.2021");
check("…and back again drifts", packFromPiece("10.2021", 480), "4897.01");

console.log("\nan edited rate does convert");
check("10.20 typed → pack", packFromPiece("10.20", 480), "4896");
check("0.025 typed → pack", packFromPiece("0.025", 480), "12");

console.log("\nper-piece entry is unavailable where it has no meaning");
check("null pack qty", packDivisor(null), null);
check("pack qty 1", packDivisor(1), null);
check("blank pack qty", packDivisor(""), null);
check("junk pack qty", packDivisor("abc"), null);
check("null price", perPieceRate(null, 480), null);

console.log("\nunparseable input passes through for validateEdit to refuse");
check("junk stays junk", packFromPiece("abc", 480), "abc");
check("blank stays blank", packFromPiece("", 480), "");
check("blank display stays blank", pieceFromPack("", 480), "");

console.log(
  failures === 0
    ? "\nAll price-entry checks passed.\n"
    : `\n${failures} price-entry check(s) FAILED.\n`
);
process.exit(failures === 0 ? 0 : 1);
