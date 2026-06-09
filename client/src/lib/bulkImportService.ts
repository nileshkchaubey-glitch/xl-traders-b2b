import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from './supabase';

export interface ImportRow {
  name: string;
  category: string;
  group?: string;
  price: number;
  mrp?: number;
  unit: string;
  quantity_in_unit: number;
  description?: string;
  brand?: string;
  is_featured?: boolean;
}

export interface ImportResult {
  added: number;
  updated: number;
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
    price,
    mrp: row.mrp ? parseFloat(row.mrp) : undefined,
    unit: row.unit.trim(),
    quantity_in_unit: quantity,
    description: row.description ? row.description.trim() : undefined,
    brand: row.brand ? row.brand.trim() : undefined,
    is_featured: row.is_featured === 'true' || row.is_featured === true || row.is_featured === 1,
  };
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

/**
 * Bulk import/update products.
 * @param rows Validated import rows.
 * @param onProgress Optional callback called after each row: (done, total) => void
 */
export async function bulkImportProducts(
  rows: ImportRow[],
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = { added: 0, updated: 0, errors: [], summary: '' };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;

    try {
      const categoryId = await getOrCreateCategory(row.category);
      if (!categoryId) {
        result.errors.push({ row: rowNumber, error: 'Failed to get or create category' });
        continue;
      }

      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .ilike('name', row.name)
        .single();

      if (existing) {
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
            is_featured: row.is_featured || false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) {
          result.errors.push({ row: rowNumber, error: `Update failed: ${error.message}` });
        } else {
          result.updated++;
        }
      } else {
        const sku = `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const { error } = await supabase
          .from('products')
          .insert({
            name: row.name,
            category_id: categoryId,
            sku,
            price: row.price,
            mrp: row.mrp,
            unit_of_measure: row.unit,
            quantity_in_unit: row.quantity_in_unit,
            description: row.description,
            brand: row.brand,
            is_featured: row.is_featured || false,
            is_active: true,
          });

        if (error) {
          result.errors.push({ row: rowNumber, error: `Insert failed: ${error.message}` });
        } else {
          result.added++;
        }
      }
    } catch (error) {
      result.errors.push({ row: rowNumber, error: error instanceof Error ? error.message : 'Unknown error' });
    }

    onProgress?.(i + 1, rows.length);
  }

  result.summary = `✅ Added: ${result.added} | 🔄 Updated: ${result.updated} | ❌ Errors: ${result.errors.length}`;
  return result;
}

export async function exportProductsAsCSV(): Promise<void> {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('name, categories(name), price, mrp, unit_of_measure, quantity_in_unit, description, brand, is_featured')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!products) throw new Error('No products found');

    const csvData = products.map((p: any) => ({
      name: p.name,
      category: p.categories?.name || '',
      group: '',
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
      group: 'Group (optional)',
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
      group: 'Boxes',
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
