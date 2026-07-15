interface SectionEyebrowProps {
  children: React.ReactNode;
  tone?: "light" | "dark";
  className?: string;
}

// Shared "eyebrow" label above a section heading — standardizes the
// tracking/uppercase/color pattern that used to be re-typed per section
// (docs/STOREFRONT_DESIGN_PROPOSALS.md §5 touch #2). `tone="dark"` is for
// eyebrows sitting on a dark card (e.g. the bulk-order banner).
export default function SectionEyebrow({
  children,
  tone = "light",
  className = "",
}: SectionEyebrowProps) {
  return (
    <div
      className={`text-caption font-bold tracking-[0.12em] uppercase ${
        tone === "dark" ? "text-red-400" : "text-red-600"
      } ${className}`}
    >
      {children}
    </div>
  );
}
