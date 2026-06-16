/**
 * Google Sheets / Excel template generator.
 * Produces a two-sheet XLSX file:
 *   Sheet 1 – "Products"     : ready-to-fill template with sample rows
 *   Sheet 2 – "Instructions" : column-by-column reference guide
 *
 * Uses the sheetjs (xlsx) library — already in the project.
 */
import * as XLSX from 'xlsx';

// ── Column definitions ──────────────────────────────────────────────────────
export const TEMPLATE_COLUMNS = [
  { key: 'name',             label: 'name',             required: true,  width: 35 },
  { key: 'category',         label: 'category',         required: true,  width: 28 },
  { key: 'sku',              label: 'sku',              required: false, width: 14 },
  { key: 'barcode',          label: 'barcode',          required: false, width: 18 },
  { key: 'moq',              label: 'moq',              required: false, width: 8  },
  { key: 'price',            label: 'price',            required: true,  width: 12 },
  { key: 'mrp',              label: 'mrp',              required: false, width: 12 },
  { key: 'unit',             label: 'unit',             required: true,  width: 10 },
  { key: 'quantity_in_unit', label: 'quantity_in_unit', required: false, width: 18 },
  { key: 'brand',            label: 'brand',            required: false, width: 20 },
  { key: 'description',      label: 'description',      required: false, width: 45 },
  { key: 'image_url_1',      label: 'image_url_1',      required: false, width: 72 },
  { key: 'image_url_2',      label: 'image_url_2',      required: false, width: 72 },
  { key: 'image_url_3',      label: 'image_url_3',      required: false, width: 72 },
  { key: 'image_url_4',      label: 'image_url_4',      required: false, width: 72 },
  { key: 'image_url_5',      label: 'image_url_5',      required: false, width: 72 },
  { key: 'is_featured',      label: 'is_featured',      required: false, width: 13 },
  { key: 'group',            label: 'group',            required: false, width: 22 },
  { key: 'status',           label: 'status',           required: false, width: 12 },
  { key: 'tags',             label: 'tags',             required: false, width: 30 },
  { key: 'na_fields',        label: 'na_fields',        required: false, width: 30 },
];

// ── Sample product rows ─────────────────────────────────────────────────────
const SAMPLE_ROWS = [
  {
    name: '500ml Round PP Container (100 pcs)',
    category: 'Round Container',
    sku: 'RND-0001',
    barcode: '8901234567001',
    moq: 50,
    price: 1450,
    mrp: 1800,
    unit: 'box',
    quantity_in_unit: 100,
    brand: 'Oshine',
    description: 'Premium 500ml round polypropylene container with snap-on lid. Microwave safe. Ideal for dairy, snacks and meal prep.',
    image_url_1: '', image_url_2: '', image_url_3: '', image_url_4: '', image_url_5: '',
    is_featured: 'true',
    group: 'Food Containers',
    status: 'draft',
    tags: 'restaurant,cloud-kitchen',
    na_fields: '',
  },
  {
    name: '1000ml Rectangle PP Container (50 pcs)',
    category: 'Rectangle Container',
    sku: 'REC-0001',
    barcode: '8901234567002',
    moq: 25,
    price: 2200,
    mrp: 2700,
    unit: 'box',
    quantity_in_unit: 50,
    brand: 'Oshine',
    description: '1-litre rectangular food-grade container with airtight lid. BPA free, freezer and microwave safe.',
    image_url_1: '', image_url_2: '', image_url_3: '', image_url_4: '', image_url_5: '',
    is_featured: 'false',
    group: 'Food Containers',
    status: 'draft',
    tags: '',
    na_fields: '',
  },
  {
    name: '750ml Hinged Clamshell Box (200 pcs)',
    category: 'Hinged Container',
    sku: 'HNG-0001',
    barcode: '8901234567003',
    moq: 100,
    price: 3100,
    mrp: 3800,
    unit: 'box',
    quantity_in_unit: 200,
    brand: 'Biopack',
    description: 'Biodegradable hinged clamshell container. Suitable for hot and cold takeaway food. Compostable.',
    image_url_1: '', image_url_2: '', image_url_3: '', image_url_4: '', image_url_5: '',
    is_featured: 'true',
    group: 'Food Containers',
    status: 'published',
    tags: 'restaurant,caterer',
    na_fields: '',
  },
  {
    name: '250ml Aluminum Foil Container (100 pcs)',
    category: 'Aluminum Container',
    sku: 'ALU-0001',
    barcode: '8901234567004',
    moq: 50,
    price: 1850,
    mrp: 2200,
    unit: 'box',
    quantity_in_unit: 100,
    brand: 'Fortune Plus',
    description: 'Heavy-duty 250ml aluminum foil container. Oven and freezer safe. Perfect for bakeries and catering.',
    image_url_1: '', image_url_2: '', image_url_3: '', image_url_4: '', image_url_5: '',
    is_featured: 'false',
    group: 'Aluminum Products',
    status: 'draft',
    tags: '',
    na_fields: '',
  },
  {
    name: 'Stretch Cling Film 30cm × 300m Roll',
    category: 'Wrapping',
    sku: 'WRP-0001',
    barcode: '',
    moq: 12,
    price: 780,
    mrp: 950,
    unit: 'roll',
    quantity_in_unit: 1,
    brand: 'Wrap Pro',
    description: 'Commercial-grade PVC cling film for food wrapping. 30cm width, 300m length. Strong cling, easy tear.',
    image_url_1: '', image_url_2: '', image_url_3: '', image_url_4: '', image_url_5: '',
    is_featured: 'false',
    group: 'Packaging Materials',
    status: 'draft',
    tags: '',
    na_fields: 'brand,image',
  },
];

// ── Instructions sheet data ─────────────────────────────────────────────────
const INSTRUCTIONS_ROWS = [
  ['Column',            'Required?', 'Valid Values / Format',                     'Example'],
  ['name',              'YES ✱',     'Any text. Keep concise but descriptive.',    '500ml Round PP Container (100 pcs)'],
  ['category',          'YES ✱',     'Must match an existing category name or a new one will be created automatically.', 'Round Container'],
  ['sku',               'No',        'Uppercase letters + numbers + hyphens. If blank a SKU is auto-generated on import.', 'RND-0001'],
  ['barcode',           'No',        'EAN-13 or any barcode string. Leave blank if unknown.', '8901234567001'],
  ['moq',               'No',        'Minimum Order Quantity. Whole number ≥ 1. Defaults to 1.', '50'],
  ['price',             'YES ✱',     'Wholesale price per unit (₹). Numbers only, no ₹ symbol.', '1450'],
  ['mrp',               'No',        'Maximum Retail Price (₹). Numbers only.', '1800'],
  ['unit',              'YES ✱',     'One of: pcs  box  pack  roll  kg  litre  set', 'box'],
  ['quantity_in_unit',  'No',        'Number of individual pieces in one unit/box.', '100'],
  ['brand',             'No',        'Brand or manufacturer name.',                'Oshine'],
  ['description',       'No',        'Full product description. HTML not supported.', 'Premium 500ml round container…'],
  ['image_url_1 … image_url_5', 'No', 'Paste Google Drive thumbnail URLs. Format: https://drive.google.com/thumbnail?id=FILE_ID&sz=w800  —  Get FILE_ID from your Drive share link. image_url_1 becomes the primary product image.', 'https://drive.google.com/thumbnail?id=1abc123XYZ&sz=w800'],
  ['is_featured',       'No',        'true  or  false  (lowercase). Featured products appear on the homepage.', 'true'],
  ['group',             'No',        'Category group / section heading for navigation.',  'Food Containers'],
  ['status',            'No',        'draft  or  published  (lowercase). Defaults to draft — drafts stay hidden from the website until you publish them.', 'draft'],
  ['tags',              'No',        'Comma-separated business types this product suits.', 'restaurant,cloud-kitchen,caterer'],
  ['na_fields',         'No',        'Comma-separated fields that are not applicable for this product (suppresses "missing data" warnings).', 'brand,image,specifications'],
  [],
  ['IMPORTANT NOTES', '', '', ''],
  ['• Row 1 must always be the header row (column names exactly as shown above).'],
  ['• Column names are case-insensitive — "Name", "NAME", and "name" all work.'],
  ['• Leave optional columns blank rather than deleting them.'],
  ['• If a SKU already exists in the database the product will be UPDATED, not duplicated.'],
  ['• If no SKU is provided, the system matches by product name (case-insensitive).'],
  ['• Maximum 2000 rows per import. For larger catalogues split into multiple sheets.'],
  ['• Import results are logged under Admin → CSV Import → Import Log.'],
];

// ── Main export function ────────────────────────────────────────────────────
export function downloadProductTemplate() {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Products template ─────────────────────────────────
  const headers = TEMPLATE_COLUMNS.map((c) => c.label);

  // Mark required columns with an asterisk in a separate "legend" row
  const legend = TEMPLATE_COLUMNS.map((c) => (c.required ? '* REQUIRED' : '(optional)'));

  const productData = [headers, legend, ...SAMPLE_ROWS.map((r) => TEMPLATE_COLUMNS.map((c) => (r as any)[c.key] ?? ''))];
  const wsProducts = XLSX.utils.aoa_to_sheet(productData);

  // Set column widths
  wsProducts['!cols'] = TEMPLATE_COLUMNS.map((c) => ({ wch: c.width }));

  // Data-validation dropdown for the `status` column (draft / published).
  // Header + legend occupy rows 1–2, so validate from the first data row down.
  // NOTE: best-effort — the community `xlsx` build does not always emit data
  // validations, so the Instructions sheet + sample row are the real guardrail.
  const statusIdx = TEMPLATE_COLUMNS.findIndex((c) => c.key === 'status');
  if (statusIdx >= 0) {
    const statusCol = XLSX.utils.encode_col(statusIdx);
    (wsProducts as any)['!dataValidation'] = [
      {
        sqref: `${statusCol}3:${statusCol}1000`,
        type: 'list',
        formula1: '"draft,published"',
        allowBlank: true,
        showDropDown: true,
      },
    ];
  }

  // Freeze first two rows (header + legend)
  wsProducts['!freeze'] = { xSplit: 0, ySplit: 2 };

  XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');

  // ── Sheet 2: Instructions ──────────────────────────────────────
  const wsInstructions = XLSX.utils.aoa_to_sheet(INSTRUCTIONS_ROWS);

  wsInstructions['!cols'] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 62 },
    { wch: 40 },
  ];

  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  // ── Download ───────────────────────────────────────────────────
  const fileName = `xl-traders-product-template.xlsx`;
  XLSX.writeFile(wb, fileName);
}
