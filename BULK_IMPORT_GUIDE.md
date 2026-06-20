# Bulk Import System - Complete Guide

## Overview

The Bulk Import feature in the Admin Panel allows you to efficiently manage 500+ products by:

- **Importing** new products from CSV/Excel files
- **Updating** existing products (smart upsert logic)
- **Exporting** all products for bulk editing
- **Auto-creating** categories as needed

## Access the Bulk Import

1. Go to `/admin` (requires admin login)
2. Click the **"Bulk Import"** tab (upload icon)
3. You'll see three main options:
   - Download CSV Template
   - Export All Products
   - Upload CSV/Excel file

## CSV File Format

### Required Columns

| Column             | Type    | Required    | Example                          |
| ------------------ | ------- | ----------- | -------------------------------- |
| `name`             | Text    | ✅ Yes      | "5 Ply Corrugated Box - 12x10x8" |
| `category`         | Text    | ✅ Yes      | "Corrugated Boxes"               |
| `group`            | Text    | ❌ Optional | "Boxes"                          |
| `price`            | Number  | ✅ Yes      | 3187.00                          |
| `mrp`              | Number  | ❌ Optional | 3500.00                          |
| `unit`             | Text    | ✅ Yes      | "box", "piece", "roll", "pack"   |
| `quantity_in_unit` | Number  | ✅ Yes      | 100                              |
| `description`      | Text    | ❌ Optional | "Premium quality boxes..."       |
| `is_featured`      | Boolean | ❌ Optional | "true" or "false"                |

### Example CSV Content

```csv
name,category,group,price,mrp,unit,quantity_in_unit,description,is_featured
5 Ply Corrugated Box - 12x10x8,Corrugated Boxes,Boxes,3187.00,3500.00,box,100,Premium 5-ply corrugated boxes,true
Clear Plastic Container - 500ml,Plastic Containers,Containers,2500.00,3000.00,piece,500,Clear plastic food containers,true
Kraft Paper Bag - Medium,Paper Bags,Bags,1500.00,1800.00,pack,1000,Eco-friendly kraft bags,false
```

## Step-by-Step Usage

### Step 1: Download Template

1. Click **"Download Template"** button
2. Opens a sample CSV file with correct headers
3. Use this as a starting point for your data

### Step 2: Prepare Your Data

**Option A: From Google Sheets**

1. Open your Google Sheet with product data
2. Go to **File → Download → CSV**
3. Save the file
4. Open in Excel and ensure columns match the required format

**Option B: From Excel**

1. Create/open your Excel file
2. Ensure columns match the required format
3. Save as `.xlsx` or `.csv`

**Option C: Export & Edit**

1. Click **"Export All Products"** button
2. Opens your current products as CSV
3. Edit prices, descriptions, etc. in Excel
4. Save and re-upload to bulk-update

### Step 3: Upload File

1. Click the upload area or select file
2. Choose your `.csv` or `.xlsx` file
3. System automatically parses the file
4. Shows preview of parsed rows

### Step 4: Review Preview

Before importing, you'll see:

- ✅ **Valid rows** - Ready to import
- ⚠️ **Parse errors** - Rows with issues (displayed at top)
- **Preview table** - First 10 rows shown

**Important**: If there are parse errors, fix them in your file and re-upload.

### Step 5: Confirm & Import

1. Review the preview table
2. Click **"Import X Products"** button
3. System processes the import (may take a moment)
4. Shows import summary with results

### Step 6: View Results

After import, you'll see:

- 🟢 **Added**: Number of new products created
- 🔵 **Updated**: Number of existing products updated
- 🔴 **Errors**: Number of rows that failed

**Failed rows** are listed with reasons (e.g., "Invalid price", "Category not found").

## Smart Upsert Logic

### How It Works

For each row in your CSV:

1. **Check if product exists** by matching the product name (case-insensitive)
2. **If EXISTS**: Update these fields:
   - Price
   - MRP
   - Unit of measure
   - Quantity
   - Description
   - Featured status
3. **If NEW**: Create new product with:
   - Auto-generated SKU
   - Active status = true
   - All provided fields

### Category Handling

- **If category exists** (by name): Links product to existing category
- **If category doesn't exist**: Auto-creates new category
  - Slug generated from name (lowercase, hyphens)
  - Description auto-generated
  - Display order set to 999 (appears at end)

## Bulk Editing Workflow

### Update Prices for All Products

1. Click **"Export All Products"**
2. Opens CSV with all current products
3. Open in Excel
4. Edit prices in the `price` column
5. Save the file
6. Upload back to Bulk Import
7. System updates all prices automatically

### Add New Category

1. In your CSV, use a new category name
2. Upload the file
3. System auto-creates the category
4. Products link to the new category

## Common Scenarios

### Scenario 1: Import 500 Products from Google Sheet

```
1. Export Google Sheet as CSV
2. Download CSV Template (to see format)
3. Copy your data into template format
4. Upload CSV to Bulk Import
5. Review preview
6. Click Import
7. Done! All 500 products imported
```

### Scenario 2: Update Prices in Bulk

```
1. Click "Export All Products"
2. Open CSV in Excel
3. Update price column for products
4. Save CSV
5. Upload back to Bulk Import
6. Click Import
7. All prices updated automatically
```

### Scenario 3: Add New Products to Existing Catalog

```
1. Create CSV with new products only
2. Use same format as existing products
3. Upload CSV
4. System adds new products
5. Existing products unchanged
```

## Error Handling

### Common Errors & Solutions

| Error                      | Cause                     | Solution                              |
| -------------------------- | ------------------------- | ------------------------------------- |
| "Missing product name"     | Name column empty         | Add product name in CSV               |
| "Invalid price"            | Price not a number        | Use format: 100.00 (not ₹100)         |
| "Invalid quantity_in_unit" | Quantity is 0 or negative | Use positive numbers only             |
| "Missing category"         | Category column empty     | Add category name                     |
| "Invalid unit"             | Unit field empty          | Specify: piece, box, roll, pack, etc. |

### Validation Rules

- **Name**: Required, minimum 1 character
- **Category**: Required, minimum 1 character
- **Price**: Required, must be positive number
- **Quantity**: Required, must be positive number
- **Unit**: Required, any text value accepted

## Performance

- **CSV parsing**: Instant
- **Preview generation**: < 1 second
- **Import speed**: ~100 products per 5 seconds
- **500 products**: ~25 seconds to import

## Best Practices

### Before Importing

✅ **Do:**

- Validate data in Excel before upload
- Check for duplicate product names
- Ensure prices are numeric
- Use consistent category names
- Test with small batch first (10-20 products)

❌ **Don't:**

- Include currency symbols (₹, $, etc.)
- Use special characters in product names
- Leave required columns empty
- Upload files > 10MB
- Import without reviewing preview

### Data Quality

- **Product names**: Be specific and descriptive
- **Categories**: Use consistent naming (e.g., "Corrugated Boxes" not "Boxes" or "corrugated boxes")
- **Prices**: Use decimal format (100.50, not 100.5 or 100,50)
- **Descriptions**: Keep under 500 characters
- **Units**: Use: piece, box, roll, pack, sheet, etc.

## Troubleshooting

### File Won't Upload

- Check file format (.csv or .xlsx only)
- File size < 10MB
- Browser allows file uploads
- Try different browser if issue persists

### Preview Shows 0 Products

- Check CSV has header row
- Verify column names match exactly (lowercase)
- Ensure at least one row of data below headers
- Check for encoding issues (use UTF-8)

### Import Fails Silently

- Check browser console for errors (F12)
- Verify Supabase connection
- Try smaller batch (10 products)
- Contact support if issue persists

### Prices Not Updating

- Verify product names match exactly (case-sensitive)
- Check price format (100.00, not 100)
- Ensure price column is numeric
- Try exporting first to see exact names

## API Reference

### Import Service Functions

```typescript
// Parse CSV file
parseCSV(file: File): Promise<ParsedFile>

// Parse Excel file
parseExcel(file: File): Promise<ParsedFile>

// Bulk import/update products
bulkImportProducts(rows: ImportRow[]): Promise<ImportResult>

// Export all products as CSV
exportProductsAsCSV(): Promise<void>

// Generate CSV template
generateCSVTemplate(): void
```

### Data Types

```typescript
interface ImportRow {
  name: string;
  category: string;
  group?: string;
  price: number;
  mrp?: number;
  unit: string;
  quantity_in_unit: number;
  description?: string;
  is_featured?: boolean;
}

interface ImportResult {
  added: number;
  updated: number;
  errors: Array<{ row: number; error: string }>;
  summary: string;
}
```

## Limitations

- Maximum file size: 10MB
- Maximum rows per import: 10,000
- Supported formats: CSV, XLSX, XLS
- Product matching: By name (case-insensitive)
- Images: Not imported via CSV (use admin panel or separate image upload)

## Support

For issues or questions:

1. Check this guide's troubleshooting section
2. Review error messages in import summary
3. Contact admin support with error details

---

**Last Updated**: May 30, 2026  
**Version**: 1.0  
**Status**: ✅ Production Ready
