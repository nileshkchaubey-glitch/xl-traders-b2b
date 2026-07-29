import { Layers, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SeriesInheritanceHintProps {
  /** Name of the series the value comes from. */
  seriesName: string;
  /** The value that will be inherited. Never written into the form. */
  value: string;
  /**
   * Called when the operator chooses to write a variant-specific value. The
   * caller focuses the field; it must NOT prefill it with `value` — copying the
   * series text into the row is the exact behaviour read-through replaced.
   */
  onOverride?: () => void;
  /** Renders the value as an image thumbnail instead of text. */
  asImage?: boolean;
  className?: string;
}

/**
 * Shown beside an EMPTY inheritable field to say "this is not actually blank —
 * the series supplies it, and here is what it says".
 *
 * The read-only preview is the whole point: without it an operator working
 * through 47 series sees a blank Description and fills it in per variant, which
 * destroys the leverage read-through inheritance creates. Making it visible but
 * not writable is what keeps one description covering eleven sizes.
 */
export default function SeriesInheritanceHint({
  seriesName,
  value,
  onOverride,
  asImage = false,
  className = "",
}: SeriesInheritanceHintProps) {
  return (
    <div
      className={`rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-2 ${className}`}
    >
      <div className="flex items-start gap-2">
        <Layers className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-600">
            Inherited from series ·{" "}
            <span className="text-slate-800">{seriesName}</span>
          </p>
          {asImage ? (
            <img
              src={value}
              alt={`Primary image of the ${seriesName} series`}
              className="mt-1.5 h-14 w-14 rounded border border-slate-200 bg-white object-contain"
            />
          ) : (
            <p className="mt-0.5 line-clamp-3 text-[11px] leading-relaxed text-slate-500">
              {value}
            </p>
          )}
        </div>
      </div>
      {onOverride && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onOverride}
          className="mt-1.5 h-6 gap-1 px-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
        >
          <PenLine className="h-3 w-3" />
          Write a different value for this variant
        </Button>
      )}
    </div>
  );
}
