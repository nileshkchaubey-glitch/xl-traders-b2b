#!/usr/bin/env node

/**
 * XL Traders B2B - Import Products from Google Sheet to Supabase
 * 
 * This script:
 * 1. Fetches products from the Google Sheet CSV export
 * 2. Downloads images from Google Drive
 * 3. Uploads images to Supabase Storage
 * 4. Inserts/updates products in Supabase database
 * 5. Generates alt text and descriptions for SEO
 * 
 * Usage:
 *   npx ts-node scripts/import-from-sheet.ts
 * 
 * Environment variables required:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY (for admin access)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { parse } from 'csv-parse/sync';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1FEUf8vFpKmtK-hpnrc3DDoN93dBfOhI2Em8or-T7o6w/export?format=csv';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const STORAGE_BUCKET = 'product-images';
const TEMP_DIR = path.join(process.cwd(), '.import-temp');

// ============================================================================
// TYPES
// ============================================================================

interface SheetProduct {
  item_name: string;
  category: string;
  description: string;
  price: string;
  image_download_link: string;
  image_file_name: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Product {
  id?: string;
  name: string;
  category_id: string;
  description: string;
  price: number;
  unit_of_measure: string;
  image_url?: string;
  image_alt_text: string;
  image_description: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

const log = (message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warn: '\x1b[33m',
    reset: '\x1b[0m',
  };
  console.log(`${colors[type]}[${type.toUpperCase()}]${colors.reset} ${message}`);
};

const parsePrice = (priceStr: string): number => {
  // Remove ₹ and commas, then parse
  const cleaned = priceStr.replace(/₹|,/g, '').trim();
  return parseFloat(cleaned) || 0;
};

const generateAltText = (productName: string): string => {
  return `${productName} wholesale - XL Traders Surat`;
};

const generateDescription = (productName: string, category: string): string => {
  return `High-quality ${category.toLowerCase()} - ${productName}. Wholesale packaging solutions from XL Traders, Surat. Fast delivery, GST invoicing available.`;
};

const ensureTempDir = () => {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
};

const cleanupTempDir = () => {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
};

// ============================================================================
// FETCH SHEET DATA
// ============================================================================

const fetchSheetData = async (): Promise<SheetProduct[]> => {
  log('Fetching products from Google Sheet...', 'info');
  
  try {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const csvText = await response.text();
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
    }) as SheetProduct[];
    
    log(`✓ Fetched ${records.length} products from sheet`, 'success');
    return records;
  } catch (error) {
    log(`Failed to fetch sheet: ${error}`, 'error');
    throw error;
  }
};

// ============================================================================
// DOWNLOAD IMAGE FROM GOOGLE DRIVE
// ============================================================================

const downloadImage = async (downloadUrl: string, fileName: string): Promise<string> => {
  const filePath = path.join(TEMP_DIR, fileName);
  
  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const buffer = await response.buffer();
    fs.writeFileSync(filePath, buffer);
    
    return filePath;
  } catch (error) {
    log(`Failed to download image ${fileName}: ${error}`, 'warn');
    return '';
  }
};

// ============================================================================
// UPLOAD TO SUPABASE STORAGE
// ============================================================================

const uploadToSupabase = async (
  supabase: any,
  filePath: string,
  productId: string,
  fileName: string
): Promise<string> => {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const storagePath = `products/${productId}/${fileName}`;
    
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        cacheControl: '3600',
        upsert: true,
      });
    
    if (error) throw error;
    
    // Get public URL
    const { data } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);
    
    return data.publicUrl;
  } catch (error) {
    log(`Failed to upload image ${fileName}: ${error}`, 'warn');
    return '';
  }
};

// ============================================================================
// MAIN IMPORT LOGIC
// ============================================================================

const main = async () => {
  log('Starting XL Traders Product Import...', 'info');
  
  // Validate environment
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    log('Missing Supabase credentials in environment variables', 'error');
    process.exit(1);
  }
  
  // Initialize Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  // Setup
  ensureTempDir();
  
  try {
    // Step 1: Fetch sheet data
    const sheetProducts = await fetchSheetData();
    
    // Step 2: Get categories
    log('Fetching categories from database...', 'info');
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name, slug');
    
    if (catError) throw catError;
    
    const categoryMap = new Map(
      (categories as Category[]).map(c => [c.name, c.id])
    );
    
    log(`✓ Found ${categories?.length} categories`, 'success');
    
    // Step 3: Import products
    log(`Starting import of ${sheetProducts.length} products...`, 'info');
    
    let imported = 0;
    let skipped = 0;
    
    for (const sheetProduct of sheetProducts) {
      try {
        // Get category ID
        const categoryId = categoryMap.get(sheetProduct.category);
        if (!categoryId) {
          log(`Skipping "${sheetProduct.item_name}" - category not found`, 'warn');
          skipped++;
          continue;
        }
        
        // Parse price
        const price = parsePrice(sheetProduct.price);
        if (price === 0) {
          log(`Skipping "${sheetProduct.item_name}" - invalid price`, 'warn');
          skipped++;
          continue;
        }
        
        // Check if product exists
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('name', sheetProduct.item_name)
          .single();
        
        const productId = existing?.id || crypto.randomUUID();
        
        // Download image
        let imageUrl = '';
        if (sheetProduct.image_download_link) {
          log(`  Downloading image for "${sheetProduct.item_name}"...`, 'info');
          const localPath = await downloadImage(
            sheetProduct.image_download_link,
            sheetProduct.image_file_name
          );
          
          if (localPath) {
            imageUrl = await uploadToSupabase(
              supabase,
              localPath,
              productId,
              sheetProduct.image_file_name
            );
          }
        }
        
        // Prepare product data
        const product: Product = {
          id: productId,
          name: sheetProduct.item_name,
          category_id: categoryId,
          description: sheetProduct.description || generateDescription(sheetProduct.item_name, sheetProduct.category),
          price,
          unit_of_measure: 'pcs',
          image_url: imageUrl,
          image_alt_text: generateAltText(sheetProduct.item_name),
          image_description: generateDescription(sheetProduct.item_name, sheetProduct.category),
        };
        
        // Upsert product
        const { error: upsertError } = await supabase
          .from('products')
          .upsert(product, { onConflict: 'id' });
        
        if (upsertError) throw upsertError;
        
        imported++;
        log(`✓ Imported "${sheetProduct.item_name}" (${imported}/${sheetProducts.length})`, 'success');
        
      } catch (error) {
        log(`Error importing "${sheetProduct.item_name}": ${error}`, 'error');
        skipped++;
      }
    }
    
    // Summary
    log('\n' + '='.repeat(60), 'info');
    log(`Import Complete!`, 'success');
    log(`  Imported: ${imported}`, 'success');
    log(`  Skipped: ${skipped}`, 'warn');
    log(`  Total: ${sheetProducts.length}`, 'info');
    log('='.repeat(60) + '\n', 'info');
    
  } catch (error) {
    log(`Fatal error: ${error}`, 'error');
    process.exit(1);
  } finally {
    // Cleanup
    cleanupTempDir();
  }
};

// ============================================================================
// RUN
// ============================================================================

main().catch(error => {
  log(`Unhandled error: ${error}`, 'error');
  process.exit(1);
});
