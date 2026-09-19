import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseOptionalImportNumber } from "./importNumber";
import { dryRunImport, parseCSV } from "./bulkImportService";

// Exercise the real row validator and dry-run traversal without a network or
// browser FileReader. Any attempted database write fails the test immediately.
const database = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: database }));
vi.mock("papaparse", async importOriginal => {
  const actual = await importOriginal<typeof import("papaparse")>();
  return {
    ...actual,
    default: {
      ...actual.default,
      parse: (input: unknown, config: any) => {
        config.complete(actual.default.parse(String(input), {
          header: config.header,
          skipEmptyLines: config.skipEmptyLines,
          transformHeader: config.transformHeader,
        }));
      },
    },
  };
});

beforeEach(() => {
  database.from.mockReset();
  database.from.mockImplementation(() => ({
    select: () => ({
      order: async () => ({ data: [] }),
      in: async () => ({ data: [] }),
      eq: () => ({ maybeSingle: async () => ({ data: null }) }),
    }),
    insert: () => { throw new Error("Dry run attempted a database write"); },
  }));
});

describe("parseOptionalImportNumber", () => {
  it("accepts correctly grouped prices without truncating them", () => {
    expect(parseOptionalImportNumber("1,250", "price")).toBe(1250);
    expect(parseOptionalImportNumber("1,25,000.50", "price")).toBe(125000.5);
  });

  it("rejects partial numbers and invalid numeric values", () => {
    expect(() => parseOptionalImportNumber("123,45,000", "price")).toThrow("Invalid price");
    expect(() => parseOptionalImportNumber("12abc", "price")).toThrow(
      "Invalid price"
    );
    expect(() =>
      parseOptionalImportNumber("-1", "MOQ", { integer: true, positive: true })
    ).toThrow("Invalid MOQ");
    expect(() =>
      parseOptionalImportNumber("2.5", "quantity_in_unit", {
        integer: true,
        positive: true,
      })
    ).toThrow("whole number");
  });

  it("accepts blank optional values and valid whole quantities", () => {
    expect(parseOptionalImportNumber("", "MRP")).toBeNull();
    expect(
      parseOptionalImportNumber("3000", "quantity_in_unit", {
        integer: true,
        positive: true,
      })
    ).toBe(3000);
  });
});

describe("CSV import boundary", () => {
  it("keeps valid rows and reports malformed prices and quantities by row", async () => {
    const csv = [
      "name,unit,price,moq,quantity_in_unit",
      'Valid,pack,"1,250",2,480',
      "Bad price,pack,12abc,1,480",
      "Bad MOQ,pack,100,-3,480",
      "Bad size,pack,100,1,1.5",
      "Enquiry,pack,0,,",
    ].join("\n");
    const result = await parseCSV(csv as unknown as File);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ price: 1250, moq: 2, quantity_in_unit: 480 });
    expect(result.rows[1]).toMatchObject({ price: null, moq: null, quantity_in_unit: 1 });
    expect(result.errors).toEqual([
      expect.stringMatching(/^Row 3: Invalid price/),
      expect.stringMatching(/^Row 4: Invalid MOQ/),
      expect.stringMatching(/^Row 5: Invalid quantity_in_unit/),
    ]);
  });

  it("reports unknown categories without creating the missing fallback category", async () => {
    const { rows } = await parseCSV(
      "name,unit,sku,category\nContainer,pack,TEST-1,Unknown" as unknown as File
    );
    const result = await dryRunImport(rows);
    expect(result.newSkus).toEqual(["TEST-1"]);
    expect(result.unknownCategories).toEqual([{ category: "unknown", rows: [2] }]);
    expect(database.from).toHaveBeenCalledWith("categories");
  });
});
