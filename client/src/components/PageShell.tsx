import type { ReactNode } from "react";
import Header from "./Header";
import Footer from "./Footer";

interface PageShellProps {
  children: ReactNode;
  headerVariant?: "default" | "home";
  bg?: string;
}

export default function PageShell({
  children,
  headerVariant = "default",
  bg = "bg-slate-50",
}: PageShellProps) {
  return (
    <div className={`min-h-screen ${bg} flex flex-col`}>
      <Header variant={headerVariant} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
