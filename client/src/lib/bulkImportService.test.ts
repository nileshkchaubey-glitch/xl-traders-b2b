import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseOptionalImportNumber } from "./importNumber";
import {
  bulkImportProducts,
  dryRunImport,
  exportProductsAsCSV,
  parseCSV,
  parseMappedImportRows,
} from "./bulkImportService";

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
        config.complete(
          actual.default.parse(String(input), {
            header: config.header,
            skipEmptyLines: config.skipEmptyLines,
            transformHeader: config.transformHeader,
          })
        );
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
    insert: () => {
      throw new Error("Dry run attempted a database write");
    },
  }));
});

describe("parseOptionalImportNumber", () => {
  it("accepts correctly grouped prices without truncating them", () => {
    expect(parseOptionalImportNumber("1,250", "price")).toBe(1250);
    expect(parseOptionalImportNumber("1,25,000.50", "price")).toBe(125000.5);
  });

  it("rejects partial numbers and invalid numeric values", () => {
    expect(() => parseOptionalImportNumber("123,45,000", "price")).toThrow(
      "Invalid price"
    );
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
  it("validates Google Sheets mapped fields with the same numeric/ordering boundary", () => {
    const result = parseMappedImportRows(
      [
        {
          title: "Example only",
          selling: "box",
          size: "100",
          counts: "pcs",
          step: "300",
          rate: "1,250",
        },
        {
          title: "Bad step",
          selling: "box",
          size: "100",
          counts: "pcs",
          step: "150",
          rate: "1250",
        },
        {
          title: "Bad rate",
          selling: "box",
          size: "100",
          counts: "pack",
          step: "100",
          rate: "12abc",
        },
      ],
      {
        name: "title",
        unit: "selling",
        quantity_in_unit: "size",
        order_unit: "counts",
        order_step: "step",
        price: "rate",
      }
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      price: 1250,
      order_unit: "pcs",
      order_step: 300,
    });
    expect(result.errors).toEqual([
      expect.stringMatching(/^Row 3: Order step/),
      expect.stringMatching(/^Row 4: Invalid price/),
    ]);
  });
  it.each([
    ["pcs", "", "", "Pieces ordering"],
    ["box", "100", "100", "Choose pack or pcs"],
    ["pack", "100", "-100", "Invalid order_step"],
    ["pack", "100", "1.5", "Invalid order_step"],
  ])(
    "rejects invalid ordering %s / %s / %s",
    async (unit, size, step, error) => {
      const result = await parseCSV(
        `name,unit,quantity_in_unit,order_unit,order_step\nExample only,box,${size},${unit},${step}` as unknown as File
      );
      expect(result.rows).toEqual([]);
      expect(result.errors[0]).toContain(error);
    }
  );

  it("accepts old template legends and unit aliases, rejecting conflicting aliases", async () => {
    const result = await parseCSV(
      "name,unit,unit_of_measure,quantity_in_unit,order_unit\n* REQUIRED,* REQUIRED,(optional),(optional),(optional)\nAlias,,box,100,pack\nConflict,box,roll,100,pack" as unknown as File
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].unit).toBe("box");
    expect(result.errors[0]).toContain("Conflicting unit");
  });
  it("parses customer order fields without confusing selling units with pieces", async () => {
    const result = await parseCSV(
      "name,unit,quantity_in_unit,order_unit,order_step,moq\nExample only,box,100,pcs,300,2\nBad,box,100,pcs,150,2" as unknown as File
    );
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
  });
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
    expect(result.rows[0]).toMatchObject({
      price: 1250,
      moq: 2,
      quantity_in_unit: 480,
    });
    expect(result.rows[1]).toMatchObject({
      price: null,
      moq: null,
      quantity_in_unit: 1,
    });
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
    expect(result.unknownCategories).toEqual([
      { category: "unknown", rows: [2] },
    ]);
    expect(database.from).toHaveBeenCalledWith("categories");
  });
});

// Capture the actual upsert payloads while forbidding production/network access.
function importDatabase(existing: any[] = [], lookupError?: string) {
  const writes: any[] = [];
  database.from.mockImplementation((table: string) => ({
    select: () => ({
      order: async () => ({
        data: table === "categories" ? [{ id: "cat", name: "Test" }] : existing,
        error: null,
      }),
      in: async () => ({
        data: existing,
        error: lookupError ? { message: lookupError } : null,
      }),
      eq: () => ({
        maybeSingle: async () => ({
          data: { id: table === "product_masters" ? "master" : "cat" },
          error: null,
        }),
      }),
    }),
    upsert: (payload: any) => {
      writes.push(...(Array.isArray(payload) ? payload : [payload]));
      return {
        select: () => ({
          then: (resolve: any) =>
            resolve({
              data: payload.map((p: any) => ({ id: "product", sku: p.sku })),
              error: null,
            }),
          single: async () => ({ data: { id: "product" }, error: null }),
        }),
      };
    },
    insert: (payload: any) => {
      if (table !== "import_logs")
        throw new Error(`Unexpected insert ${table}`);
      return Promise.resolve({ error: null });
    },
  }));
  return writes;
}

describe("ordering fields at the product write boundary", () => {
  it("keeps new products draft even when a sheet asks to publish", async () => {
    const writes = importDatabase();
    const { rows } = await parseCSV(
      "name,unit,sku,status,master_name\nNew,box,TEST-NEW,published,\nVariant,box,TEST-VARIANT,published,Example only" as unknown as File
    );
    await bulkImportProducts(rows);
    expect(writes).toHaveLength(2);
    expect(writes.every(row => row.status === "draft")).toBe(true);
  });
  it("persists standalone and variant rules with unchanged selling-unit prices", async () => {
    const writes = importDatabase();
    const { rows } = await parseCSV(
      "name,unit,sku,price,quantity_in_unit,order_unit,order_step,moq,master_name,variant_label\nStandalone,box,TEST-1,150,100,pcs,300,2,,\nVariant,box,TEST-2,200,100,pack,200,3,Example only,Small" as unknown as File
    );
    const result = await bulkImportProducts(rows);
    expect(result.errors).toEqual([]);
    expect(result.added).toBe(2);
    expect(writes[0]).toMatchObject({
      sku: "TEST-1",
      quantity_in_unit: 100,
      order_unit: "pcs",
      order_step: 300,
      moq: 2,
      price: 150,
    });
    expect(writes[1]).toMatchObject({
      sku: "TEST-2",
      master_id: "master",
      order_unit: "pack",
      order_step: 200,
      moq: 3,
      price: 200,
    });
    expect(
      writes.every(
        p =>
          !Object.hasOwn(p, "pack_size") &&
          !Object.hasOwn(p, "quantity_in_unit_provided") &&
          p.status === "draft"
      )
    ).toBe(true);
  });

  it("preserves blank existing ordering fields in a mixed batch while defaulting new rows", async () => {
    const writes = importDatabase([
      {
        sku: "TEST-OLD",
        quantity_in_unit: 100,
        order_unit: "pcs",
        order_step: 300,
        status: "published",
      },
    ]);
    const { rows } = await parseCSV(
      "name,unit,sku,price\nExisting,box,TEST-OLD,150\nNew,pack,TEST-NEW,20" as unknown as File
    );
    const result = await bulkImportProducts(rows);
    expect(result.errors).toEqual([]);
    expect(result.updated).toBe(1);
    expect(result.added).toBe(1);
    expect(writes[0]).toMatchObject({
      quantity_in_unit: 100,
      order_unit: "pcs",
      order_step: 300,
      status: "published",
    });
    expect(writes[1]).toMatchObject({
      quantity_in_unit: 1,
      order_unit: "pack",
      order_step: null,
    });
  });

  it("preserves a derived-SKU variant's blank ordering fields", async () => {
    const writes = importDatabase([
      {
        sku: "example-only-SMALL",
        quantity_in_unit: 100,
        order_unit: "pcs",
        order_step: 300,
        status: "draft",
      },
    ]);
    const { rows } = await parseCSV(
      "name,unit,master_name,variant_label\nVariant,box,Example only,Small" as unknown as File
    );
    await bulkImportProducts(rows);
    expect(writes[0]).toMatchObject({
      sku: "example-only-SMALL",
      quantity_in_unit: 100,
      order_unit: "pcs",
      order_step: 300,
    });
  });

  it("rejects a pack-size change conflicting with preserved steps in dry-run and import", async () => {
    const writes = importDatabase([
      {
        sku: "TEST",
        quantity_in_unit: 100,
        order_unit: "pcs",
        order_step: 300,
      },
    ]);
    const { rows } = await parseCSV(
      "name,unit,sku,quantity_in_unit\nExample only,box,TEST,200" as unknown as File
    );
    const dryRun = await dryRunImport(rows);
    expect(dryRun.ready).toBe(false);
    expect(dryRun.validationErrors[0].error).toContain("whole multiple");
    const result = await bulkImportProducts(rows);
    expect(result.errors[0].error).toContain("whole multiple");
    expect(writes).toEqual([]);
  });

  it("fails closed without writing when existing settings cannot be read", async () => {
    const writes = importDatabase([], "Synthetic denied read");
    const { rows } = await parseCSV(
      "name,unit,sku\nExample only,box,TEST" as unknown as File
    );
    await expect(bulkImportProducts(rows)).rejects.toThrow(
      "Cannot verify existing ordering"
    );
    expect(writes).toEqual([]);
    expect(database.from).toHaveBeenCalledTimes(1);
  });

  it("exports and re-imports customer ordering fields without price conversion", async () => {
    importDatabase([
      {
        name: "Example only",
        sku: "TEST",
        unit_of_measure: "box",
        quantity_in_unit: 100,
        order_unit: "pcs",
        order_step: 300,
        moq: 2,
        price: 150,
      },
    ]);
    let captured: Blob | undefined;
    vi.stubGlobal("document", {
      createElement: () => ({
        setAttribute: vi.fn(),
        style: {},
        click: vi.fn(),
      }),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    });
    const url = vi.spyOn(URL, "createObjectURL").mockImplementation(blob => {
      captured = blob as Blob;
      return "blob:fixture";
    });
    try {
      await exportProductsAsCSV();
      const parsed = await parseCSV(
        (await captured!.text()) as unknown as File
      );
      expect(parsed.errors).toEqual([]);
      expect(parsed.rows[0]).toMatchObject({
        order_unit: "pcs",
        order_step: 300,
        moq: 2,
        quantity_in_unit: 100,
        price: 150,
      });
    } finally {
      url.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
