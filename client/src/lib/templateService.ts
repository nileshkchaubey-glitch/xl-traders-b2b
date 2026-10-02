/**
 * Google Sheets / Excel template generator.
 * Produces a two-sheet XLSX file:
 *   Sheet 1 – "Products"     : ready-to-fill template with sample rows
 *   Sheet 2 – "Instructions" : column-by-column reference guide
 *
 * Uses the sheetjs (xlsx) library — already in the project.
 */
import * as XLSX from "xlsx";

// ── Column definitions ──────────────────────────────────────────────────────
// Order matches the documented import spec. Only `name` and `unit` are required —
// price, category, and moq are optional (blank price = "Price on enquiry";
// blank category = Uncategorized; blank moq = unknown).
export const TEMPLATE_COLUMNS = [
  { key: "name", label: "name", required: true, width: 35 },
  { key: "category", label: "category", required: false, width: 28 },
  { key: "unit", label: "unit", required: true, width: 10 },
  { key: "price", label: "price", required: false, width: 12 },
  { key: "mrp", label: "mrp", required: false, width: 12 },
  { key: "moq", label: "moq", required: false, width: 8 },
  {
    key: "quantity_in_unit",
    label: "quantity_in_unit",
    required: false,
    width: 18,
  },
  { key: "order_unit", label: "order_unit", required: false, width: 14 },
  { key: "order_step", label: "order_step", required: false, width: 14 },
  { key: "brand", label: "brand", required: false, width: 20 },
  { key: "sku", label: "sku", required: false, width: 14 },
  { key: "barcode", label: "barcode", required: false, width: 18 },
  { key: "description", label: "description", required: false, width: 45 },
  { key: "image_url_1", label: "image_url_1", required: false, width: 72 },
  { key: "image_url_2", label: "image_url_2", required: false, width: 72 },
  { key: "image_url_3", label: "image_url_3", required: false, width: 72 },
  { key: "image_url_4", label: "image_url_4", required: false, width: 72 },
  { key: "image_url_5", label: "image_url_5", required: false, width: 72 },
  { key: "is_featured", label: "is_featured", required: false, width: 13 },
  { key: "status", label: "status", required: false, width: 12 },
  { key: "tags", label: "tags", required: false, width: 30 },
  { key: "na_fields", label: "na_fields", required: false, width: 30 },
  { key: "master_name", label: "master_name", required: false, width: 22 },
  { key: "variant_label", label: "variant_label", required: false, width: 16 },
];

// ── Sample product rows ─────────────────────────────────────────────────────
// Three illustrative rows covering the common cases:
//  1. a size VARIANT (master_name + variant_label) with price left blank,
//  2. a STANDALONE product with an unknown price (blank = "Price on enquiry"),
//  3. a STANDALONE product with a custom two-pack step.
const SAMPLE_ROWS = [
  {
    master_name: "EXAMPLE ONLY — replace parent",
    variant_label: "250ml",
    name: "EXAMPLE ONLY — replace variant",
    category: "",
    unit: "box",
    price: "",
    mrp: "",
    moq: "",
    quantity_in_unit: 100,
    order_unit: "pcs",
    order_step: 300,
    brand: "",
    sku: "",
    barcode: "",
    description:
      "Example only: customer counts pieces; price is per box. Replace all examples before importing.",
    image_url_1: "",
    image_url_2: "",
    image_url_3: "",
    image_url_4: "",
    image_url_5: "",
    is_featured: "false",
    status: "draft",
    tags: "restaurant,cloud-kitchen",
    na_fields: "",
  },
  {
    master_name: "",
    variant_label: "",
    name: "EXAMPLE ONLY — replace pack product",
    category: "",
    unit: "pack",
    price: "",
    mrp: "",
    moq: "",
    quantity_in_unit: "",
    order_unit: "pack",
    order_step: "",
    brand: "",
    sku: "",
    barcode: "",
    description:
      'Standalone product, price unknown — leave price blank for "Price on enquiry".',
    image_url_1: "",
    image_url_2: "",
    image_url_3: "",
    image_url_4: "",
    image_url_5: "",
    is_featured: "false",
    status: "draft",
    tags: "",
    na_fields: "",
  },
  {
    master_name: "",
    variant_label: "",
    name: "EXAMPLE ONLY — replace box product",
    category: "",
    unit: "box",
    price: "",
    mrp: "",
    moq: "",
    quantity_in_unit: 100,
    order_unit: "pack",
    order_step: 200,
    brand: "",
    sku: "",
    barcode: "",
    description:
      "Example only: customer counts boxes in whole configured steps. Replace before importing.",
    image_url_1: "",
    image_url_2: "",
    image_url_3: "",
    image_url_4: "",
    image_url_5: "",
    is_featured: "false",
    status: "draft",
    tags: "",
    na_fields: "",
  },
];

// ── Instructions sheet data ─────────────────────────────────────────────────
const INSTRUCTIONS_ROWS = [
  ["Column", "Required?", "Valid Values / Format", "Example"],
  [
    "name",
    "YES ✱",
    "Any text. Keep concise but descriptive.",
    "Hinged Box 250ml",
  ],
  [
    "category",
    "No",
    "Match an existing category name. Blank or unknown = Uncategorized; unknown names are reported, not created.",
    "Hinged Container",
  ],
  [
    "unit",
    "YES ✱",
    "Selling unit: box, pack, roll, kg, litre, set. unit_of_measure is also accepted. Customer counting uses order_unit.",
    "box",
  ],
  [
    "price",
    "No",
    'Wholesale price per SELLING unit (₹), never per piece inside a pack. BLANK = "Price on enquiry".',
    "35",
  ],
  ["mrp", "No", "Maximum Retail Price (₹). Numbers only.", "40"],
  [
    "moq",
    "No",
    "Minimum whole PACKS, even with pcs ordering. Shared ordering rules round up to a whole step. Blank = unknown.",
    "2",
  ],
  [
    "quantity_in_unit",
    "No",
    "Positive whole pieces per selling unit. Blank = 1 for new rows; existing SKU pack size is preserved.",
    "100",
  ],
  [
    "order_unit",
    "No",
    "pack or pcs. pcs needs pack size > 1. Blank preserves existing SKU setting; new rows use pack.",
    "pcs",
  ],
  [
    "order_step",
    "No",
    "Positive whole PIECES, a multiple of pack size. Blank preserves existing SKU setting; new rows use pack size. Clear a custom step in the Ordering editor.",
    "300",
  ],
  ["brand", "No", "Brand or manufacturer name.", "Oshine"],
  [
    "sku",
    "No",
    "Uppercase letters + numbers + hyphens. If blank a SKU is auto-generated on import.",
    "HNG-250ML",
  ],
  [
    "barcode",
    "No",
    "EAN-13 or any barcode string. Leave blank if unknown.",
    "8901234567001",
  ],
  [
    "description",
    "No",
    "Full product description. HTML not supported.",
    "Hinged clamshell box for takeaway…",
  ],
  [
    "image_url_1 … image_url_5",
    "No",
    "Paste Google Drive thumbnail URLs. Format: https://drive.google.com/thumbnail?id=FILE_ID&sz=w800  —  Get FILE_ID from your Drive share link. image_url_1 becomes the primary product image.",
    "https://drive.google.com/thumbnail?id=1abc123XYZ&sz=w800",
  ],
  [
    "is_featured",
    "No",
    "true  or  false  (lowercase). Featured products appear on the homepage.",
    "true",
  ],
  [
    "status",
    "No",
    "draft or published for existing SKUs; blank preserves their status. NEW products always start as draft; publish verified products separately.",
    "draft",
  ],
  [
    "tags",
    "No",
    "Parsed for compatibility; currently NOT persisted by the importer.",
    "restaurant,cloud-kitchen,caterer",
  ],
  [
    "na_fields",
    "No",
    'Comma-separated fields that are not applicable for this product (suppresses "missing data" warnings).',
    "brand,image,specifications",
  ],
  [
    "master_name",
    "No",
    "VARIANTS ONLY — the shared parent product name. Rows sharing a master_name become size/pack variants of it. Blank = standalone product.",
    "Hinged Box",
  ],
  [
    "variant_label",
    "No",
    "VARIANTS ONLY — the label for this variant (size/pack). Combined with master_name to form the product.",
    "250ml",
  ],
  [],
  ["IMPORTANT NOTES", "", "", ""],
  ["• Only name and unit are required — every other column may be left blank."],
  ['• Blank price = "Price on enquiry" on the website (never shown as ₹0).'],
  [
    "• Row 1 must always be the header row (column names exactly as shown above).",
  ],
  [
    '• Column names are case-insensitive — "Name", "NAME", and "name" all work.',
  ],
  ["• Leave optional columns blank rather than deleting them."],
  [
    "• If a SKU already exists in the database the product will be UPDATED, not duplicated.",
  ],
  [
    "• Without SKU, standalone rows get a new generated SKU. Variant SKUs are derived from parent/label. No product-name matching.",
  ],
  [
    "• Delete/replace all EXAMPLE ONLY rows before importing. New products default to draft. Only publish verified catalogue information.",
  ],
  [
    "• Import results appear after processing; the importer also attempts an import_logs database record. No separate Import Log screen is implemented.",
  ],
];

// ── Main export function ────────────────────────────────────────────────────
export function downloadProductTemplate() {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Products template ─────────────────────────────────
  const headers = TEMPLATE_COLUMNS.map(c => c.label);

  const productData = [
    headers,
    ...SAMPLE_ROWS.map(r => TEMPLATE_COLUMNS.map(c => (r as any)[c.key] ?? "")),
  ];
  const wsProducts = XLSX.utils.aoa_to_sheet(productData);

  // Set column widths
  wsProducts["!cols"] = TEMPLATE_COLUMNS.map(c => ({ wch: c.width }));

  // Data-validation dropdown for the `status` column (draft / published).
  // Validate from the first data row; requirements live in Instructions.
  // NOTE: best-effort — the community `xlsx` build does not always emit data
  // validations, so the Instructions sheet + sample row are the real guardrail.
  const statusIdx = TEMPLATE_COLUMNS.findIndex(c => c.key === "status");
  if (statusIdx >= 0) {
    const statusCol = XLSX.utils.encode_col(statusIdx);
    (wsProducts as any)["!dataValidation"] = [
      {
        sqref: `${statusCol}2:${statusCol}1000`,
        type: "list",
        formula1: '"draft,published"',
        allowBlank: true,
        showDropDown: true,
      },
    ];
  }

  // Best effort in the community codec; the first row is always the header.
  wsProducts["!freeze"] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, wsProducts, "Products");

  // ── Sheet 2: Instructions ──────────────────────────────────────
  const wsInstructions = XLSX.utils.aoa_to_sheet(INSTRUCTIONS_ROWS);

  wsInstructions["!cols"] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 62 },
    { wch: 40 },
  ];

  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

  // ── Download ───────────────────────────────────────────────────
  const fileName = `xl-traders-product-template.xlsx`;
  XLSX.writeFile(wb, fileName);
}
