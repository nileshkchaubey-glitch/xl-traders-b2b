export interface AdminSuggestion {
  id: number;
  domain:
    | "Product entry"
    | "Image management"
    | "Categories"
    | "PIM data quality"
    | "Search & filters"
    | "Bulk actions"
    | "Missing automation";
  title: string;
  problem: string;
  solution: string;
  benefit: string;
  priority: "High" | "Medium" | "Low";
}

export interface DailyAdminGroup {
  quickWin: AdminSuggestion;
  medium: AdminSuggestion;
  major: AdminSuggestion;
}

// Completed items are logged here and excluded from active rotation suggestions
export const COMPLETED_SUGGESTIONS = [
  {
    id: 101,
    title: "AI Smart Paste dialog for raw copy-paste autofill",
    domain: "Product entry",
  },
  {
    id: 102,
    title: "Right-click context menu on product list rows",
    domain: "Product entry",
  },
  {
    id: 103,
    title: "Image Library Sizing and Fit controls",
    domain: "Image management",
  },
  {
    id: 104,
    title: "Standalone AdminProductEditor page integration",
    domain: "Product entry",
  },
  {
    id: 105,
    title:
      "Keyboard shortcuts for saving (Ctrl+S) and closing (Esc) in dialogs",
    domain: "Product entry",
  },
];

export const QUICK_WINS: AdminSuggestion[] = [
  {
    id: 1,
    domain: "Product entry",
    title: "Auto-Generate URL Slugs",
    problem:
      "Admins must manually type URL slugs or copy-paste them, leading to typos and slower listing speeds.",
    solution:
      "Add an event listener to the Product Name input in the editor. As the user types, generate a clean URL slug (lowercase, spaces replaced by hyphens) and auto-populate the slug input field.",
    benefit:
      "Saves 5-10 seconds per product and ensures SEO-friendly, clean URLs automatically.",
    priority: "High",
  },
  {
    id: 2,
    domain: "PIM data quality",
    title: "Validate Price vs. MRP",
    problem:
      "Admins occasionally enter prices higher than MRP by mistake, causing pricing validation issues or legal non-compliance.",
    solution:
      "Add a visual warning (e.g. orange outline and small alert text) below the price input in the form if the Price value exceeds the MRP value.",
    benefit:
      "Prevents database validation errors and ensures pricing integrity before submission.",
    priority: "High",
  },
  {
    id: 3,
    domain: "Search & filters",
    title: "Active / Draft Status Quick Filters",
    problem:
      "To audit inactive draft products, admins have to scroll through the entire list or search by name.",
    solution:
      'Add simple toggle pills ("All", "Active", "Drafts") at the top of the products table for immediate filtering.',
    benefit: "Enables quick cleanups of draft items and saves scrolling time.",
    priority: "Medium",
  },
  {
    id: 4,
    domain: "Product entry",
    title: "Autofocus Name Field on Open",
    problem:
      'When adding or editing a product, admins must manually click the "Product Name" field to start typing.',
    solution:
      "Add an `autoFocus` prop or a `useRef` hook to focus the first input field as soon as the edit page or dialog loads.",
    benefit:
      "Saves one click per product entry. Essential for fast, keyboard-first entry.",
    priority: "Low",
  },
  {
    id: 5,
    domain: "Categories",
    title: "Show Product Count on Catalogue List",
    problem:
      "Admins cannot see which categories are empty or have very few products without opening them.",
    solution:
      "Query and render the count of associated products next to each catalogue/category card in the catalog page.",
    benefit:
      "Gives immediate visibility into catalog distribution and helps spot empty categories.",
    priority: "Medium",
  },
  {
    id: 6,
    domain: "Search & filters",
    title: "Copy SKU to Clipboard Button",
    problem:
      "When cross-referencing order sheets, admins have to manually highlight and copy SKUs from the table.",
    solution:
      "Add a small, subtle copy icon next to the SKU value in the products table that copies it with one click.",
    benefit: "Increases order dispatch efficiency and reduces copy errors.",
    priority: "Medium",
  },
  {
    id: 7,
    domain: "PIM data quality",
    title: "Auto-Capitalize Names Helper",
    problem:
      'Products entered in all-lowercase or irregular casing (e.g. "plastic cups 250ml") look unprofessional on the store.',
    solution:
      'Add a small "Auto-Case" button next to the Name input that automatically converts names to Start Case (capitalizing the first letter of each word).',
    benefit:
      "Maintains design and brand uniformity across the B2B store with zero typing.",
    priority: "Low",
  },
  {
    id: 8,
    domain: "Product entry",
    title: "Auto-SKU Generator from Category",
    problem:
      "Creating unique SKUs manually requires thinking and typing code formats.",
    solution:
      'Provide a "Generate SKU" button that takes the first letters of the category + product name and appends a random 4-digit code (e.g., "RND-CONT-5231").',
    benefit: "Ensures unique SKUs in 1 click.",
    priority: "Medium",
  },
  {
    id: 9,
    domain: "PIM data quality",
    title: "SKU Space and Special Character Warning",
    problem:
      "Admins sometimes enter SKUs with spaces or special characters, which breaks third-party shipping integrations.",
    solution:
      "Validate the SKU input to allow only alphanumeric characters, hyphens, and underscores, showing an error if invalid characters are typed.",
    benefit: "Ensures integration readiness with logistics and inventory APIs.",
    priority: "Medium",
  },
  {
    id: 10,
    domain: "Search & filters",
    title: "WhatsApp Pre-Filled Message Quick-Copy",
    problem:
      "Wholesalers need to share product links on WhatsApp with custom pricing queries.",
    solution:
      'Add a "Copy WA Link" action in the row context menu that copies a pre-formatted whatsapp link (e.g. `https://wa.me/...&text=Hi, check this product...`).',
    benefit:
      "Enables quick sharing with buyers who contact the admin on WhatsApp.",
    priority: "High",
  },
];

export const MEDIUM_IMPROVEMENTS: AdminSuggestion[] = [
  {
    id: 11,
    domain: "Product entry",
    title: "Duplicate Product (Clone) Feature",
    problem:
      "When entering similar products (e.g., 250ml, 500ml, 750ml versions of the same container), admins must type everything from scratch.",
    solution:
      'Add a "Duplicate" button in the table actions or editor header. It clones the active product details (category, brand, description, image, unit) into a new form draft.',
    benefit:
      "Speeds up product entries by 80% when dealing with multi-size product lines.",
    priority: "High",
  },
  {
    id: 12,
    domain: "Image management",
    title: "Image File Size Optimizer Warning",
    problem:
      "Large product images (>1MB) slow down page speed. Admins often upload heavy files without knowing it.",
    solution:
      "Read file metadata upon upload. If the image size exceeds 500KB, display a warning advising compression to WebP or JPEG.",
    benefit:
      "Saves storage costs, bandwidth, and maintains a high Google PageSpeed score.",
    priority: "High",
  },
  {
    id: 13,
    domain: "Bulk actions",
    title: "Bulk Toggle Active / Featured Status",
    problem:
      "Admins must toggle products one by one, which is tedious during seasonal catalog rotations.",
    solution:
      'Add checkboxes to table rows and a floating action bar at the bottom to perform bulk "Set Active", "Set Inactive", or "Set Featured" actions.',
    benefit:
      "Reduces click overhead from hours to a single click for batch updates.",
    priority: "High",
  },
  {
    id: 14,
    domain: "PIM data quality",
    title: "Missing Data Health CSV Report",
    problem:
      "Identifying incomplete product details (e.g. no price, no SKU, no description) requires scrolling or manual checking.",
    solution:
      'Add a button to export a CSV of only products flagged in the "Needs Attention" categories.',
    benefit:
      "Gives admins a checklist spreadsheet to update in Google Sheets or Excel.",
    priority: "Medium",
  },
  {
    id: 15,
    domain: "Search & filters",
    title: "Category Dropdown Filter on Table",
    problem:
      "Admins cannot filter the product table to view only products of a specific category.",
    solution:
      "Add a category filter selector at the top of the products table.",
    benefit:
      "Saves time when updating items belonging to a single product line.",
    priority: "Medium",
  },
  {
    id: 16,
    domain: "Image management",
    title: "Automated Image Naming Rules",
    problem:
      "Uploaded images have disorganized names (e.g., `WhatsApp Image.jpeg`), making search in the library useless.",
    solution:
      "Rename files automatically on upload using the product slug format (e.g., `round-container-500ml-1.webp`).",
    benefit:
      "Ensures the Media Library stays searchable, clean, and organized.",
    priority: "Medium",
  },
  {
    id: 17,
    domain: "Bulk actions",
    title: "Bulk Price Modifier Tool",
    problem:
      "Changing prices for wholesale suppliers due to raw material hikes requires editing every product one by one.",
    solution:
      'Create a simple popup tool: "Increase/decrease price of selected products by X% or ₹Y".',
    benefit:
      "Updates hundreds of wholesale prices in seconds during market fluctuations.",
    priority: "High",
  },
  {
    id: 18,
    domain: "Missing automation",
    title: "Google Sheets Automatic Cron Sync",
    problem:
      "Admins must manually trigger the Google Sheets import or download, which they might forget to do.",
    solution:
      "Set up an automatic daily background cron job (or edge function trigger) that pulls products from Google Sheets to sync changes.",
    benefit:
      "Ensures the website always stays synced with supplier files without manual clicks.",
    priority: "Medium",
  },
  {
    id: 19,
    domain: "Product entry",
    title: "Inline Table Editing (Quick Mode)",
    problem:
      "Opening a dialog or navigating to a new page to update a single value like Price or MRP is slow.",
    solution:
      "Implement double-click inline cell edits for Price, MRP, and SKU fields on the products table.",
    benefit:
      "Enables high-speed catalog editing similar to working in Microsoft Excel.",
    priority: "Medium",
  },
  {
    id: 20,
    domain: "Categories",
    title: "Quick Category Reordering Controls",
    problem:
      "Reordering categories currently requires drag-and-drop which is difficult to control on mobile screen size touchpoints.",
    solution:
      "Add simple up and down arrow buttons next to each category card in the list to reorder them.",
    benefit:
      "Provides a reliable backup reordering method that works flawlessly on mobile screens.",
    priority: "Low",
  },
];

export const MAJOR_IMPROVEMENTS: AdminSuggestion[] = [
  {
    id: 21,
    domain: "Image management",
    title: "Product Image Gallery (Multi-Image)",
    problem:
      "Products currently support only one main image. Wholesale buyers want to see multiple angles, lid fittings, or inside views.",
    solution:
      "Extend the database to support a `product_images` table. Modify the image selector to accept multiple uploads and display a gallery carousel on details pages.",
    benefit:
      "Improves trust and provides details visually, leading to higher inquiry conversion rates.",
    priority: "High",
  },
  {
    id: 22,
    domain: "Missing automation",
    title: "AI Translation & Localized Catalog",
    problem:
      "Local wholesalers in Surat and surrounding areas often prefer product catalogs in Hindi or Gujarati.",
    solution:
      "Integrate an AI translator API or localization client. A click of a button translates all descriptions and tags into regional languages.",
    benefit:
      "Expands B2B customer reach into local markets and makes local procurement teams feel valued.",
    priority: "Medium",
  },
  {
    id: 23,
    domain: "PIM data quality",
    title: "B2B Tiered Bulk Pricing Margin Calculator",
    problem:
      "Setting wholesale price breaks (e.g. 100 vs 1000 units) requires calculating margins externally.",
    solution:
      "Add a wholesale pricing matrix interface in the product editor where admins enter a cost price and automatically generate price tiers based on margin presets.",
    benefit: "Streamlines B2B deal creation and protects profit margins.",
    priority: "High",
  },
  {
    id: 24,
    domain: "Search & filters",
    title: "Save Search and Filter Presets",
    problem:
      'Admins often repeat specific queries (e.g. "Low stock items in Round Containers") daily.',
    solution:
      'Allow saving active search strings and filters as a custom view pill (e.g. "My Views: Out of Stock").',
    benefit:
      "Saves repetitive search and clicks, enabling immediate daily monitoring.",
    priority: "Low",
  },
  {
    id: 25,
    domain: "Missing automation",
    title: "WhatsApp Enquiry Auto-Reply Bot",
    problem:
      'Customers expect immediate responses when they click "Enquire on WhatsApp", but admins are not always online.',
    solution:
      "Connect a WhatsApp Business API webhook to auto-respond with a professional B2B catalogue PDF or greeting when an enquiry is made.",
    benefit:
      "Captures and qualifies leads 24/7 without requiring human presence.",
    priority: "High",
  },
  {
    id: 26,
    domain: "Missing automation",
    title: "Interactive Catalog PDF Catalog Generator",
    problem:
      "Wholesale representatives need customized PDF catalogs to share with clients offline.",
    solution:
      "Add a tool to select specific categories or products and compile them into a beautiful, printable PDF catalog with XL Traders branding.",
    benefit:
      "Empowers offline sales teams and creates professional marketing collaterals.",
    priority: "Medium",
  },
  {
    id: 27,
    domain: "Bulk actions",
    title: "Excel / Sheets Supplier Portal",
    problem:
      "Manually uploading products from multiple suppliers is time-consuming.",
    solution:
      "Create a restricted supplier portal where suppliers can upload their own stock XLSX files which are matched and merged automatically.",
    benefit:
      "Removes the catalog maintenance bottleneck completely from the store owner.",
    priority: "Low",
  },
  {
    id: 28,
    domain: "Missing automation",
    title: "Client-Side WebP Compressor Integrator",
    problem:
      "Admins often do not have the time to convert images to WebP manually.",
    solution:
      "Integrate a client-side WebP converter (using canvas API) directly in the file upload handler to compress images before they reach Supabase Storage.",
    benefit:
      "Forces 100% of uploaded files to be highly optimized WebP format automatically.",
    priority: "High",
  },
  {
    id: 29,
    domain: "Search & filters",
    title: "Customer Search Analytics Dashboard",
    problem:
      "Admins do not know what products customers are searching for on the frontend store.",
    solution:
      'Log frontend search queries in a database table and render a "Top Search Terms" chart in the admin panel.',
    benefit:
      "Reveals customer demand, highlighting products that are out of stock or need to be added.",
    priority: "Medium",
  },
  {
    id: 30,
    domain: "PIM data quality",
    title: "Auditable Product Revision Logs",
    problem:
      "In a multi-admin team, it is impossible to trace who changed a product price or stock, leading to pricing disputes.",
    solution:
      'Track all edits in a `catalog_changelog` table and show a "Version History" feed on the product details page.',
    benefit:
      "Provides accountability and helps debug erroneous data entry changes.",
    priority: "Low",
  },
];

export function getTodaysAdminSuggestions(
  offsetDays: number = 0
): DailyAdminGroup {
  const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
  const dayOfYear = Math.floor((Date.now() - startOfYear) / 86400000);
  const rotatedDay = dayOfYear + offsetDays;

  // Modulo calculation ensures they cycle correctly
  const quickWin = QUICK_WINS[Math.abs(rotatedDay) % QUICK_WINS.length];
  const medium =
    MEDIUM_IMPROVEMENTS[Math.abs(rotatedDay) % MEDIUM_IMPROVEMENTS.length];
  const major =
    MAJOR_IMPROVEMENTS[Math.abs(rotatedDay) % MAJOR_IMPROVEMENTS.length];

  return { quickWin, medium, major };
}
