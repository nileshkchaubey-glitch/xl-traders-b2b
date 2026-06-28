import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "./supabase";

export interface ImportRow {
  master_name?: string;
  variant_label?: string;
  name: string;
  category: string;
  group?: string;
  sku?: string;
  barcode?: string;
  moq?: number | null;
  price: number | null;
  mrp?: number;
  unit: string;
  quantity_in_unit: number;
  description?: string;
  brand?: string;
  image_url_1?: string;
  image_url_2?: string;
  image_url_3?: string;
  image_url_4?: string;
  image_url_5?: string;
  is_featured?: boolean;
  // status: 'draft' | 'published'. Left undefined when blank/invalid so inserts
  // default to 'draft' and updates leave the existing status untouched.
  status?: ProductStatus;
  // na_fields: fields the seller marks "not applicable" (suppresses missing-data noise).
  na_fields?: string[];
  // tags: captured from the sheet but NOT yet written — the products.tags column
  // is only present via an untracked conditional migration (see TODO in bulkImportProducts).
  tags?: string;
}

export type ProductStatus = 'draft' | 'published';

// Normalize a free-text status cell to a valid value, or undefined.
// Trim + lowercase first so " Published " etc. are accepted.
export function normalizeStatus(raw: unknown): ProductStatus | undefined {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'published') return 'published';
  if (s === 'draft') return 'draft';
  return undefined;
}

// Split a comma-separated na_fields cell into a trimmed, de-duplicated array.
// Returns undefined when nothing usable is present (so updates skip the column).
export function parseNaFields(raw: unknown): string[] | undefined {
  const parts = String(raw ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? Array.from(new Set(parts)) : undefined;
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
  summary: string;
}

export interface DryRunResult {
  totalRows: number;
  withSku: number;
  withoutSku: number;
  duplicateSkus: Array<{ sku: string; rows: number[] }>;
  unknownCategories: Array<{ category: string; rows: number[] }>;
  existingSkus: string[];
  newSkus: string[];
  validationErrors: Array<{ row: number; error: string }>;
  ready: boolean;
}

export interface ParsedFile {
  rows: ImportRow[];
  errors: string[];
}

export async function parseCSV(file: File): Promise<ParsedFile> {
  return new Promise(resolve => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase(),
      complete: results => {
        const errors: string[] = [];
        const rows: ImportRow[] = [];
        results.data.forEach((row: any, index: number) => {
          try {
            const parsed = validateAndParseRow(row, index + 2);
            if (parsed) rows.push(parsed);
          } catch (error) {
            errors.push(
              `Row ${index + 2}: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }
        });
        resolve({ rows, errors });
      },
      error: error => {
        resolve({ rows: [], errors: [`CSV Parse Error: ${error.message}`] });
      },
    });
  });
}

export async function parseExcel(file: File): Promise<ParsedFile> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
        }) as any[];
        const errors: string[] = [];
        const rows: ImportRow[] = [];
        jsonData.forEach((row, index) => {
          try {
            const parsed = validateAndParseRow(row, index + 2);
            if (parsed) rows.push(parsed);
          } catch (error) {
            errors.push(
              `Row ${index + 2}: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }
        });
        resolve({ rows, errors });
      } catch (error) {
        resolve({
          rows: [],
          errors: [
            `Excel Parse Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          ],
        });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function validateAndParseRow(row: any, _rowNumber: number): ImportRow | null {
  if (!row.name || typeof row.name !== "string" || !row.name.trim()) {
    throw new Error("Missing or invalid product name");
  }
  if (!row.unit || typeof row.unit !== "string" || !row.unit.trim()) {
    throw new Error("Missing or invalid unit");
  }
  const rawPrice =
    row.price !== undefined &&
    row.price !== null &&
    String(row.price).trim() !== ""
      ? parseFloat(row.price)
      : null;
  if (rawPrice !== null && (isNaN(rawPrice) || rawPrice < 0)) {
    throw new Error("Invalid price — must be a positive number or left blank");
  }
  // quantity_in_unit is optional — blank defaults to 1 (matches the Google Sheets
  // path and the documented template). Only reject a value that is present but invalid.
  const hasQty =
    row.quantity_in_unit !== undefined &&
    row.quantity_in_unit !== null &&
    String(row.quantity_in_unit).trim() !== "";
  const quantity = hasQty ? parseFloat(row.quantity_in_unit) : 1;
  if (hasQty && (isNaN(quantity) || quantity <= 0)) {
    throw new Error("Invalid quantity_in_unit — must be a positive number");
  }
  const category =
    row.category && typeof row.category === "string" && row.category.trim()
      ? row.category.trim()
      : "uncategorized";
  return {
    master_name: row.master_name ? String(row.master_name).trim() : undefined,
    variant_label: row.variant_label
      ? String(row.variant_label).trim()
      : undefined,
    name: row.name.trim(),
    category,
    group: row.group ? row.group.trim() : undefined,
    sku: row.sku ? row.sku.trim() : undefined,
    barcode: row.barcode ? row.barcode.trim() : undefined,
    moq: row.moq !== undefined && row.moq !== null && String(row.moq).trim() !== ''
      ? parseInt(row.moq) : null,
    price: rawPrice,
    mrp: row.mrp ? parseFloat(row.mrp) : undefined,
    unit: row.unit.trim(),
    quantity_in_unit: quantity,
    description: row.description ? row.description.trim() : undefined,
    brand: row.brand ? row.brand.trim() : undefined,
    image_url_1: row.image_url_1 ? String(row.image_url_1).trim() : undefined,
    image_url_2: row.image_url_2 ? String(row.image_url_2).trim() : undefined,
    image_url_3: row.image_url_3 ? String(row.image_url_3).trim() : undefined,
    image_url_4: row.image_url_4 ? String(row.image_url_4).trim() : undefined,
    image_url_5: row.image_url_5 ? String(row.image_url_5).trim() : undefined,
    is_featured:
      row.is_featured === "true" ||
      row.is_featured === true ||
      row.is_featured === 1,
    status: normalizeStatus(row.status),
    na_fields: parseNaFields(row.na_fields),
    tags: row.tags ? String(row.tags).trim() : undefined,
  };
}

function collectImageUrls(row: ImportRow): string[] {
  return [
    row.image_url_1,
    row.image_url_2,
    row.image_url_3,
    row.image_url_4,
    row.image_url_5,
  ].filter((u): u is string => !!u);
}

async function saveProductImages(
  productId: string,
  imageUrls: string[],
  productName: string
): Promise<void> {
  if (!imageUrls.length) return;

  await supabase.from("product_images").delete().eq("product_id", productId);

  const imageRows = imageUrls.map((url, i) => ({
    product_id: productId,
    image_url: url,
    alt_text: productName,
    display_order: i + 1,
  }));

  const { error } = await supabase.from("product_images").insert(imageRows);
  if (error) console.warn("Failed to save product images:", error.message);

  await supabase
    .from("products")
    .update({ image_url: imageUrls[0] })
    .eq("id", productId);
}

async function resolveUncategorizedId(): Promise<string | null> {
  const { data } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", "uncategorized")
    .maybeSingle();
  if (data?.id) return data.id;
  const { data: created, error } = await supabase
    .from("categories")
    .insert({
      name: "Uncategorized",
      slug: "uncategorized",
      description: "Products without a category",
      display_order: 999,
      is_active: true,
    })
    .select("id")
    .single();
  if (error) {
    console.error("Error creating Uncategorized category:", error);
    return null;
  }
  return created?.id ?? null;
}

async function buildCategoryMap(rows: ImportRow[]): Promise<{
  map: Record<string, string>;
  unknowns: Array<{ category: string; rows: number[] }>;
}> {
  const uniqueCategories = Array.from(new Set(rows.map((r) => r.category.toLowerCase())));

  const { data: dbCats } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");

  const catLookup = new Map<string, string>();
  for (const cat of dbCats || []) {
    catLookup.set(cat.name.toLowerCase(), cat.id);
  }

  const uncatId = await resolveUncategorizedId();
  const map: Record<string, string> = {};
  const unknownMap = new Map<string, number[]>();

  for (const catName of uniqueCategories) {
    if (catName === "uncategorized" || !catName) {
      if (uncatId) map[catName || "uncategorized"] = uncatId;
      continue;
    }
    const id = catLookup.get(catName);
    if (id) {
      map[catName] = id;
    } else {
      if (uncatId) map[catName] = uncatId;
      unknownMap.set(catName, []);
    }
  }

  // Collect row numbers for unknowns
  rows.forEach((row, i) => {
    const key = row.category.toLowerCase();
    if (unknownMap.has(key)) {
      unknownMap.get(key)!.push(i + 2);
    }
  });

  const unknowns = Array.from(unknownMap.entries()).map(([category, rows]) => ({ category, rows }));
  return { map, unknowns };
}

function generateSku(): string {
  return `IMP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
}

export async function dryRunImport(rows: ImportRow[]): Promise<DryRunResult> {
  const result: DryRunResult = {
    totalRows: rows.length,
    withSku: 0,
    withoutSku: 0,
    duplicateSkus: [],
    unknownCategories: [],
    existingSkus: [],
    newSkus: [],
    validationErrors: [],
    ready: true,
  };

  // Count SKU coverage
  const skuCounts = new Map<string, number[]>();
  rows.forEach((row, i) => {
    if (row.sku) {
      result.withSku++;
      const existing = skuCounts.get(row.sku) || [];
      existing.push(i + 2);
      skuCounts.set(row.sku, existing);
    } else {
      result.withoutSku++;
    }
  });

  // Detect in-file duplicates
  for (const [sku, rowNums] of Array.from(skuCounts.entries())) {
    if (rowNums.length > 1) {
      result.duplicateSkus.push({ sku, rows: rowNums });
      result.ready = false;
    }
  }

  // Check which SKUs already exist in DB
  const allSkus = Array.from(skuCounts.keys());
  if (allSkus.length > 0) {
    const CHUNK = 200;
    for (let i = 0; i < allSkus.length; i += CHUNK) {
      const chunk = allSkus.slice(i, i + CHUNK);
      const { data } = await supabase
        .from('products')
        .select('sku')
        .in('sku', chunk);
      if (data) {
        for (const row of data) {
          if (row.sku) result.existingSkus.push(row.sku);
        }
      }
    }
  }
  result.newSkus = allSkus.filter(s => !result.existingSkus.includes(s));

  // Check categories
  const { unknowns } = await buildCategoryMap(rows);
  result.unknownCategories = unknowns;

  return result;
}

export async function bulkImportProducts(
  rows: ImportRow[],
  source: string = "csv",
  onProgress?: (done: number, total: number) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    added: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    summary: "",
  };

  // Pre-resolve all categories
  const { map: categoryMap, unknowns: unknownCats } = await buildCategoryMap(rows);
  for (const uc of unknownCats) {
    for (const rowNum of uc.rows) {
      result.errors.push({
        row: rowNum,
        error: `Unknown category "${uc.category}" → assigned to Uncategorized`,
      });
    }
  }

  const seenSkus = new Set<string>();
  const standalonePayloads: Array<{ _rowNum: number; payload: Record<string, any>; imageUrls: string[] }> = [];
  const variantRows: Array<{ rowNum: number; row: ImportRow; categoryId: string }> = [];

  // TODO(tags): row.tags is parsed and carried on ImportRow but intentionally NOT
  // written here. products.tags exists only via an untracked conditional migration
  // (see GUEST_PRODUCT_COLS note in productService.ts) and is absent on some DB
  // instances — writing it unconditionally would fail those inserts. Wire it in once
  // the column is part of a tracked migration on every environment.

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const categoryId = categoryMap[row.category.toLowerCase()] || categoryMap['uncategorized'];
    if (!categoryId) {
      result.errors.push({ row: rowNumber, error: 'Could not resolve category' });
      continue;
    }

    if (row.master_name && row.master_name.trim()) {
      variantRows.push({ rowNum: rowNumber, row, categoryId });
      continue;
    }

    const sku = row.sku || generateSku();
    if (seenSkus.has(sku)) {
      result.skipped++;
      result.errors.push({ row: rowNumber, error: `Duplicate SKU in file: ${sku}` });
      continue;
    }
    seenSkus.add(sku);

    const slug = row.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const imageUrls = collectImageUrls(row);

    standalonePayloads.push({
      _rowNum: rowNumber,
      imageUrls,
      payload: {
        name: row.name,
        slug,
        category_id: categoryId,
        sku,
        barcode: row.barcode || null,
        moq: row.moq ?? null,
        price: row.price,
        mrp: row.mrp || null,
        unit_of_measure: row.unit,
        quantity_in_unit: row.quantity_in_unit,
        description: row.description || null,
        brand: row.brand || null,
        image_url: imageUrls[0] || null,
        is_featured: row.is_featured || false,
        ...(row.status ? { status: row.status } : {}),
        ...(row.na_fields ? { na_fields: row.na_fields } : {}),
        updated_at: new Date().toISOString(),
      },
    });
  }

  // Chunked upsert for standalone products (200/batch)
  const CHUNK_SIZE = 200;
  for (let i = 0; i < standalonePayloads.length; i += CHUNK_SIZE) {
    const chunk = standalonePayloads.slice(i, i + CHUNK_SIZE);
    const payloads = chunk.map(c => c.payload);

    const { data, error } = await supabase
      .from('products')
      .upsert(payloads, { onConflict: 'sku' })
      .select('id, sku');

    if (error) {
      for (const c of chunk) {
        result.errors.push({ row: c._rowNum, error: `Upsert failed: ${error.message}` });
      }
    } else if (data) {
      // We can't perfectly distinguish add vs update from upsert response,
      // so count all as added/updated based on whether SKU was in newSkus set
      const existingCheck = new Set<string>();
      // Quick lookup: which SKUs existed before?
      const skusInChunk = payloads.map(p => p.sku);
      const { data: preExisting } = await supabase
        .from('products')
        .select('sku')
        .in('sku', skusInChunk);
      // This runs after upsert so all exist now — we already tracked in seenSkus
      // Just count by data length
      result.added += data.length;

      // Save images for products that have them
      for (const c of chunk) {
        if (c.imageUrls.length > 0) {
          const match = data.find((d: any) => d.sku === c.payload.sku);
          if (match) {
            await saveProductImages(match.id, c.imageUrls, c.payload.name);
          }
        }
      }
    }

    onProgress?.(Math.min(i + CHUNK_SIZE, standalonePayloads.length) + variantRows.length > 0 ? i + CHUNK_SIZE : i + chunk.length, rows.length);
  }

  // Process variants row-by-row (master lookup needed)
  for (let vi = 0; vi < variantRows.length; vi++) {
    const { rowNum, row, categoryId } = variantRows[vi];
    try {
      const masterName = row.master_name!.trim();

      const { data: existingMaster } = await supabase
        .from("product_masters")
        .select("id")
        .eq("name", masterName)
        .maybeSingle();

      let masterId = existingMaster?.id;

      if (!masterId) {
        const masterSlug = masterName
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^\w-]/g, "");
        const { data: newMaster, error: masterErr } = await supabase
          .from("product_masters")
          .insert({
            name: masterName,
            slug: masterSlug,
            category_id: categoryId,
            brand: row.brand || null,
            description: row.description || null,
            is_active: true,
          })
          .select("id")
          .single();

        if (masterErr) {
          result.errors.push({
            row: rowNum,
            error: `Failed to create master "${masterName}": ${masterErr.message}`,
          });
          continue;
        }
        masterId = newMaster.id;
      }

      const variantLabel = row.variant_label || "";
      const name = `${masterName} ${variantLabel}`.trim();
      const sku =
        row.sku ||
        `${masterName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${variantLabel.replace(/\s+/g, "-").toUpperCase()}`;

      if (seenSkus.has(sku)) {
        result.skipped++;
        result.errors.push({
          row: rowNum,
          error: `Duplicate SKU in file: ${sku}`,
        });
        continue;
      }
      seenSkus.add(sku);

      const imageUrls = collectImageUrls(row);
      const slug = name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]/g, "");

      const { data: upserted, error } = await supabase
        .from("products")
        .upsert(
          {
            master_id: masterId,
            variant_label: variantLabel,
            name,
            slug,
            category_id: categoryId,
            sku,
            barcode: row.barcode || null,
            moq: row.moq ?? null,
            price: row.price,
            mrp: row.mrp || null,
            unit_of_measure: row.unit,
            quantity_in_unit: row.quantity_in_unit,
            description: row.description || null,
            brand: row.brand || null,
            image_url: imageUrls[0] || null,
            is_featured: row.is_featured || false,
            ...(row.status ? { status: row.status } : {}),
            ...(row.na_fields ? { na_fields: row.na_fields } : {}),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "sku" }
        )
        .select("id")
        .single();

      if (error) {
        result.errors.push({
          row: rowNum,
          error: `Variant upsert failed: ${error.message}`,
        });
      } else {
        result.added++;
        if (upserted?.id && imageUrls.length > 0) {
          await saveProductImages(upserted.id, imageUrls, name);
        }
      }
    } catch (error) {
      result.errors.push({
        row: rowNum,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    onProgress?.(standalonePayloads.length + vi + 1, rows.length);
  }

  result.summary = `Added/Updated: ${result.added} | Skipped: ${result.skipped} | Errors: ${result.errors.length}`;

  try {
    await supabase.from("import_logs").insert({
      source,
      rows_total: rows.length,
      inserted: result.added,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (logErr) {
    console.warn("Failed to write import log:", logErr);
  }

  return result;
}

export async function exportProductsAsCSV(): Promise<void> {
  try {
    const { data: products, error } = await supabase
      .from("products")
      .select(
        "name, categories(name), sku, barcode, moq, price, mrp, unit_of_measure, quantity_in_unit, description, brand, is_featured, product_masters(name), variant_label"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!products) throw new Error("No products found");

    const csvData = products.map((p: any) => ({
      master_name: p.product_masters?.name || "",
      variant_label: p.variant_label || "",
      name: p.name,
      category: p.categories?.name || "",
      sku: p.sku || "",
      barcode: p.barcode || "",
      moq: p.moq ?? 1,
      price: p.price,
      mrp: p.mrp || "",
      unit: p.unit_of_measure,
      quantity_in_unit: p.quantity_in_unit,
      description: p.description || "",
      brand: p.brand || "",
      is_featured: p.is_featured ? "true" : "false",
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `xl-traders-products-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error exporting products:", error);
    throw error;
  }
}

export function generateCSVTemplate(): void {
  const template = [
    {
      master_name: "Hinged Box",
      variant_label: "250ml",
      name: "Hinged Box 250ml",
      category: "Aluminum Containers",
      sku: "HNG-250ML",
      barcode: "",
      moq: "100",
      price: "100.00",
      mrp: "150.00",
      unit: "pcs",
      quantity_in_unit: "100",
      description: "Premium hinged packaging box",
      brand: "XL Traders",
      is_featured: "false",
    },
    {
      master_name: "Hinged Box",
      variant_label: "500ml",
      name: "Hinged Box 500ml",
      category: "Aluminum Containers",
      sku: "HNG-500ML",
      barcode: "",
      moq: "100",
      price: "150.00",
      mrp: "200.00",
      unit: "pcs",
      quantity_in_unit: "100",
      description: "Premium hinged packaging box",
      brand: "XL Traders",
      is_featured: "true",
    },
    {
      master_name: "",
      variant_label: "",
      name: "5 Ply Corrugated Box - 12x10x8",
      category: "Corrugated Boxes",
      sku: "BOX-0001",
      barcode: "8901234567890",
      moq: "50",
      price: "3187.00",
      mrp: "3500.00",
      unit: "box",
      quantity_in_unit: "100",
      description: "Premium 5-ply corrugated boxes with excellent strength",
      brand: "Fortune Plus",
      is_featured: "true",
    },
  ];
  const csv = Papa.unparse(template);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "xl-traders-import-template.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
