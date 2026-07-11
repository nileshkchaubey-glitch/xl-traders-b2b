import { useState } from "react";
import { Link } from "wouter";
import {
  LayoutDashboard,
  Package,
  Images,
  Menu,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NAV_GROUPS,
  BREADCRUMB,
  MOBILE_PRIMARY_IDS,
} from "@/components/admin/adminNav";

// Bottom-bar tabs (mobile presentation only). The section list itself comes
// from the shared adminNav config; these are just the four promoted entries.
const PRIMARY_TABS = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  // Phase 2b: products tab now opens the Catalog Editor (AdminProducts removed).
  { id: "catalog-editor", label: "Products", icon: Package },
  { id: "image-library", label: "Images", icon: Images },
];

interface MobileAdminShellProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSignOut: () => void;
  userEmail?: string;
  /** Optional primary action rendered in the top bar (right side). */
  action?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Mobile-only admin chrome: fixed top bar + bottom tab navigation wrapping the
 * SAME section content the desktop layout renders. No section logic lives here.
 */
export default function MobileAdminShell({
  activeTab,
  onTabChange,
  onSignOut,
  userEmail,
  action,
  children,
}: MobileAdminShellProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const inMoreSection = !MOBILE_PRIMARY_IDS.includes(activeTab);
  const primary = PRIMARY_TABS.find(t => t.id === activeTab);
  const title = moreOpen
    ? "More"
    : (primary?.label ?? BREADCRUMB[activeTab]?.label ?? "Admin");
  // A back affordance only makes sense when drilled into a "More" section.
  const showBack = !moreOpen && inMoreSection;

  const goPrimary = (id: string) => {
    onTabChange(id);
    setMoreOpen(false);
  };

  return (
    <div className="flex flex-col h-screen bg-admin-bg overflow-hidden">
      {/* ── Top bar ── */}
      <header className="flex items-center gap-2 h-14 px-3 bg-white border-b border-slate-200 flex-shrink-0">
        {showBack ? (
          <button
            onClick={() => setMoreOpen(true)}
            className="w-9 h-9 -ml-1 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition"
            aria-label="Back to More"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-sm leading-none">XL</span>
          </div>
        )}
        <h1 className="flex-1 min-w-0 truncate font-semibold text-slate-900 text-[15px]">
          {title}
        </h1>
        <div className="flex items-center gap-1 flex-shrink-0">
          {action}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition"
            aria-label="View store"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 overflow-auto">
        {/* Section content stays mounted (preserves state) and is hidden when
            the More list is open. */}
        <div className={moreOpen ? "hidden" : "px-4 py-4"}>{children}</div>
        {moreOpen && (
          <MoreList
            activeTab={activeTab}
            userEmail={userEmail}
            onPick={id => {
              onTabChange(id);
              setMoreOpen(false);
            }}
            onSignOut={onSignOut}
          />
        )}
      </main>

      {/* ── Bottom tab bar ── */}
      <nav className="flex-shrink-0 bg-white border-t border-slate-200 flex items-stretch h-16">
        {PRIMARY_TABS.map(t => {
          const active = !moreOpen && activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => goPrimary(t.id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] active:bg-slate-50 transition"
              aria-current={active ? "page" : undefined}
            >
              <t.icon
                className={cn("w-5 h-5", active ? "text-red-600" : "text-slate-400")}
              />
              <span
                className={cn(
                  "text-[11px] font-medium",
                  active ? "text-red-600" : "text-slate-500"
                )}
              >
                {t.label}
              </span>
            </button>
          );
        })}
        <button
          onClick={() => setMoreOpen(v => !v)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] active:bg-slate-50 transition"
          aria-current={moreOpen ? "page" : undefined}
        >
          <Menu
            className={cn(
              "w-5 h-5",
              moreOpen || inMoreSection ? "text-red-600" : "text-slate-400"
            )}
          />
          <span
            className={cn(
              "text-[11px] font-medium",
              moreOpen || inMoreSection ? "text-red-600" : "text-slate-500"
            )}
          >
            More
          </span>
        </button>
      </nav>
    </div>
  );
}

// ── "More" list — every section not promoted to the bottom bar ───────────────
function MoreList({
  activeTab,
  userEmail,
  onPick,
  onSignOut,
}: {
  activeTab: string;
  userEmail?: string;
  onPick: (id: string) => void;
  onSignOut: () => void;
}) {
  return (
    <div className="px-4 py-4 space-y-6">
      {NAV_GROUPS.map(group => {
        const items = group.items.filter(
          i => !MOBILE_PRIMARY_IDS.includes(i.id)
        );
        if (items.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-2 px-1">
              {group.label}
            </p>
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
              {items.map(item => {
                const inner = (
                  <>
                    <item.icon className="w-5 h-5 text-slate-500 flex-shrink-0" />
                    <span className="flex-1 text-[14px] font-medium text-slate-800">
                      {item.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </>
                );
                // Masters is its own route, matching the desktop sidebar.
                if (item.id === "masters") {
                  return (
                    <Link
                      key={item.id}
                      to="/admin/masters"
                      className="flex items-center gap-3 px-4 py-3 min-h-[48px] active:bg-slate-50 transition"
                    >
                      {inner}
                    </Link>
                  );
                }
                return (
                  <button
                    key={item.id}
                    onClick={() => onPick(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-left active:bg-slate-50 transition",
                      activeTab === item.id && "bg-red-50"
                    )}
                  >
                    {inner}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Account */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-2 px-1">
          Account
        </p>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 text-[13px] text-slate-500 border-b border-slate-100 truncate">
            {userEmail ?? "Administrator"}
          </div>
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-left text-red-600 active:bg-red-50 transition"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="text-[14px] font-medium">Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
