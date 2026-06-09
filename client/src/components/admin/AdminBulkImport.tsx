import { useState } from 'react';
import { Upload, Download, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  parseCSV,
  parseExcel,
  bulkImportProducts,
  exportProductsAsCSV,
  generateCSVTemplate,
  ImportRow,
  ImportResult,
} from '@/lib/bulkImportService';
import { toast } from 'sonner';

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

export default function AdminBulkImport() {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exporting, setExporting] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsLoading(true);
    try {
      let result;
      if (selectedFile.name.endsWith('.csv')) {
        result = await parseCSV(selectedFile);
      } else if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        result = await parseExcel(selectedFile);
      } else {
        toast.error('Please upload a CSV or Excel file');
        return;
      }
      setParsedRows(result.rows);
      setParseErrors(result.errors);
      if (result.rows.length > 0) {
        setStep('preview');
        toast.success(`Parsed ${result.rows.length} products from ${selectedFile.name}`);
      } else {
        toast.error('No valid rows found in file');
      }
    } catch (error) {
      toast.error('Error parsing file');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    setIsLoading(true);
    setStep('importing');
    setProgress(0);
    try {
      const result = await bulkImportProducts(parsedRows, (done, total) => {
        setProgress(Math.round((done / total) * 100));
      });
      setImportResult(result);
      setStep('complete');
      toast.success(result.summary);
    } catch (error) {
      toast.error('Import failed');
      console.error(error);
      setStep('preview');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setParsedRows([]);
    setParseErrors([]);
    setImportResult(null);
    setProgress(0);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportProductsAsCSV();
      toast.success('Products exported as CSV');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Bulk Import — CSV / Excel</h2>
        <p className="text-slate-500 text-sm mt-1">
          Import or update multiple products at once. Existing products (matched by name) will be updated.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" className="gap-2" onClick={generateCSVTemplate}>
          <FileText className="w-4 h-4" />
          Download Template
        </Button>
        <Button variant="outline" className="gap-2" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export All Products
        </Button>
      </div>

      {/* Upload */}
      {step === 'upload' && (
        <Card className="p-8">
          <label
            htmlFor="bulk-file-input"
            className={`flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-14 text-center cursor-pointer hover:border-red-400 hover:bg-red-50 transition-colors ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {isLoading ? (
              <Loader2 className="w-12 h-12 text-red-600 animate-spin mb-4" />
            ) : (
              <Upload className="w-12 h-12 text-slate-400 mb-4" />
            )}
            <p className="text-lg font-semibold text-slate-800 mb-1">
              {isLoading ? 'Parsing file…' : 'Drop your file here or click to browse'}
            </p>
            <p className="text-sm text-slate-500">CSV, XLSX, or XLS — any size</p>
            <input
              type="file"
              id="bulk-file-input"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              disabled={isLoading}
              className="hidden"
            />
          </label>

          {/* Column guide */}
          <div className="mt-6 bg-slate-50 rounded-xl p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-700 mb-2">Required column headers:</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {['name ✱', 'category ✱', 'price ✱', 'unit ✱', 'quantity_in_unit ✱', 'mrp', 'description', 'brand', 'is_featured'].map((col) => (
                <code key={col} className="bg-white border border-slate-200 rounded px-2 py-1 text-xs">{col}</code>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">✱ Required. Headers are case-insensitive.</p>
          </div>
        </Card>
      )}

      {/* Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          {parseErrors.length > 0 && (
            <Card className="p-4 bg-yellow-50 border-yellow-200">
              <div className="flex gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                <p className="font-semibold text-yellow-900">{parseErrors.length} row(s) with errors (skipped)</p>
              </div>
              <ul className="text-sm text-yellow-800 space-y-0.5">
                {parseErrors.slice(0, 6).map((err, i) => <li key={i}>• {err}</li>)}
                {parseErrors.length > 6 && <li>• … and {parseErrors.length - 6} more</li>}
              </ul>
            </Card>
          )}

          <Card>
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <p className="font-semibold text-slate-900">
                {parsedRows.length} products ready to import
                {file && <span className="text-slate-400 font-normal ml-2 text-sm">from {file.name}</span>}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {['Name', 'Category', 'Price (₹)', 'MRP (₹)', 'Unit', 'Qty'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold text-slate-700">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 15).map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-900 max-w-[200px] truncate">{row.name}</td>
                      <td className="px-4 py-2 text-slate-600">{row.category}</td>
                      <td className="px-4 py-2 font-semibold">₹{row.price.toLocaleString()}</td>
                      <td className="px-4 py-2 text-slate-500">{row.mrp ? `₹${row.mrp.toLocaleString()}` : '—'}</td>
                      <td className="px-4 py-2 text-slate-600">{row.unit}</td>
                      <td className="px-4 py-2 text-slate-600">{row.quantity_in_unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedRows.length > 15 && (
              <div className="px-4 py-3 bg-slate-50 border-t text-sm text-slate-500">
                … and {parsedRows.length - 15} more products
              </div>
            )}
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset}>Cancel</Button>
            <Button onClick={handleImport} disabled={isLoading} className="flex-1">
              Import {parsedRows.length} Products
            </Button>
          </div>
        </div>
      )}

      {/* Importing */}
      {step === 'importing' && (
        <Card className="p-10 text-center space-y-5">
          <Loader2 className="w-12 h-12 text-red-600 animate-spin mx-auto" />
          <div>
            <p className="text-lg font-semibold text-slate-900">Importing products…</p>
            <p className="text-sm text-slate-500 mt-1">
              {progress}% — {Math.round((progress / 100) * parsedRows.length)} of {parsedRows.length} done
            </p>
          </div>
          <div className="w-full max-w-sm mx-auto">
            <div className="w-full bg-slate-100 rounded-full h-3">
              <div
                className="bg-red-600 h-3 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Complete */}
      {step === 'complete' && importResult && (
        <div className="space-y-4">
          <Card className="p-6 bg-green-50 border-green-200">
            <div className="flex gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-green-900 text-lg">Import Complete</p>
                <p className="text-green-700 text-sm mt-1">{importResult.summary}</p>
              </div>
            </div>
          </Card>

          {importResult.errors.length > 0 && (
            <Card className="p-4 bg-red-50 border-red-200">
              <p className="font-semibold text-red-900 mb-3">Failed rows:</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {importResult.errors.map((err, i) => (
                  <div key={i} className="text-sm text-red-800 bg-white rounded p-2">
                    <span className="font-semibold">Row {err.row}:</span> {err.error}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{importResult.added}</p>
              <p className="text-sm text-slate-600 mt-1">Added</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{importResult.updated}</p>
              <p className="text-sm text-slate-600 mt-1">Updated</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-3xl font-bold text-red-600">{importResult.errors.length}</p>
              <p className="text-sm text-slate-600 mt-1">Errors</p>
            </Card>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset} className="flex-1">Import Another File</Button>
            <Button onClick={() => window.location.reload()} className="flex-1">View Updated Products</Button>
          </div>
        </div>
      )}
    </div>
  );
}
