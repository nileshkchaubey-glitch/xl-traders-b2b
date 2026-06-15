import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from './supabase';

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
  if (!row.unit || typeof row.unit !== 'string' || !row.unit.trim()) {
    throw new Error('Missing or invalid unit');
  }
  // Price is optional — blank/missing rows import with null price
  const rawPrice = row.price !== undefined && row.price !== null && String(row.price).trim() !== ''
    ? parseFloat(row.price)
    : null;
  if (rawPrice !== null && (isNaN(rawPrice) || rawPrice < 0)) {
    throw new Error('Invalid price — must be a positive number or left blank');
  }
  const quantity = parseFloat(row.quantity_in_unit);
  if (isNaN(quantity) || quantity <= 0) {
    throw new Error('Invalid quantity_in_unit — must be a positive number');
  }
  // Category: blank/missing rows map to 'uncategorized' (resolved at import time)
  const category = (row.category && typeof row.category === 'string' && row.category.trim())
    ? row.category.trim()
    : 'uncategorized';
  return {
    master_name: row.master_name ? String(row.master_name).trim() : undefined,
    variant_label: row.variant_label ? String(row.variant_label).trim() : undefined,
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
    is_featured: row.is_featured === 'true' || row.is_featured === true || row.is_featured === 1,
  };
}

function collectImageUrls(row: ImportRow): string[] {
  return [row.image_url_1, row.image_url_2, row.image_url_3, row.image_url_4, row.image_url_5]
    .filter((u): u is string => !!u);
}

async function saveProductImages(productId: string, imageUrls: string[], productName: string): Promise<void> {
  if (!imageUrls.length) return;

  await supabase.from('product_images').delete().eq('product_id', productId);

  const imageRows = imageUrls.map((url, i) => ({
    product_id: productId,
    image_url: url,
    alt_text: productName,
    display_order: i + 1,
  }));

  const { error } = await supabase.from('product_images').insert(imageRows);
  if (error) console.warn('Failed to save product images:', error.message);

  await supabase.from('products').update({ image_url: imageUrls[0] }).eq('id', productId);
}

async function getOrCreateCategory(categoryName: string): Promise<string | null> {
  const name = categoryName.trim();
  // Blank or explicit 'uncategorized' → resolve the Uncategorized category,
  // self-healing if it is missing so blank-category rows never fail. Looked up
  // by slug with no is_active filter (it may be inactive).
  if (!name || name.toLowerCase() === 'uncategorized') {
    const { data } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'uncategorized')
      .maybeSingle();
    if (data?.id) return data.id;
    const { data: created, error } = await supabase
      .from('categories')
      .insert({
        name: 'Uncategorized',
        slug: 'uncategorized',
        description: 'Products without a category',
        display_order: 999,
        is_active: true,
      })
      .select('id')
      .single();
    if (error) { console.error('Error creating Uncategorized category:', error); return null; }
    return created?.id ?? null;
  }
  try {
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .ilike('name', name)
      .maybeSingle();
    if (existing) return existing.id;
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const { data: created, error } = await supabase
      .from('categories')
      .insert({ name, slug, description: `${name} products`, display_order: 999 })
      .select('id')
      .single();
    if (error) { console.error('Error creating category:', error); return null; }
    return created?.id || null;
  } catch (error) {
    console.error('Error in getOrCreateCategory:', error);
    return null;
  }
}

function generateSku(): string {
  return `IMP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
}

export async function bulkImportProducts(
  rows: ImportRow[],
  source: string = 'csv',
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = { added: 0, updated: 0, skipped: 0, errors: [], summary: '' };
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

      const imageUrls = collectImageUrls(row);

      // Check if it is a variant
      if (row.master_name && row.master_name.trim() !== '') {
        const masterName = row.master_name.trim();
        
        // 1. Find or create master
        const { data: existingMaster } = await supabase
          .from('product_masters')
          .select('id')
          .eq('name', masterName)
          .maybeSingle();

        let masterId = existingMaster?.id;

        if (!masterId) {
          const masterSlug = masterName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
          const { data: newMaster, error: masterErr } = await supabase
            .from('product_masters')
            .insert({
              name: masterName,
              slug: masterSlug,
              category_id: categoryId,
              brand: row.brand || null,
              description: row.description || null,
              is_active: true,
            })
            .select('id')
            .single();
          
          if (masterErr) {
            result.errors.push({ row: rowNumber, error: `Failed to create master "${masterName}": ${masterErr.message}` });
            continue;
          }
          masterId = newMaster.id;
        }

        // 2. Resolve variant details
        const variantLabel = row.variant_label || '';
        const name = `${masterName} ${variantLabel}`.trim();
        
        let existingVariant: { id: string } | null = null;
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
          existingVariant = data;
        }

        if (!existingVariant) {
          const { data } = await supabase
            .from('products')
            .select('id')
            .ilike('name', name)
            .maybeSingle();
          existingVariant = data;
        }

        if (existingVariant) {
          // UPDATE VARIANT
          const { error } = await supabase
            .from('products')
            .update({
              master_id: masterId,
              variant_label: variantLabel,
              name,
              category_id: categoryId,
              price: row.price,
              mrp: row.mrp,
              unit_of_measure: row.unit,
              quantity_in_unit: row.quantity_in_unit,
              description: row.description,
              brand: row.brand,
              barcode: row.barcode,
              moq: row.moq ?? null,
              is_featured: row.is_featured || false,
              ...(row.sku ? { sku: row.sku } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingVariant.id);

          if (error) {
            result.errors.push({ row: rowNumber, error: `Update failed: ${error.message}` });
          } else {
            result.updated++;
            await saveProductImages(existingVariant.id, imageUrls, name);
          }
        } else {
          // INSERT VARIANT
          const sku = row.sku || `${masterName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${variantLabel.replace(/\s+/g, '-').toUpperCase()}`;
          const { data: inserted, error } = await supabase
            .from('products')
            .insert({
              master_id: masterId,
              variant_label: variantLabel,
              name,
              category_id: categoryId,
              sku,
              barcode: row.barcode,
              moq: row.moq ?? null,
              price: row.price,
              mrp: row.mrp,
              unit_of_measure: row.unit,
              quantity_in_unit: row.quantity_in_unit,
              description: row.description,
              brand: row.brand,
              is_featured: row.is_featured || false,
              is_active: true,
              status: 'draft',
            })
            .select('id')
            .single();

          if (error) {
            result.errors.push({ row: rowNumber, error: `Insert failed: ${error.message}` });
          } else {
            result.added++;
            if (inserted?.id) await saveProductImages(inserted.id, imageUrls, name);
          }
        }
      } else {
        // STANDALONE product (existing logic)
        let existing: { id: string } | null = null;

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

        if (!existing) {
          const { data } = await supabase
            .from('products')
            .select('id')
            .ilike('name', row.name)
            .maybeSingle();
          existing = data;
        }

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
              moq: row.moq ?? null,
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
              moq: row.moq ?? null,
              price: row.price,
              mrp: row.mrp,
              unit_of_measure: row.unit,
              quantity_in_unit: row.quantity_in_unit,
              description: row.description,
              brand: row.brand,
              is_featured: row.is_featured || false,
              is_active: true,
              status: 'draft',
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
      }
    } catch (error) {
      result.errors.push({ row: rowNumber, error: error instanceof Error ? error.message : 'Unknown error' });
    }

    onProgress?.(i + 1, rows.length);
  }

  result.summary = `✅ Added: ${result.added} | 🔄 Updated: ${result.updated} | ⏭ Skipped: ${result.skipped} | ❌ Errors: ${result.errors.length}`;

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
      .select('name, categories(name), sku, barcode, moq, price, mrp, unit_of_measure, quantity_in_unit, description, brand, is_featured, product_masters(name), variant_label')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!products) throw new Error('No products found');

    const csvData = products.map((p: any) => ({
      master_name: p.product_masters?.name || '',
      variant_label: p.variant_label || '',
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
      master_name: 'Hinged Box',
      variant_label: '250ml',
      name: 'Hinged Box 250ml',
      category: 'Aluminum Containers',
      sku: 'HNG-250ML',
      barcode: '',
      moq: '100',
      price: '100.00',
      mrp: '150.00',
      unit: 'pcs',
      quantity_in_unit: '100',
      description: 'Premium hinged packaging box',
      brand: 'XL Traders',
      is_featured: 'false',
    },
    {
      master_name: 'Hinged Box',
      variant_label: '500ml',
      name: 'Hinged Box 500ml',
      category: 'Aluminum Containers',
      sku: 'HNG-500ML',
      barcode: '',
      moq: '100',
      price: '150.00',
      mrp: '200.00',
      unit: 'pcs',
      quantity_in_unit: '100',
      description: 'Premium hinged packaging box',
      brand: 'XL Traders',
      is_featured: 'true',
    },
    {
      master_name: '',
      variant_label: '',
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
