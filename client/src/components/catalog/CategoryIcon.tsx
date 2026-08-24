import { Package } from "lucide-react";
import type { Category } from "@/lib/supabase";

/** Image → emoji → lucide glyph. The fallback is layered, not toggled in JS,
 *  so a category with no image still reads as something.
 *
 *  `px` sizes all three branches together. It defaults to 20 (the rail's
 *  size, unchanged); the catalogue sidebar passes 14, because the prototype's
 *  sidebar row is 28px tall and a 20px glyph makes it 34. */
export default function CategoryIcon({
  cat,
  px = 20,
}: {
  cat: Category;
  px?: number;
}) {
  const box = { width: px, height: px };

  if (cat.image_url) {
    return (
      <img
        src={cat.image_url}
        alt=""
        style={box}
        className="flex-shrink-0 rounded object-cover"
      />
    );
  }
  if (cat.icon_emoji) {
    return (
      <span
        style={{ ...box, fontSize: px * 0.8 }}
        className="flex flex-shrink-0 items-center justify-center leading-none"
      >
        {cat.icon_emoji}
      </span>
    );
  }
  return (
    <Package
      size={Math.round(px * 0.72)}
      className="flex-shrink-0 text-slate-400"
      style={{ minWidth: Math.round(px * 0.72) }}
    />
  );
}
