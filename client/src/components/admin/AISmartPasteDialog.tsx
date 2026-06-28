import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Sparkles,
  Loader2,
  Check,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { parseProductDetailsWithAI, ParsedProduct } from "@/lib/aiService";
import { Category } from "@/lib/supabase";

interface Props {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  onAutofill: (data: ParsedProduct) => void;
}

export default function AISmartPasteDialog({
  open,
  onClose,
  categories,
  onAutofill,
}: Props) {
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParsedProduct | null>(null);

  // Editable result fields
  const [editedResult, setEditedResult] = useState<ParsedProduct>({});

  const handleParse = async () => {
    if (!text.trim()) {
      toast.error("Please paste some product text first");
      return;
    }
    setParsing(true);
    setResult(null);

    try {
      const categoryNames = categories.map(c => c.name);
      const parsedData = await parseProductDetailsWithAI(text, categoryNames);

      setResult(parsedData);
      setEditedResult(parsedData);
      toast.success("Successfully parsed details!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to parse details. Please verify your text.");
    } finally {
      setParsing(false);
    }
  };

  const handleAutofillConfirm = () => {
    if (!editedResult.name) {
      toast.error("Product Name is required to autofill");
      return;
    }
    onAutofill(editedResult);
    setText("");
    setResult(null);
    onClose();
  };

  const handleReset = () => {
    setText("");
    setResult(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500 animate-pulse" />
            AI Smart Product Entry
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs">
            Paste product text copied from another website, catalog, PDF, or
            WhatsApp below.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {/* Input area */}
            <div className="space-y-1.5">
              <Label
                htmlFor="smart-text"
                className="text-xs font-semibold text-slate-700"
              >
                Paste Product Text
              </Label>
              <Textarea
                id="smart-text"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Example:
Round Container 500ml box of 250 pcs.
Price: 350. MRP: 400. Brand: XL Traders.
Ideal for food packing, microwavable containers."
                className="min-h-[180px] text-sm font-sans border-slate-200 focus:border-red-500"
                disabled={parsing}
              />
            </div>

            {/* Hint Box */}
            <div className="flex gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500">
              <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="font-semibold text-slate-700 mb-0.5">
                  Quick Copy-Paste Tips:
                </p>
                <p>
                  1. Go to any product page (Amazon, IndiaMART, or other
                  supplier sites).
                </p>
                <p>
                  2. Select the product details text (or press Ctrl+A to select
                  all) and copy it.
                </p>
                <p>
                  3. Paste it here. AI will clean up noise and extract the
                  correct values automatically!
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 justify-end pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={parsing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleParse}
                disabled={parsing}
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5 font-bold"
              >
                {parsing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Extract Details
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-emerald-800 text-xs">
              <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
              <span>
                AI has extracted the following details! Review and edit if
                needed.
              </span>
            </div>

            {/* Editable Form Grid */}
            <Card className="p-4 border-slate-200 shadow-sm bg-white space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-semibold text-slate-500">
                    Product Name
                  </Label>
                  <Input
                    value={editedResult.name || ""}
                    onChange={e =>
                      setEditedResult({ ...editedResult, name: e.target.value })
                    }
                    className="h-9 text-sm border-slate-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500">
                    Price (₹)
                  </Label>
                  <Input
                    type="number"
                    value={editedResult.price != null ? editedResult.price : ""}
                    onChange={e =>
                      setEditedResult({
                        ...editedResult,
                        price: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                    className="h-9 text-sm border-slate-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500">
                    MRP (₹)
                  </Label>
                  <Input
                    type="number"
                    value={editedResult.mrp != null ? editedResult.mrp : ""}
                    onChange={e =>
                      setEditedResult({
                        ...editedResult,
                        mrp: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                    className="h-9 text-sm border-slate-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500">
                    Unit of Measure
                  </Label>
                  <Input
                    value={editedResult.unit_of_measure || ""}
                    onChange={e =>
                      setEditedResult({
                        ...editedResult,
                        unit_of_measure: e.target.value,
                      })
                    }
                    className="h-9 text-sm border-slate-200"
                    placeholder="pcs, box, pack, roll, etc."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500">
                    Quantity in Unit
                  </Label>
                  <Input
                    type="number"
                    value={
                      editedResult.quantity_in_unit != null
                        ? editedResult.quantity_in_unit
                        : ""
                    }
                    onChange={e =>
                      setEditedResult({
                        ...editedResult,
                        quantity_in_unit: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    className="h-9 text-sm border-slate-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500">
                    Brand
                  </Label>
                  <Input
                    value={editedResult.brand || ""}
                    onChange={e =>
                      setEditedResult({
                        ...editedResult,
                        brand: e.target.value,
                      })
                    }
                    className="h-9 text-sm border-slate-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500">
                    AI Category Suggestion
                  </Label>
                  <Input
                    value={editedResult.category_name || ""}
                    onChange={e =>
                      setEditedResult({
                        ...editedResult,
                        category_name: e.target.value,
                      })
                    }
                    className="h-9 text-sm border-slate-200"
                    placeholder="e.g. Round Container"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-semibold text-slate-500">
                    Description
                  </Label>
                  <Textarea
                    value={editedResult.description || ""}
                    onChange={e =>
                      setEditedResult({
                        ...editedResult,
                        description: e.target.value,
                      })
                    }
                    className="min-h-[60px] text-sm border-slate-200"
                  />
                </div>
              </div>
            </Card>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" size="sm" onClick={handleReset}>
                Parse Another
              </Button>
              <Button
                onClick={handleAutofillConfirm}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-bold"
              >
                <Check className="w-4 h-4" />
                Populate Form
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
