import { useState } from "react";
import {
  Link,
  AlertCircle,
  CheckCircle,
  Loader2,
  Info,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import Papa from "papaparse";
import { fetchGoogleSheetAsCsv } from "@/lib/googleSheetsService";
import {
  bulkImportProducts,
  ImportRow,
  normalizeStatus,
  parseNaFields,
} from "@/lib/bulkImportService";
import { downloadProductTemplate } from "@/lib/templateService";

type Step = "input" | "mapping" | "preview" | "importing" | "done";

interface ColMap {
  master_name: string;
  variant_label: string;
  name: string;
  category: string;
  price: string;
  mrp: string;
  unit: string;
  quantity_in_unit: string;
  description: string;
  brand: string;
  is_featured: string;
  sku: string;
  barcode: string;
  moq: string;
  status: string;
  tags: string;
  na_fields: string;
}

const DEFAULT_MAP: ColMap = {
  master_name: "master_name",
  variant_label: "variant_label",
  name: "name",
  category: "category",
  price: "price",
  mrp: "mrp",
  unit: "unit",
  quantity_in_unit: "quantity_in_unit",
  description: "description",
  brand: "brand",
  is_featured: "is_featured",
  sku: "sku",
  barcode: "barcode",
  moq: "moq",
  status: "status",
  tags: "tags",
  na_fields: "na_fields",
};

function mapRow(raw: Record<string, string>, map: ColMap): ImportRow | null {
  const name = raw[map.name]?.trim();
  const category = map.category ? raw[map.category]?.trim() : "";
  const unit = raw[map.unit]?.trim() || "pcs";
  // Price is optional now (PR #46) — blank imports as null = "Price on enquiry".
  const rawPrice = map.price ? raw[map.price] : "";
  const hasPrice =
    rawPrice !== undefined &&
    rawPrice !== null &&
    String(rawPrice).trim() !== "";
  const price = hasPrice ? parseFloat(rawPrice) : null;
  const qty = parseFloat(raw[map.quantity_in_unit] || "1");

  // Only name is truly required. Blank category falls back to Uncategorized at
  // import time; blank/invalid price is dropped to null rather than rejecting the row.
  if (!name) return null;
  if (price !== null && (isNaN(price) || price < 0)) return null;

  return {
    master_name: map.master_name ? raw[map.master_name]?.trim() : undefined,
    variant_label: map.variant_label
      ? raw[map.variant_label]?.trim()
      : undefined,
    name,
    category: category || "uncategorized",
    sku: map.sku ? raw[map.sku]?.trim() : undefined,
    barcode: map.barcode ? raw[map.barcode]?.trim() : undefined,
    moq: map.moq && raw[map.moq] ? parseInt(raw[map.moq]) : undefined,
    price,
    mrp: map.mrp ? parseFloat(raw[map.mrp]) || undefined : undefined,
    unit: unit || "pcs",
    quantity_in_unit: isNaN(qty) ? 1 : qty,
    description: map.description ? raw[map.description]?.trim() : undefined,
    brand: map.brand ? raw[map.brand]?.trim() : undefined,
    is_featured:
      raw[map.is_featured]?.toLowerCase() === "true" ||
      raw[map.is_featured] === "1",
    status: map.status ? normalizeStatus(raw[map.status]) : undefined,
    na_fields: map.na_fields ? parseNaFields(raw[map.na_fields]) : undefined,
    tags: map.tags ? raw[map.tags]?.trim() : undefined,
  };
}

// Column chips shown in the template banner — required (green ✱),
// optional (white), and new/advanced (blue outline).
type ChipKind = "required" | "optional" | "new";
const COLUMN_CHIPS: { label: string; kind: ChipKind }[] = [
  { label: "name", kind: "required" },
  { label: "unit", kind: "required" },
  { label: "price", kind: "optional" },
  { label: "category", kind: "optional" },
  { label: "sku", kind: "optional" },
  { label: "barcode", kind: "optional" },
  { label: "moq", kind: "optional" },
  { label: "mrp", kind: "optional" },
  { label: "quantity_in_unit", kind: "optional" },
  { label: "brand", kind: "optional" },
  { label: "description", kind: "optional" },
  { label: "is_featured", kind: "optional" },
  { label: "status", kind: "new" },
  { label: "tags", kind: "new" },
  { label: "na_fields", kind: "new" },
  { label: "master_name", kind: "new" },
  { label: "variant_label", kind: "new" },
];

const CHIP_CLASS: Record<ChipKind, string> = {
  required: "bg-green-200 border-green-300 text-green-900",
  optional: "bg-white border-green-200 text-green-800",
  new: "bg-blue-50 border-blue-400 text-blue-700",
};

export default function AdminGoogleSheets() {
  const [step, setStep] = useState<Step>("input");
  const [sheetUrl, setSheetUrl] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [colMap, setColMap] = useState<ColMap>({ ...DEFAULT_MAP });
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    added: number;
    updated: number;
    errors: number;
  } | null>(null);

  const handleDownloadTemplate = () => {
    try {
      downloadProductTemplate();
      toast.success(
        "Template downloaded — open in Google Sheets via File → Import"
      );
    } catch {
      toast.error("Failed to generate template");
    }
  };

  const handleFetch = async () => {
    if (!sheetUrl.trim()) {
      toast.error("Please enter a Google Sheets URL or ID");
      return;
    }
    setIsFetching(true);
    try {
      const csv = await fetchGoogleSheetAsCsv(sheetUrl);
      const parsed = Papa.parse<Record<string, string>>(csv, {
        header: true,
        skipEmptyLines: true,
        transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, "_"),
      });
      if (!parsed.data.length) throw new Error("Sheet appears to be empty");
      setHeaders(parsed.meta.fields ?? []);
      setRawRows(parsed.data as Record<string, string>[]);

      const fields = parsed.meta.fields ?? [];
      const autoMap: ColMap = { ...DEFAULT_MAP };
      for (const key of Object.keys(autoMap) as (keyof ColMap)[]) {
        const match = fields.find(f => f.includes(key) || key.includes(f));
        if (match) autoMap[key] = match;
      }
      setColMap(autoMap);
      setStep("mapping");
      toast.success(`Fetched ${parsed.data.length} rows from Google Sheets`);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch sheet");
    } finally {
      setIsFetching(false);
    }
  };

  const handlePreview = () => {
    const mapped = rawRows
      .map(r => mapRow(r, colMap))
      .filter(Boolean) as ImportRow[];
    if (!mapped.length) {
      toast.error(
        "No valid rows after mapping. Check your column assignments."
      );
      return;
    }
    setPreview(mapped);
    setStep("preview");
  };

  const handleImport = async () => {
    setStep("importing");
    setProgress(0);
    try {
      const res = await bulkImportProducts(
        preview,
        "google-sheets",
        (done, total) => {
          setProgress(Math.round((done / total) * 100));
        }
      );
      setResult({
        added: res.added,
        updated: res.updated,
        errors: res.errors.length,
      });
      setStep("done");
    } catch (err: any) {
      toast.error(err.message || "Import failed");
      setStep("preview");
    }
  };

  const reset = () => {
    setStep("input");
    setSheetUrl("");
    setHeaders([]);
    setRawRows([]);
    setPreview([]);
    setProgress(0);
    setResult(null);
    setColMap({ ...DEFAULT_MAP });
  };

  const REQUIRED_FIELDS: (keyof ColMap)[] = ["name", "unit"];
  const OPTIONAL_FIELDS: (keyof ColMap)[] = [
    "master_name",
    "variant_label",
    "category",
    "price",
    "sku",
    "barcode",
    "moq",
    "mrp",
    "quantity_in_unit",
    "brand",
    "description",
    "is_featured",
    "status",
    "tags",
    "na_fields",
  ];

  return (
    <div className="space-y-6">
      {/* Single header — the template download lives inside the card below, with
          context, so there is exactly ONE primary download CTA on this page. */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Google Sheets Import
        </h1>
        <p className="text-slate-400 text-xs mt-0.5">
          Sync your product catalogue directly from a Google Spreadsheet
        </p>
      </div>

      {/* Template call-to-action banner */}
      {step === "input" && (
        <Card className="p-5 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-green-900">
                Start with our ready-made template
              </p>
              <p className="text-sm text-green-700 mt-0.5">
                Download the XLSX template → fill in your products → upload to
                Google Drive → import below. Includes sample data, instructions
                sheet, and all supported columns.
              </p>
              <p className="text-sm text-green-700 mt-1.5">
                <strong>Required:</strong> name, unit.{" "}
                <strong>Optional:</strong> everything else including price
                (blank price = "Price on enquiry" on the website).{" "}
                <strong>New:</strong> status (draft/published), master_name +
                variant_label (for size variants), tags (business types),
                na_fields.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                {COLUMN_CHIPS.map(({ label, kind }) => (
                  <span
                    key={label}
                    className={`px-2 py-0.5 rounded-full border ${CHIP_CLASS[kind]}`}
                  >
                    {kind === "required" ? `${label} ✱` : label}
                  </span>
                ))}
              </div>
            </div>
            <Button
              onClick={handleDownloadTemplate}
              className="bg-green-600 hover:bg-green-700 gap-2 flex-shrink-0"
              size="sm"
            >
              <Download className="w-4 h-4" />
              Download Template (.xlsx)
            </Button>
          </div>
        </Card>
      )}

      {/* Instructions */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 space-y-1">
            <p className="font-semibold">How to share your Google Sheet:</p>
            <ol className="list-decimal ml-4 space-y-0.5">
              <li>Open the sheet in Google Sheets</li>
              <li>
                Click <strong>Share</strong> →{" "}
                <strong>Anyone with the link</strong> → <strong>Viewer</strong>
              </li>
              <li>Copy the URL and paste it below</li>
            </ol>
            <p className="mt-2">
              Alternatively:{" "}
              <strong>File → Share → Publish to web → CSV</strong> and paste
              that URL.
            </p>
          </div>
        </div>
      </Card>

      {/* Step: Input */}
      {step === "input" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetUrl}
                onChange={e => setSheetUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleFetch()}
              />
            </div>
            <Button
              onClick={handleFetch}
              disabled={isFetching}
              className="gap-2"
            >
              {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isFetching ? "Fetching..." : "Connect Sheet"}
            </Button>
          </div>
        </div>
      )}

      {/* Step: Column Mapping */}
      {step === "mapping" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-800">
                Map your columns ({rawRows.length} rows detected)
              </p>
              <p className="text-sm text-slate-500 mt-0.5">
                We auto-detected the columns below. Adjust if needed.
              </p>
            </div>
          </div>

          <Card className="p-5 space-y-4">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Required Fields
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {REQUIRED_FIELDS.map(field => (
                  <div key={field}>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 capitalize">
                      {field.replace(/_/g, " ")}{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                      value={colMap[field]}
                      onChange={e =>
                        setColMap({ ...colMap, [field]: e.target.value })
                      }
                    >
                      <option value="">— skip —</option>
                      {headers.map(h => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Optional Fields
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {OPTIONAL_FIELDS.map(field => (
                  <div key={field}>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 capitalize">
                      {field.replace(/_/g, " ")}
                    </label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                      value={colMap[field]}
                      onChange={e =>
                        setColMap({ ...colMap, [field]: e.target.value })
                      }
                    >
                      <option value="">— skip —</option>
                      {headers.map(h => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={reset}>
              Back
            </Button>
            <Button onClick={handlePreview}>Preview Import →</Button>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-800">
              {preview.length} products ready to import
            </p>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {[
                      "Name",
                      "Category",
                      "SKU",
                      "Price (₹)",
                      "Unit",
                      "Qty",
                      "Brand",
                    ].map(h => (
                      <th
                        key={h}
                        className="px-4 py-2 text-left font-semibold text-slate-700"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 15).map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-4 py-2 text-slate-900 max-w-[200px] truncate">
                        {row.name}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {row.category}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">
                        {row.sku || "—"}
                      </td>
                      <td className="px-4 py-2 font-semibold text-slate-900">
                        {row.price != null ? (
                          `₹${row.price.toLocaleString()}`
                        ) : (
                          <span className="text-slate-400 font-normal">
                            On enquiry
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{row.unit}</td>
                      <td className="px-4 py-2 text-slate-600">
                        {row.quantity_in_unit}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {row.brand || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.length > 15 && (
              <div className="px-4 py-3 bg-slate-50 border-t text-sm text-slate-500">
                … and {preview.length - 15} more products
              </div>
            )}
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("mapping")}>
              Back
            </Button>
            <Button onClick={handleImport} className="flex-1">
              Import {preview.length} Products
            </Button>
          </div>
        </div>
      )}

      {/* Step: Importing */}
      {step === "importing" && (
        <Card className="p-10 text-center space-y-5">
          <Loader2 className="w-12 h-12 text-red-600 animate-spin mx-auto" />
          <div>
            <p className="text-lg font-semibold text-slate-900">
              Importing products…
            </p>
            <p className="text-sm text-slate-500 mt-1">{progress}% complete</p>
          </div>
          <div className="w-full max-w-sm mx-auto bg-slate-100 rounded-full h-3">
            <div
              className="bg-red-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </Card>
      )}

      {/* Step: Done */}
      {step === "done" && result && (
        <div className="space-y-4">
          <Card className="p-6 bg-green-50 border-green-200">
            <div className="flex gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-green-900 text-lg">
                  Import Complete!
                </p>
                <p className="text-green-700 text-sm mt-1">
                  ✅ {result.added} added · 🔄 {result.updated} updated
                  {result.errors > 0 ? ` · ❌ ${result.errors} errors` : ""}
                </p>
              </div>
            </div>
          </Card>
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 text-center">
              <p className="text-3xl font-bold text-green-600">
                {result.added}
              </p>
              <p className="text-sm text-slate-600 mt-1">Added</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">
                {result.updated}
              </p>
              <p className="text-sm text-slate-600 mt-1">Updated</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-3xl font-bold text-red-600">{result.errors}</p>
              <p className="text-sm text-slate-600 mt-1">Errors</p>
            </Card>
          </div>
          <Button variant="outline" onClick={reset} className="w-full">
            Import Another Sheet
          </Button>
        </div>
      )}
    </div>
  );
}
