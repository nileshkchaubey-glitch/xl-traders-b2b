import { Link, useLocation } from "wouter";
import {
  LayoutGrid,
  FilePlus,
  Image as ImageIcon,
  Layers,
  Sparkles,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/admin-v2/products", label: "Product Grid", icon: LayoutGrid },
  { to: "/admin-v2/products/new", label: "Product Entry", icon: FilePlus },
  { to: "/admin-v2/images", label: "Image Library", icon: ImageIcon },
  { to: "/admin-v2/variants", label: "Variants", icon: Layers },
  { to: "/admin-v2/ai", label: "AI Workspace", icon: Sparkles },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-full w-[220px] bg-[#1a1d27] flex flex-col flex-shrink-0">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.07]">
        <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
          <span className="text-white font-black text-sm leading-none">XL</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-none">XL Traders</p>
          <p className="text-slate-500 text-[11px] mt-0.5">Admin v2</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const active = location === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
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
