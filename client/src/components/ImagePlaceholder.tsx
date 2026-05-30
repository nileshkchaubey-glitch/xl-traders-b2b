import { Package } from "lucide-react";

interface ImagePlaceholderProps {
  className?: string;
  showText?: boolean;
}

export function ImagePlaceholder({
  className = "w-full h-full",
  showText = true,
}: ImagePlaceholderProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 ${className}`}
    >
      <Package className="w-12 h-12 text-slate-500 mb-2" />
      {showText && (
        <p className="text-slate-600 text-xs font-medium">XL Traders</p>
      )}
    </div>
  );
}
