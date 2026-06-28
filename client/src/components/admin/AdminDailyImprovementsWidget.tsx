import { useState, useEffect } from "react";
import {
  X,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  Rocket,
  Zap,
  Trophy,
  HelpCircle,
  Check,
  Play,
} from "lucide-react";
import {
  getTodaysAdminSuggestions,
  AdminSuggestion,
} from "@/lib/adminDailyImprovements";

const PRIORITY_COLORS = {
  High: "bg-red-500/10 text-red-400 border-red-500/20",
  Medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const DOMAIN_ICONS = {
  "Product entry": Rocket,
  "Image management": Zap,
  Categories: HelpCircle,
  "PIM data quality": Trophy,
  "Search & filters": Rocket,
  "Bulk actions": Zap,
  "Missing automation": Trophy,
};

export default function AdminDailyImprovementsWidget() {
  const [dayOffset, setDayOffset] = useState(0);
  const [activeTab, setActiveTab] = useState<"quickWin" | "medium" | "major">(
    "quickWin"
  );
  const [dismissed, setDismissed] = useState(false);

  // Check if dismissed today
  useEffect(() => {
    const todayStr = new Date().toDateString();
    const dismissedDate = localStorage.getItem("admin-daily-dismissed-date");
    if (dismissedDate === todayStr) {
      setDismissed(true);
    }
  }, []);

  if (dismissed) return null;

  const suggestions = getTodaysAdminSuggestions(dayOffset);
  const activeSuggestion = suggestions[activeTab];

  const handleDismiss = () => {
    const todayStr = new Date().toDateString();
    localStorage.setItem("admin-daily-dismissed-date", todayStr);
    setDismissed(true);
  };

  const getTabLabel = (
    type: "quickWin" | "medium" | "major",
    sug: AdminSuggestion
  ) => {
    switch (type) {
      case "quickWin":
        return (
          <span className="flex items-center gap-1.5">
            <Rocket className="w-3.5 h-3.5 text-rose-500" />
            <span>Quick Win</span>
          </span>
        );
      case "medium":
        return (
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
            <span>Medium Improvement</span>
          </span>
        );
      case "major":
        return (
          <span className="flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-violet-400" />
            <span>Major (Future Feature)</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-[#1e293b] border border-slate-700/80 rounded-2xl p-5 md:p-6 text-white shadow-xl relative overflow-hidden transition-all">
      {/* Background radial highlight */}
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-yellow-500/15 flex items-center justify-center border border-yellow-500/20">
            <Lightbulb className="w-4.5 h-4.5 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              Daily Admin Improvement
              {dayOffset !== 0 && (
                <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-medium">
                  {dayOffset > 0 ? `+${dayOffset} days` : `${dayOffset} days`}
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-400 font-medium">
              Productivity and catalog optimization ideas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700/60 mr-2">
            <button
              onClick={() => setDayOffset(prev => prev - 1)}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Previous Day Suggestions"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setDayOffset(0)}
              className="px-1.5 text-[10px] font-bold text-slate-400 hover:text-white transition flex items-center"
              title="Reset to Today"
            >
              Today
            </button>
            <button
              onClick={() => setDayOffset(prev => prev + 1)}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Next Day Suggestions"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
            title="Dismiss until tomorrow"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {(["quickWin", "medium", "major"] as const).map(tab => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200
                ${
                  isActive
                    ? "bg-slate-800 text-white border-slate-600 shadow-sm"
                    : "bg-transparent text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/40"
                }`}
            >
              {getTabLabel(tab, suggestions[tab])}
            </button>
          );
        })}
      </div>

      {/* Selected suggestion content */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
              {activeSuggestion.domain}
            </span>
            <h3 className="text-base font-bold mt-1.5 text-slate-100 flex items-center gap-2">
              {activeSuggestion.title}
            </h3>
          </div>

          <div className="flex gap-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold ${PRIORITY_COLORS[activeSuggestion.priority]}`}
            >
              {activeSuggestion.priority} Priority
            </span>
          </div>
        </div>

        {/* Suggestion detail cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          {/* Problem */}
          <div className="bg-slate-900/60 rounded-lg p-3.5 border border-slate-800/60 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                <span>⚠️</span> Problem
              </p>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {activeSuggestion.problem}
              </p>
            </div>
          </div>

          {/* Solution */}
          <div className="bg-slate-900/60 rounded-lg p-3.5 border border-slate-800/60 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                <span>💡</span> Suggested Solution
              </p>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {activeSuggestion.solution}
              </p>
            </div>
          </div>

          {/* Benefit */}
          <div className="bg-slate-900/60 rounded-lg p-3.5 border border-slate-800/60 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                <span>🎯</span> Expected Benefit
              </p>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {activeSuggestion.benefit}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
