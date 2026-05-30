import { useState } from 'react';
import { Upload, Download, FileText, AlertCircle, CheckCircle } from 'lucide-react';
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
        setIsLoading(false);
        return;
      }

      setParsedRows(result.rows);
      setParseErrors(result.errors);

      if (result.rows.length > 0) {
        setStep('preview');
        toast.success(`Parsed ${result.rows.length} products`);
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

    try {
      const result = await bulkImportProducts(parsedRows);
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
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Bulk Import Products</h2>
        <p className="text-slate-600">
          Import or update multiple products at once using CSV or Excel files
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={generateCSVTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
        >
          <FileText size={18} />
          Download Template
        </button>
        <button
          onClick={() => exportProductsAsCSV()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
        >
          <Download size={18} />
          Export All Products
        </button>
      </div>

      {/* Upload Section */}
      {step === 'upload' && (
        <div className="bg-white border border-slate-200 rounded-lg p-8">
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:border-slate-400 transition cursor-pointer">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              disabled={isLoading}
              className="hidden"
              id="file-input"
            />
            <label htmlFor="file-input" className="cursor-pointer block">
              <Upload size={48} className="mx-auto mb-4 text-slate-400" />
              <p className="text-lg font-semibold text-slate-900 mb-2">
                Drop your file here or click to browse
              </p>
              <p className="text-sm text-slate-500">
                Supported formats: CSV, XLSX, XLS
              </p>
            </label>
          </div>
        </div>
      )}

      {/* Preview Section */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Parse Errors */}
          {parseErrors.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex gap-2 mb-2">
                <AlertCircle size={20} className="text-yellow-600 flex-shrink-0" />
                <p className="font-semibold text-yellow-900">
                  {parseErrors.length} parsing error(s)
                </p>
              </div>
              <ul className="space-y-1 text-sm text-yellow-800">
                {parseErrors.slice(0, 5).map((error, idx) => (
                  <li key={idx}>• {error}</li>
                ))}
                {parseErrors.length > 5 && (
                  <li>• ... and {parseErrors.length - 5} more errors</li>
                )}
              </ul>
            </div>
          )}

          {/* Preview Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <p className="font-semibold text-slate-900">
                Preview: {parsedRows.length} products ready to import
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-2 text-left font-semibold text-slate-900">
                      Product Name
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-900">
                      Category
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-900">
                      Price
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-900">
                      Unit
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-900">
                      Qty
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-900">{row.name}</td>
                      <td className="px-4 py-2 text-slate-600">{row.category}</td>
                      <td className="px-4 py-2 text-slate-900 font-semibold">
                        ₹{row.price.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{row.unit}</td>
                      <td className="px-4 py-2 text-slate-600">{row.quantity_in_unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {parsedRows.length > 10 && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-sm text-slate-600">
                ... and {parsedRows.length - 10} more products
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={isLoading}
              className="flex-1 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold disabled:opacity-50"
            >
              {isLoading ? 'Importing...' : `Import ${parsedRows.length} Products`}
            </button>
          </div>
        </div>
      )}

      {/* Importing Section */}
      {step === 'importing' && (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <div className="animate-spin inline-block mb-4">
            <Upload size={48} className="text-red-600" />
          </div>
          <p className="text-lg font-semibold text-slate-900">Importing products...</p>
          <p className="text-sm text-slate-600 mt-2">This may take a moment</p>
        </div>
      )}

      {/* Complete Section */}
      {step === 'complete' && importResult && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex gap-3 mb-4">
              <CheckCircle size={24} className="text-green-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-green-900 text-lg">Import Complete</p>
                <p className="text-green-800 mt-1">{importResult.summary}</p>
              </div>
            </div>
          </div>

          {/* Error Details */}
          {importResult.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="font-semibold text-red-900 mb-3">Failed Rows:</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {importResult.errors.map((err, idx) => (
                  <div key={idx} className="text-sm text-red-800 bg-white rounded p-2">
                    <span className="font-semibold">Row {err.row}:</span> {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{importResult.added}</p>
              <p className="text-sm text-slate-600 mt-1">Added</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{importResult.updated}</p>
              <p className="text-sm text-slate-600 mt-1">Updated</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-red-600">{importResult.errors.length}</p>
              <p className="text-sm text-slate-600 mt-1">Errors</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-semibold"
            >
              Import Another File
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
            >
              View Updated Products
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
