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
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
  /** Category names in the file that matched no existing category — routed to Uncategorized. */
  unknownCategories: string[];
  summary: string;
}

export interface ParsedFile {
  rows: ImportRow[];
  errors: string[];
}

/** Pre-commit dry-run findings derived purely from the file (no DB access). */
export interface ImportValidation {
  /** SKUs that appear on more than one row (only the first occurrence is imported). */
  duplicateSkus: string[];
  /** Rows that carry a variant_label but no master_name (orphan variants). */
  orphanVariants: Array<{ row: number; name: string }>;
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
  // Price is optional — blank/missing rows import with null price
  const rawPrice =
    row.price !== undefined &&
    row.price !== null &&
    String(row.price).trim() !== ""
      ? parseFloat(row.price)
      : null;
  if (rawPrice !== null && (isNaN(rawPrice) || rawPrice < 0)) {
    throw new Error("Invalid price — must be a positive number or left blank");
  }
  const quantity = parseFloat(row.quantity_in_unit);
  if (isNaN(quantity) || quantity <= 0) {
    throw new Error("Invalid quantity_in_unit — must be a positive number");
  }
  // Category: blank/missing rows map to 'uncategorized' (resolved at import time)
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
    moq: row.moq ? parseInt(row.moq) : null,
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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}

function generateSku(): string {
  return `IMP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

/**
 * Pre-commit dry-run validation derived purely from the parsed file — no DB
 * access. Surfaces duplicate SKUs (only the first wins on import) and orphan
 * variants (variant_label without a master_name). Unknown-category detection
 * needs the live category list and is reported by bulkImportProducts instead.
 */
export function validateImportRows(rows: ImportRow[]): ImportValidation {
  const skuCounts = new Map<string, number>();
  const orphanVariants: ImportValidation["orphanVariants"] = [];
  rows.forEach((row, i) => {
    if (row.sku) skuCounts.set(row.sku, (skuCounts.get(row.sku) ?? 0) + 1);
    const hasMaster = !!row.master_name && row.master_name.trim() !== "";
    const hasLabel = !!row.variant_label && row.variant_label.trim() !== "";
    if (hasLabel && !hasMaster) {
      orphanVariants.push({ row: i + 2, name: row.name });
    }
  });
  const duplicateSkus = Array.from(skuCounts.entries())
    .filter(([, n]) => n > 1)
    .map(([sku]) => sku);
  return { duplicateSkus, orphanVariants };
}

/**
 * Resolve every distinct category name in the file to an id in one pass.
 * Unknown names are routed to the Uncategorized sentinel and collected for the
 * report — categories are NOT auto-created any more. Returns a lookup keyed by
 * lower-cased category string.
 */
async function resolveCategories(rows: ImportRow[]): Promise<{
  lookup: Map<string, string>;
  sentinelId: string | null;
  unknown: string[];
}> {
  const { data: cats } = await supabase
    .from("categories")
    .select("id, name, slug");
  const byName = new Map<string, string>();
  const bySlug = new Map<string, string>();
  let sentinelId: string | null = null;
  (cats ?? []).forEach((c: any) => {
    byName.set(c.name.trim().toLowerCase(), c.id);
    if (c.slug) bySlug.set(c.slug.toLowerCase(), c.id);
    if (c.slug === "uncategorized") sentinelId = c.id;
  });

  // Self-heal the sentinel if it has somehow gone missing (kept inactive, per
  // CLAUDE.md — the Uncategorized sentinel is is_active=false).
  if (!sentinelId) {
    const { data: created } = await supabase
      .from("categories")
      .insert({
        name: "Uncategorized",
        slug: "uncategorized",
        description: "Products without a category",
        display_order: 999,
        is_active: false,
      })
      .select("id")
      .single();
    sentinelId = created?.id ?? null;
  }

  const lookup = new Map<string, string>();
  const unknown = new Set<string>();
  const uniqueNames = new Set(rows.map(r => (r.category || "").trim()));
  uniqueNames.forEach(name => {
    const key = name.toLowerCase();
    if (!name || key === "uncategorized") {
      if (sentinelId) lookup.set(key, sentinelId);
      return;
    }
    const hit = byName.get(key) ?? bySlug.get(slugify(name));
    if (hit) {
      lookup.set(key, hit);
    } else {
      if (sentinelId) lookup.set(key, sentinelId);
      unknown.add(name);
    }
  });

  return { lookup, sentinelId, unknown: Array.from(unknown) };
}

/**
 * Resolve every distinct master_name referenced by variant rows to an id,
 * creating masters that do not yet exist. Returns a lookup keyed by lower-cased
 * master name plus the names whose creation failed (their rows are errored out).
 */
async function resolveMasters(
  rows: ImportRow[],
  categoryLookup: Map<string, string>,
  sentinelId: string | null
): Promise<{ lookup: Map<string, string>; failed: Map<string, string> }> {
  const lookup = new Map<string, string>();
  const failed = new Map<string, string>();
  const names = Array.from(
    new Set(
      rows.map(r => r.master_name?.trim()).filter((n): n is string => !!n)
    )
  );
  if (!names.length) return { lookup, failed };

  const { data: existing } = await supabase
    .from("product_masters")
    .select("id, name")
    .in("name", names);
  (existing ?? []).forEach((m: any) => lookup.set(m.name.toLowerCase(), m.id));

  for (const name of names) {
    if (lookup.has(name.toLowerCase())) continue;
    const sample = rows.find(r => r.master_name?.trim() === name);
    const categoryId =
      categoryLookup.get((sample?.category || "").trim().toLowerCase()) ??
      sentinelId;
    const { data: created, error } = await supabase
      .from("product_masters")
      .insert({
        name,
        slug: slugify(name),
        category_id: categoryId,
        brand: sample?.brand || null,
        description: sample?.description || null,
        is_active: true,
      })
      .select("id")
      .single();
    if (error || !created) {
      failed.set(name.toLowerCase(), error?.message ?? "unknown error");
    } else {
      lookup.set(name.toLowerCase(), created.id);
    }
  }

  return { lookup, failed };
}

interface PreparedRow {
  rowNumber: number;
  sku: string;
  name: string;
  imageUrls: string[];
  payload: Record<string, any>;
}

/**
 * Bulk import products by SKU-respecting upsert.
 *
 * Categories and masters are resolved up front in batch passes; each product
 * row is then turned into a payload and written with a single
 * `.upsert(onConflict: 'sku')` (chunked), replacing the old per-row
 * read-then-write with its dangerous name-fallback matching. status/is_active
 * are intentionally omitted so new rows take the DB defaults (draft / active)
 * while existing rows preserve their current values on conflict.
 */
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
    unknownCategories: [],
    summary: "",
  };
  const total = rows.length;
  if (!total) {
    result.summary = "No rows to import";
    return result;
  }

  // --- Pre-commit resolution + validation -------------------------------
  const { lookup: categoryLookup, sentinelId } = await resolveCategories(rows);
  const { lookup: masterLookup, failed: failedMasters } = await resolveMasters(
    rows,
    categoryLookup,
    sentinelId
  );

  const prepared: PreparedRow[] = [];
  const seenSkus = new Set<string>();
  const usedUnknownCategories = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const categoryKey = (row.category || "").trim().toLowerCase();
    const categoryId = categoryLookup.get(categoryKey) ?? sentinelId;
    if (!categoryId) {
      result.errors.push({
        row: rowNumber,
        error: "Failed to resolve category",
      });
      continue;
    }
    if (
      categoryKey &&
      categoryKey !== "uncategorized" &&
      categoryId === sentinelId
    ) {
      usedUnknownCategories.add(row.category.trim());
    }

    const isVariant = !!row.master_name && row.master_name.trim() !== "";
    let masterId: string | null = null;
    let name = row.name;
    let variantLabel: string | null = null;

    if (isVariant) {
      const masterName = row.master_name!.trim();
      const failMsg = failedMasters.get(masterName.toLowerCase());
      if (failMsg) {
        result.errors.push({
          row: rowNumber,
          error: `Failed to resolve master "${masterName}": ${failMsg}`,
        });
        continue;
      }
      masterId = masterLookup.get(masterName.toLowerCase()) ?? null;
      variantLabel = row.variant_label || "";
      name = `${masterName} ${variantLabel}`.trim();
    }

    // Respect a provided SKU; otherwise generate. Variants get a deterministic
    // master-label SKU so re-importing the same variant updates in place;
    // standalones get a unique IMP- SKU (always a fresh insert).
    const sku =
      row.sku ||
      (isVariant
        ? `${(row.master_name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${(variantLabel || "").replace(/\s+/g, "-").toUpperCase()}`
        : generateSku());

    if (seenSkus.has(sku)) {
      result.skipped++;
      result.errors.push({
        row: rowNumber,
        error: `Duplicate SKU in file: ${sku}`,
      });
      continue;
    }
    seenSkus.add(sku);

    prepared.push({
      rowNumber,
      sku,
      name,
      imageUrls: collectImageUrls(row),
      // NOTE: identical key set across every payload (required by the bulk
      // upsert); status/is_active/slug are omitted so DB defaults apply on
      // insert and existing values are preserved on conflict.
      payload: {
        name,
        category_id: categoryId,
        master_id: masterId,
        variant_label: variantLabel,
        sku,
        barcode: row.barcode ?? null,
        moq: row.moq ?? null,
        price: row.price ?? null,
        mrp: row.mrp ?? null,
        unit_of_measure: row.unit,
        quantity_in_unit: row.quantity_in_unit,
        description: row.description ?? null,
        brand: row.brand ?? null,
        is_featured: row.is_featured || false,
        updated_at: new Date().toISOString(),
      },
    });
  }

  result.unknownCategories = Array.from(usedUnknownCategories);

  // --- Classify added vs updated (one bulk read of existing SKUs) --------
  const existingSkus = new Set<string>();
  for (const skuChunk of chunk(
    prepared.map(p => p.sku),
    200
  )) {
    const { data } = await supabase
      .from("products")
      .select("sku")
      .in("sku", skuChunk);
    (data ?? []).forEach((p: any) => existingSkus.add(p.sku));
  }

  // --- Bulk upsert (chunked, with per-row fallback on chunk failure) -----
  const idBySku = new Map<string, string>();
  let processed = 0;
  for (const group of chunk(prepared, 200)) {
    const { data, error } = await supabase
      .from("products")
      .upsert(
        group.map(p => p.payload),
        { onConflict: "sku" }
      )
      .select("id, sku");

    if (error) {
      // Isolate the offending row(s): retry this chunk one row at a time so a
      // single bad row doesn't sink the whole batch.
      for (const p of group) {
        const { data: one, error: oneErr } = await supabase
          .from("products")
          .upsert(p.payload, { onConflict: "sku" })
          .select("id, sku")
          .single();
        if (oneErr || !one) {
          result.errors.push({
            row: p.rowNumber,
            error: `Upsert failed: ${oneErr?.message ?? "unknown error"}`,
          });
        } else {
          idBySku.set(one.sku, one.id);
          if (existingSkus.has(one.sku)) result.updated++;
          else result.added++;
        }
      }
    } else {
      (data ?? []).forEach((p: any) => idBySku.set(p.sku, p.id));
      group.forEach(p => {
        if (idBySku.has(p.sku)) {
          if (existingSkus.has(p.sku)) result.updated++;
          else result.added++;
        }
      });
    }
    processed += group.length;
    onProgress?.(Math.min(processed, total), total);
  }

  // --- Save images for rows that carry them (needs the resolved ids) -----
  for (const p of prepared) {
    if (!p.imageUrls.length) continue;
    const id = idBySku.get(p.sku);
    if (id) await saveProductImages(id, p.imageUrls, p.name);
  }

  const unknownNote = result.unknownCategories.length
    ? ` | ⚠️ Unknown categories → Uncategorized: ${result.unknownCategories.length}`
    : "";
  result.summary = `✅ Added: ${result.added} | 🔄 Updated: ${result.updated} | ⏭ Skipped: ${result.skipped} | ❌ Errors: ${result.errors.length}${unknownNote}`;

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
