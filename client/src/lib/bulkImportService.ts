import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from './supabase';

export interface ImportRow {
  name: string;
  category: string;
  group?: string;
  sku?: string;
  barcode?: string;
  moq?: number;
  price: number;
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
  summary: string;
}

export interface ParsedFile {
  rows: ImportRow[];
  errors: string[];
}

export async function parseCSV(file: File): Promise<ParsedFile> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (results) => {
        const errors: string[] = [];
        const rows: ImportRow[] = [];
        results.data.forEach((row: any, index: number) => {
          try {
            const parsed = validateAndParseRow(row, index + 2);
            if (parsed) rows.push(parsed);
          } catch (error) {
            errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        });
        resolve({ rows, errors });
      },
      error: (error) => {
        resolve({ rows: [], errors: [`CSV Parse Error: ${error.message}`] });
      },
    });
  });
}

export async function parseExcel(file: File): Promise<ParsedFile> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[];
        const errors: string[] = [];
        const rows: ImportRow[] = [];
        jsonData.forEach((row, index) => {
          try {
            const parsed = validateAndParseRow(row, index + 2);
            if (parsed) rows.push(parsed);
          } catch (error) {
            errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        });
        resolve({ rows, errors });
      } catch (error) {
        resolve({ rows: [], errors: [`Excel Parse Error: ${error instanceof Error ? error.message : 'Unknown error'}`] });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function validateAndParseRow(row: any, _rowNumber: number): ImportRow | null {
  if (!row.name || typeof row.name !== 'string' || !row.name.trim()) {
    throw new Error('Missing or invalid product name');
  }
  if (!row.category || typeof row.category !== 'string' || !row.category.trim()) {
    throw new Error('Missing or invalid category');
  }
  if (!row.unit || typeof row.unit !== 'string' || !row.unit.trim()) {
    throw new Error('Missing or invalid unit');
  }
  const price = parseFloat(row.price);
  if (isNaN(price) || price < 0) {
    throw new Error('Invalid price — must be a positive number');
  }
  const quantity = parseFloat(row.quantity_in_unit);
  if (isNaN(quantity) || quantity <= 0) {
    throw new Error('Invalid quantity_in_unit — must be a positive number');
  }
  return {
    name: row.name.trim(),
    category: row.category.trim(),
    group: row.group ? row.group.trim() : undefined,
    sku: row.sku ? row.sku.trim() : undefined,
    barcode: row.barcode ? row.barcode.trim() : undefined,
    moq: row.moq ? parseInt(row.moq) : undefined,
    price,
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
    is_featured: row.is_featured === 'true' || row.is_featured === true || row.is_featured === 1,
  };
}

// Collect the up-to-5 image URLs from a parsed row (skips empty strings).
function collectImageUrls(row: ImportRow): string[] {
  return [row.image_url_1, row.image_url_2, row.image_url_3, row.image_url_4, row.image_url_5]
    .filter((u): u is string => !!u);
}

/**
 * Write image URLs to product_images (display_order 1-5).
 * Clears all existing product_images rows for this product first so a
 * re-import with fewer images doesn't leave stale entries.
 * Also sets products.image_url to the first URL (primary image).
 */
async function saveProductImages(productId: string, imageUrls: string[], productName: string): Promise<void> {
  if (!imageUrls.length) return;

  // Remove existing images for this product then re-insert
  await supabase.from('product_images').delete().eq('product_id', productId);

  const imageRows = imageUrls.map((url, i) => ({
    product_id: productId,
    image_url: url,
    alt_text: productName,
    display_order: i + 1,
  }));

  const { error } = await supabase.from('product_images').insert(imageRows);
  if (error) console.warn('Failed to save product images:', error.message);

  // First image becomes the product's primary image_url
  await supabase.from('products').update({ image_url: imageUrls[0] }).eq('id', productId);
}

async function getOrCreateCategory(categoryName: string): Promise<string | null> {
  try {
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .ilike('name', categoryName)
      .single();
    if (existing) return existing.id;
    const slug = categoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const { data: created, error } = await supabase
      .from('categories')
      .insert({ name: categoryName, slug, description: `${categoryName} products`, display_order: 999 })
      .select('id')
      .single();
    if (error) { console.error('Error creating category:', error); return null; }
    return created?.id || null;
  } catch (error) {
    console.error('Error in getOrCreateCategory:', error);
    return null;
  }
}

/** Generate a unique SKU if the row doesn't have one */
function generateSku(): string {
  return `IMP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
}

/**
 * Bulk import/update products.
 * Matching priority: SKU first → name fallback.
 * Writes results to import_logs table.
 */
export async function bulkImportProducts(
  rows: ImportRow[],
  source: string = 'csv',
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = { added: 0, updated: 0, skipped: 0, errors: [], summary: '' };

  // Track SKUs seen in this batch to catch duplicates within the sheet
  const seenSkus = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;

    try {
      const categoryId = await getOrCreateCategory(row.category);
      if (!categoryId) {
        result.errors.push({ row: rowNumber, error: 'Failed to get or create category' });
        continue;
      }

      let existing: { id: string } | null = null;

      // 1. Match by SKU first (if provided)
      if (row.sku) {
        if (seenSkus.has(row.sku)) {
          result.skipped++;
          result.errors.push({ row: rowNumber, error: `Duplicate SKU in sheet: ${row.sku}` });
          continue;
        }
        seenSkus.add(row.sku);

        const { data } = await supabase
          .from('products')
          .select('id')
          .eq('sku', row.sku)
          .maybeSingle();
        existing = data;
      }

      // 2. Fall back to name match
      if (!existing) {
        const { data } = await supabase
          .from('products')
          .select('id')
          .ilike('name', row.name)
          .maybeSingle();
        existing = data;
      }

      const imageUrls = collectImageUrls(row);

      if (existing) {
        // UPDATE
        const { error } = await supabase
          .from('products')
          .update({
            category_id: categoryId,
            price: row.price,
            mrp: row.mrp,
            unit_of_measure: row.unit,
            quantity_in_unit: row.quantity_in_unit,
            description: row.description,
            brand: row.brand,
            barcode: row.barcode,
            moq: row.moq ?? 1,
            is_featured: row.is_featured || false,
            ...(row.sku ? { sku: row.sku } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) {
          result.errors.push({ row: rowNumber, error: `Update failed: ${error.message}` });
        } else {
          result.updated++;
          await saveProductImages(existing.id, imageUrls, row.name);
        }
      } else {
        // INSERT
        const sku = row.sku || generateSku();
        const { data: inserted, error } = await supabase
          .from('products')
          .insert({
            name: row.name,
            category_id: categoryId,
            sku,
            barcode: row.barcode,
            moq: row.moq ?? 1,
            price: row.price,
            mrp: row.mrp,
            unit_of_measure: row.unit,
            quantity_in_unit: row.quantity_in_unit,
            description: row.description,
            brand: row.brand,
            is_featured: row.is_featured || false,
            is_active: true,
          })
          .select('id')
          .single();

        if (error) {
          result.errors.push({ row: rowNumber, error: `Insert failed: ${error.message}` });
        } else {
          result.added++;
          if (inserted?.id) await saveProductImages(inserted.id, imageUrls, row.name);
        }
      }
    } catch (error) {
      result.errors.push({ row: rowNumber, error: error instanceof Error ? error.message : 'Unknown error' });
    }

    onProgress?.(i + 1, rows.length);
  }

  result.summary = `✅ Added: ${result.added} | 🔄 Updated: ${result.updated} | ⏭ Skipped: ${result.skipped} | ❌ Errors: ${result.errors.length}`;

  // Write import log
  try {
    await supabase.from('import_logs').insert({
      source,
      rows_total: rows.length,
      inserted: result.added,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (logErr) {
    console.warn('Failed to write import log:', logErr);
  }

  return result;
}

export async function exportProductsAsCSV(): Promise<void> {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('name, categories(name), sku, barcode, moq, price, mrp, unit_of_measure, quantity_in_unit, description, brand, is_featured')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!products) throw new Error('No products found');

    const csvData = products.map((p: any) => ({
      name: p.name,
      category: p.categories?.name || '',
      sku: p.sku || '',
      barcode: p.barcode || '',
      moq: p.moq ?? 1,
      price: p.price,
      mrp: p.mrp || '',
      unit: p.unit_of_measure,
      quantity_in_unit: p.quantity_in_unit,
      description: p.description || '',
      brand: p.brand || '',
      is_featured: p.is_featured ? 'true' : 'false',
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `xl-traders-products-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error exporting products:', error);
    throw error;
  }
}

export function generateCSVTemplate(): void {
  const template = [
    {
      name: 'Product Name',
      category: 'Category Name',
      sku: 'CAT-0001',
      barcode: '',
      moq: '1',
      price: '100.00',
      mrp: '150.00',
      unit: 'piece',
      quantity_in_unit: '100',
      description: 'Product description',
      brand: 'Brand Name',
      is_featured: 'false',
    },
    {
      name: '5 Ply Corrugated Box - 12x10x8',
      category: 'Corrugated Boxes',
      sku: 'BOX-0001',
      barcode: '8901234567890',
      moq: '50',
      price: '3187.00',
      mrp: '3500.00',
      unit: 'box',
      quantity_in_unit: '100',
      description: 'Premium 5-ply corrugated boxes with excellent strength',
      brand: 'Fortune Plus',
      is_featured: 'true',
    },
  ];
  const csv = Papa.unparse(template);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'xl-traders-import-template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
