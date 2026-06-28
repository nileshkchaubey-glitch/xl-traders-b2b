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
//  3. a STANDALONE product with a known price + MRP.
const SAMPLE_ROWS = [
  {
    master_name: "Hinged Box",
    variant_label: "250ml",
    name: "Hinged Box 250ml",
    category: "Hinged Container",
    unit: "pcs",
    price: "",
    mrp: "",
    moq: "",
    quantity_in_unit: 100,
    brand: "",
    sku: "",
    barcode: "",
    description: "Hinged clamshell box — fill price later, blank = Price on enquiry.",
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
    name: "Paper Cup 150ml",
    category: "Paper Cup",
    unit: "pcs",
    price: "",
    mrp: "",
    moq: "",
    quantity_in_unit: "",
    brand: "",
    sku: "",
    barcode: "",
    description: 'Standalone product, price unknown — leave price blank for "Price on enquiry".',
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
    name: "News Paper Box",
    category: "Paper Box",
    unit: "pcs",
    price: 35,
    mrp: 40,
    moq: "",
    quantity_in_unit: "",
    brand: "",
    sku: "",
    barcode: "",
    description: "Standalone product with a known wholesale price and MRP.",
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
  ["name", "YES ✱", "Any text. Keep concise but descriptive.", "Hinged Box 250ml"],
  [
    "category",
    "No",
    "Match an existing category name (or a new one is created automatically). Blank = Uncategorized.",
    "Hinged Container",
  ],
  ["unit", "YES ✱", "One of: pcs  box  pack  roll  kg  litre  set", "pcs"],
  [
    "price",
    "No",
    'Wholesale price per unit (₹). Numbers only, no ₹ symbol. BLANK = "Price on enquiry" on the website.',
    "35",
  ],
  ["mrp", "No", "Maximum Retail Price (₹). Numbers only.", "40"],
  ["moq", "No", "Minimum Order Quantity. Whole number. Blank = unknown.", "50"],
  [
    "quantity_in_unit",
    "No",
    "Number of individual pieces in one unit/box. Blank defaults to 1.",
    "100",
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
    "draft  or  published  (lowercase). Defaults to draft — drafts stay hidden from the website until you publish them.",
    "draft",
  ],
  [
    "tags",
    "No",
    "Comma-separated business types this product suits.",
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
    "• If no SKU is provided, the system matches by product name (case-insensitive).",
  ],
  [
    "• Maximum 2000 rows per import. For larger catalogues split into multiple sheets.",
  ],
  ["• Import results are logged under Admin → CSV Import → Import Log."],
];

// ── Main export function ────────────────────────────────────────────────────
export function downloadProductTemplate() {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Products template ─────────────────────────────────
  const headers = TEMPLATE_COLUMNS.map(c => c.label);

  // Mark required columns with an asterisk in a separate "legend" row
  const legend = TEMPLATE_COLUMNS.map(c =>
    c.required ? "* REQUIRED" : "(optional)"
  );

  const productData = [
    headers,
    legend,
    ...SAMPLE_ROWS.map(r => TEMPLATE_COLUMNS.map(c => (r as any)[c.key] ?? "")),
  ];
  const wsProducts = XLSX.utils.aoa_to_sheet(productData);

  // Set column widths
  wsProducts["!cols"] = TEMPLATE_COLUMNS.map(c => ({ wch: c.width }));

  // Data-validation dropdown for the `status` column (draft / published).
  // Header + legend occupy rows 1–2, so validate from the first data row down.
  // NOTE: best-effort — the community `xlsx` build does not always emit data
  // validations, so the Instructions sheet + sample row are the real guardrail.
  const statusIdx = TEMPLATE_COLUMNS.findIndex(c => c.key === "status");
  if (statusIdx >= 0) {
    const statusCol = XLSX.utils.encode_col(statusIdx);
    (wsProducts as any)["!dataValidation"] = [
      {
        sqref: `${statusCol}3:${statusCol}1000`,
        type: "list",
        formula1: '"draft,published"',
        allowBlank: true,
        showDropDown: true,
      },
    ];
  }

  // Freeze first two rows (header + legend)
  wsProducts["!freeze"] = { xSplit: 0, ySplit: 2 };

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
