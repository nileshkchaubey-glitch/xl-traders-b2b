import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { parseExcel } from "./bulkImportService";
import { downloadProductTemplate, TEMPLATE_COLUMNS } from "./templateService";

// Keep the real spreadsheet codec. Only browser file I/O and database access
// are replaced, so these checks exercise the application's import/export paths.
vi.mock("./supabase", () => ({
  supabase: {
    from: () => {
      throw new Error("Excel parsing must not write to the database");
    },
  },
}));
vi.mock("xlsx", async importOriginal => ({
  ...(await importOriginal<typeof import("xlsx")>()),
  writeFile: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "FileReader",
    class {
      onload?: (event: { target: { result: ArrayBuffer } }) => void;
      readAsArrayBuffer(file: { bytes: ArrayBuffer }) {
        this.onload?.({ target: { result: file.bytes } });
      }
    }
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("patched Excel codec compatibility", () => {
  it.each(["xlsx", "biff8"] as const)(
    "imports ordering fields from %s with normalized headers",
    async bookType => {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([
          [
            " Name ",
            "Unit_Of_Measure",
            "quantity_in_unit",
            "ORDER_UNIT",
            "order_step",
            "moq",
          ],
          ["Example only", "box", 100, "PCS", 300, 2],
          ["Invalid step", "box", 100, "pcs", 150, 2],
        ]),
        "Products"
      );
      const bytes = XLSX.write(workbook, { bookType, type: "array" });
      const result = await parseExcel({ bytes } as unknown as File);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({
        unit: "box",
        order_unit: "pcs",
        order_step: 300,
        moq: 2,
      });
      expect(result.errors).toEqual([
        expect.stringMatching(/^Row 3: Order step/),
      ]);
    }
  );
  it.each(["xlsx", "biff8"] as const)(
    "imports %s with numeric validation and enquiry values intact",
    async bookType => {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([
          [
            "name",
            "unit",
            "sku",
            "barcode",
            "price",
            "moq",
            "quantity_in_unit",
            "status",
          ],
          ["કપ — Cup", "pack", "TEST-001", "001234", "1,250", 2, 50, "draft"],
          ["Enquiry pack", "pack", "TEST-002", "", "", "", "", "draft"],
          ["Invalid price", "pack", "TEST-003", "", "12abc", 1, 50, "draft"],
        ]),
        "Products"
      );
      const bytes = XLSX.write(workbook, { bookType, type: "array" });
      const result = await parseExcel({ bytes } as unknown as File);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toMatchObject({
        name: "કપ — Cup",
        sku: "TEST-001",
        barcode: "001234",
        price: 1250,
        moq: 2,
        quantity_in_unit: 50,
        status: "draft",
      });
      expect(result.rows[1]).toMatchObject({
        price: null,
        moq: null,
        quantity_in_unit: 1,
      });
      expect(result.errors).toEqual([
        expect.stringMatching(/^Row 4: Invalid price/),
      ]);
    }
  );

  it("round-trips the real downloadable template through the actual importer", async () => {
    downloadProductTemplate();
    expect(XLSX.writeFile).toHaveBeenCalledTimes(1);
    const [workbook, filename] = vi.mocked(XLSX.writeFile).mock.calls[0];
    expect(filename).toBe("xl-traders-product-template.xlsx");
    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const restored = XLSX.read(bytes, { type: "array" });
    expect(restored.SheetNames).toEqual(["Products", "Instructions"]);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(restored.Sheets.Products, {
      header: 1,
    });
    expect(rows[0]).toEqual(TEMPLATE_COLUMNS.map(column => column.label));
    expect(rows).toHaveLength(4); // header and three explicitly illustrative examples
    expect(rows[1][0]).toMatch(/^EXAMPLE ONLY/);
    const imported = await parseExcel({ bytes } as unknown as File);
    expect(imported.errors).toEqual([]);
    expect(imported.rows).toHaveLength(3);
    expect(imported.rows[0]).toMatchObject({
      unit: "box",
      quantity_in_unit: 100,
      order_unit: "pcs",
      order_step: 300,
      price: null,
      status: "draft",
    });
    expect(imported.rows[2]).toMatchObject({
      unit: "box",
      order_unit: "pack",
      order_step: 200,
    });
    expect(restored.Sheets.Instructions.A1.v).toBeTruthy();
  });
});
