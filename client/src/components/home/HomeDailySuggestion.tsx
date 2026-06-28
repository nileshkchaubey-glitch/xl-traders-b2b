import { useState } from "react";
import { X, Lightbulb, ChevronLeft, ChevronRight } from "lucide-react";
import { DAILY_SUGGESTIONS, getTodaysSuggestion } from "@/lib/dailySuggestions";

const PRIORITY_COLORS = {
  High: "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-slate-100 text-slate-600 border-slate-200",
};

const IMPACT_COLORS = {
  Conversion: "bg-emerald-100 text-emerald-700",
  Design: "bg-purple-100 text-purple-700",
  Catalog: "bg-blue-100 text-blue-700",
  Mobile: "bg-orange-100 text-orange-700",
  SEO: "bg-teal-100 text-teal-700",
};

export default function HomeDailySuggestion() {
  const today = getTodaysSuggestion();
  const [dismissed, setDismissed] = useState(false);
  const [current, setCurrent] = useState(today);

  if (dismissed) return null;

  const currentIndex = DAILY_SUGGESTIONS.findIndex(s => s.id === current.id);

  const prev = () => {
    const idx =
      (currentIndex - 1 + DAILY_SUGGESTIONS.length) % DAILY_SUGGESTIONS.length;
    setCurrent(DAILY_SUGGESTIONS[idx]);
  };

  const next = () => {
    const idx = (currentIndex + 1) % DAILY_SUGGESTIONS.length;
    setCurrent(DAILY_SUGGESTIONS[idx]);
  };

  return (
    <section className="py-8 bg-slate-900">
      <div className="max-w-3xl mx-auto px-4">
        <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-5 md:p-6">
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition"
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20">
              <Lightbulb size={16} className="text-yellow-400" />
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Daily Improvement · {currentIndex + 1}/{DAILY_SUGGESTIONS.length}
            </p>
          </div>

          <h3 className="text-white font-bold text-base md:text-lg mb-3 pr-6">
            {current.title}
          </h3>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">
            {current.note}
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${PRIORITY_COLORS[current.priority]}`}
            >
              {current.priority} Priority
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${IMPACT_COLORS[current.impact]}`}
            >
              {current.impact} Impact
            </span>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-700">
            <span className="text-xs text-slate-500">
              Dev-only · Rotates daily
            </span>
            <div className="flex gap-2">
              <button
                onClick={prev}
                className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
                aria-label="Previous suggestion"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={next}
                className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
                aria-label="Next suggestion"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
