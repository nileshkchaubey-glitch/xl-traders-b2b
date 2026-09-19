import { describe, expect, it } from "vitest";
import { parseOptionalImportNumber } from "./bulkImportService";

describe("parseOptionalImportNumber", () => {
  it("accepts correctly grouped prices without truncating them", () => {
    expect(parseOptionalImportNumber("1,250", "price")).toBe(1250);
    expect(parseOptionalImportNumber("1,25,000.50", "price")).toBe(125000.5);
  });

  it("rejects partial numbers and invalid numeric values", () => {
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
