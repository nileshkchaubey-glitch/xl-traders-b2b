import { useState, useEffect, useRef } from 'react';
import { Check, X, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { masterService } from '@/lib/masterService';

const UNITS = ['pcs', 'box', 'pack', 'roll', 'kg', 'litre', 'set'];

interface VariantRowProps {
  masterId: string;
  masterSlug: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function VariantRow({ masterId, masterSlug, onSuccess, onCancel }: VariantRowProps) {
  const [label, setLabel] = useState('');
  const [sku, setSku] = useState('');
  const [isManualSku, setIsManualSku] = useState(false);
  const [price, setPrice] = useState('0');
  const [mrp, setMrp] = useState('0');
  const [moq, setMoq] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [submitting, setSubmitting] = useState(false);

  const labelInputRef = useRef<HTMLInputElement>(null);

  // Focus label field on mount
  useEffect(() => {
    labelInputRef.current?.focus();
  }, []);

  // Auto-generate SKU from label
  useEffect(() => {
    if (!isManualSku) {
      const cleanLabel = label
        .trim()
        .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special chars
        .replace(/[\s-]+/g, '-') // Replace spaces and hyphens with a single hyphen
        .toUpperCase();
      
      if (cleanLabel) {
        setSku(`${masterSlug.toUpperCase()}-${cleanLabel}`);
      } else {
        setSku('');
      }
    }
  }, [label, masterSlug, isManualSku]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!label.trim()) {
      toast.error('Variant label is required');
      return;
    }

    setSubmitting(true);
    try {
      await masterService.addVariant({
        master_id: masterId,
        variant_label: label.trim(),
        price: parseFloat(price) || 0,
        mrp: parseFloat(mrp) || 0,
        moq: parseInt(moq) || 1,
        unit_of_measure: unit,
        sku: sku.trim() || undefined,
      });

      toast.success('Variant added ✓');
      
      // Clear form but keep focus
      setLabel('');
      setPrice('0');
      setMrp('0');
      setMoq('1');
      setUnit('pcs');
      setIsManualSku(false);
      
      onSuccess();
      
      // Refocus label input
      setTimeout(() => {
        labelInputRef.current?.focus();
      }, 50);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to add variant');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* ── DESKTOP LAYOUT (Table Row) ── */}
      <tr className="hidden sm:table-row bg-slate-50 border-t border-slate-200">
        <td className="p-3">
          <Input
            ref={labelInputRef}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. 250ml"
            className="h-8 text-xs max-w-[120px]"
            disabled={submitting}
          />
        </td>
        <td className="p-3">
          <div className="flex items-center gap-1">
            <Input
              value={sku}
              onChange={(e) => {
                setSku(e.target.value);
                setIsManualSku(true);
              }}
              placeholder="SKU"
              className="h-8 text-xs max-w-[150px] font-mono"
              disabled={submitting}
            />
            {!isManualSku && (
              <button 
                type="button"
                onClick={() => setIsManualSku(true)}
                className="text-slate-400 hover:text-slate-600 p-1"
                title="Edit SKU manually"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </td>
        <td className="p-3">
          <Input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            className="h-8 text-xs max-w-[90px]"
            disabled={submitting}
          />
        </td>
        <td className="p-3">
          <Input
            type="number"
            value={mrp}
            onChange={(e) => setMrp(e.target.value)}
            placeholder="0.00"
            className="h-8 text-xs max-w-[90px]"
            disabled={submitting}
          />
        </td>
        <td className="p-3">
          <Input
            type="number"
            value={moq}
            onChange={(e) => setMoq(e.target.value)}
            placeholder="1"
            className="h-8 text-xs max-w-[70px]"
            disabled={submitting}
          />
        </td>
        <td className="p-3">
          <Select value={unit} onValueChange={setUnit} disabled={submitting}>
            <SelectTrigger className="h-8 text-xs max-w-[90px]">
              <SelectValue placeholder="unit" />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map(u => (
                <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td className="p-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              onClick={() => handleSave()}
              disabled={submitting}
              title="Add Variant"
            >
              <Check className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-slate-400 hover:text-slate-500 hover:bg-slate-100"
              onClick={onCancel}
              disabled={submitting}
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </td>
      </tr>

      {/* ── MOBILE LAYOUT (Stacked Form Card) ── */}
      <div className="sm:hidden block p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3 mt-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Add New Variant</h4>
        
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">Variant Label *</label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. 250ml"
            className="h-9 text-sm"
            disabled={submitting}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
            <span>SKU (auto)</span>
            <button 
              type="button" 
              onClick={() => setIsManualSku(true)} 
              className="text-indigo-600 hover:text-indigo-800 text-[10px] lowercase flex items-center gap-0.5"
            >
              <Edit2 className="w-2.5 h-2.5" /> Edit SKU
            </button>
          </label>
          <Input
            value={sku}
            onChange={(e) => {
              setSku(e.target.value);
              setIsManualSku(true);
            }}
            placeholder="SKU Code"
            className="h-9 text-sm font-mono"
            disabled={submitting}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Price ₹</label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="h-9 text-sm"
              disabled={submitting}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">MRP ₹</label>
            <Input
              type="number"
              value={mrp}
              onChange={(e) => setMrp(e.target.value)}
              placeholder="0.00"
              className="h-9 text-sm"
              disabled={submitting}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">MOQ</label>
            <Input
              type="number"
              value={moq}
              onChange={(e) => setMoq(e.target.value)}
              placeholder="1"
              className="h-9 text-sm"
              disabled={submitting}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Unit</label>
            <Select value={unit} onValueChange={setUnit} disabled={submitting}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="unit" />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map(u => (
                  <SelectItem key={u} value={u} className="text-sm">{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-slate-200">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1"
            onClick={onCancel}
            disabled={submitting}
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white gap-1"
            onClick={() => handleSave()}
            disabled={submitting}
          >
            <Check className="w-3.5 h-3.5" />
            Add Variant
          </Button>
        </div>
      </div>
    </>
  );
}
