import { describe, it, expect } from "vitest";
import { validateAndParseRow, type ImportRow } from "./bulkImportService";

describe("validateAndParseRow", () => {
  const validRow = {
    name: "5 Ply Box",
    category: "Corrugated Boxes",
    unit: "box",
    price: "100",
    quantity_in_unit: "50",
  };

  it("parses a valid row", () => {
    const result = validateAndParseRow(validRow, 2);
    expect(result).toEqual<ImportRow>({
      name: "5 Ply Box",
      category: "Corrugated Boxes",
      unit: "box",
      price: 100,
      quantity_in_unit: 50,
      group: undefined,
      mrp: undefined,
      description: undefined,
      is_featured: false,
    });
  });

  it("trims whitespace from string fields", () => {
    const row = {
      ...validRow,
      name: "  Padded Box  ",
      category: " Paper ",
      unit: " piece ",
    };
    const result = validateAndParseRow(row, 2)!;
    expect(result.name).toBe("Padded Box");
    expect(result.category).toBe("Paper");
    expect(result.unit).toBe("piece");
  });

  it("parses optional fields when present", () => {
    const row = {
      ...validRow,
      group: "Boxes",
      mrp: "150",
      description: "Premium quality box",
      is_featured: "true",
    };
    const result = validateAndParseRow(row, 2)!;
    expect(result.group).toBe("Boxes");
    expect(result.mrp).toBe(150);
    expect(result.description).toBe("Premium quality box");
    expect(result.is_featured).toBe(true);
  });

  it("treats is_featured boolean true correctly", () => {
    const row = { ...validRow, is_featured: true };
    expect(validateAndParseRow(row, 2)!.is_featured).toBe(true);
  });

  it("treats is_featured numeric 1 correctly", () => {
    const row = { ...validRow, is_featured: 1 };
    expect(validateAndParseRow(row, 2)!.is_featured).toBe(true);
  });

  it("treats is_featured false-ish values correctly", () => {
    expect(
      validateAndParseRow({ ...validRow, is_featured: "false" }, 2)!.is_featured,
    ).toBe(false);
    expect(
      validateAndParseRow({ ...validRow, is_featured: 0 }, 2)!.is_featured,
    ).toBe(false);
    expect(
      validateAndParseRow({ ...validRow, is_featured: "" }, 2)!.is_featured,
    ).toBe(false);
  });

  // --- validation errors ---

  it("throws on missing name", () => {
    const row = { ...validRow, name: "" };
    expect(() => validateAndParseRow(row, 2)).toThrow(
      "Missing or invalid product name",
    );
  });

  it("throws on non-string name", () => {
    const row = { ...validRow, name: 123 };
    expect(() => validateAndParseRow(row, 2)).toThrow(
      "Missing or invalid product name",
    );
  });

  it("throws on missing category", () => {
    const row = { ...validRow, category: "" };
    expect(() => validateAndParseRow(row, 2)).toThrow(
      "Missing or invalid category",
    );
  });

  it("throws on missing unit", () => {
    const row = { ...validRow, unit: "" };
    expect(() => validateAndParseRow(row, 2)).toThrow(
      "Missing or invalid unit",
    );
  });

  it("throws on negative price", () => {
    const row = { ...validRow, price: "-5" };
    expect(() => validateAndParseRow(row, 2)).toThrow(
      "Invalid price - must be a positive number",
    );
  });

  it("throws on non-numeric price", () => {
    const row = { ...validRow, price: "abc" };
    expect(() => validateAndParseRow(row, 2)).toThrow(
      "Invalid price - must be a positive number",
    );
  });

  it("allows zero price", () => {
    const row = { ...validRow, price: "0" };
    const result = validateAndParseRow(row, 2)!;
    expect(result.price).toBe(0);
  });

  it("throws on zero quantity_in_unit", () => {
    const row = { ...validRow, quantity_in_unit: "0" };
    expect(() => validateAndParseRow(row, 2)).toThrow(
      "Invalid quantity_in_unit - must be a positive number",
    );
  });

  it("throws on negative quantity_in_unit", () => {
    const row = { ...validRow, quantity_in_unit: "-10" };
    expect(() => validateAndParseRow(row, 2)).toThrow(
      "Invalid quantity_in_unit - must be a positive number",
    );
  });

  it("throws on non-numeric quantity_in_unit", () => {
    const row = { ...validRow, quantity_in_unit: "xyz" };
    expect(() => validateAndParseRow(row, 2)).toThrow(
      "Invalid quantity_in_unit - must be a positive number",
    );
  });

  it("handles decimal price and quantity", () => {
    const row = { ...validRow, price: "99.50", quantity_in_unit: "2.5" };
    const result = validateAndParseRow(row, 2)!;
    expect(result.price).toBe(99.5);
    expect(result.quantity_in_unit).toBe(2.5);
  });
});
