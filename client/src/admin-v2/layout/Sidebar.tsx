import { Link, useLocation } from "wouter";
import {
  LayoutGrid,
  FilePlus,
  Image as ImageIcon,
  Layers,
  Sparkles,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/admin-v2/products", label: "Product Grid", icon: LayoutGrid },
  { to: "/admin-v2/products/new", label: "Product Entry", icon: FilePlus },
  { to: "/admin-v2/images", label: "Image Library", icon: ImageIcon },
  { to: "/admin-v2/variants", label: "Variants", icon: Layers },
  { to: "/admin-v2/ai", label: "AI Workspace", icon: Sparkles },
];

interface SidebarProps {
  // Drawer state — only affects mobile (< lg). On desktop the sidebar is
  // `lg:static` and always visible regardless of `open`.
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const [location] = useLocation();

  return (
    <aside
      className={`fixed left-0 top-0 h-full w-[220px] bg-[#1a1d27] flex flex-col z-50 transition-transform duration-200
        ${open ? "translate-x-0" : "-translate-x-full"} lg:static lg:translate-x-0 flex-shrink-0`}
    >
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.07]">
        <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
          <span className="text-white font-black text-sm leading-none">XL</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-none">XL Traders</p>
          <p className="text-slate-500 text-[11px] mt-0.5">Admin v2</p>
        </div>
        {/* Mobile-only close button */}
        <button
          className="lg:hidden text-slate-400 hover:text-white"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const active = location === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all text-left
                ${
                  active
                    ? "bg-red-600 text-white shadow-sm shadow-red-900/30"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.07]"
                }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
