import { Package } from "lucide-react";
import type { Category } from "@/lib/supabase";

/** Image → emoji → lucide glyph. The fallback is layered, not toggled in JS,
 *  so a category with no image still reads as something. */
export default function CategoryIcon({ cat }: { cat: Category }) {
  if (cat.image_url) {
    return (
      <img
        src={cat.image_url}
        alt=""
        className="h-5 w-5 flex-shrink-0 rounded object-cover"
      />
    );
  }
  if (cat.icon_emoji) {
    return (
      <span className="flex-shrink-0 text-base leading-none">
        {cat.icon_emoji}
      </span>
    );
  }
  return <Package size={14} className="flex-shrink-0 text-slate-400" />;
}
