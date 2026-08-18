import type { ReactNode } from "react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

/**
 * The one storefront shell.
 *
 * Before this, all eight customer-facing pages imported and rendered their own
 * <Header /> and <Footer /> inside a near-identical wrapper div. Nothing was
 * double-rendering — each page had exactly one of each — but a layout change
 * meant eight edits, which is how the mobile footer went unreviewed: an 880px,
 * 13-link desktop footer was rendering under a 5-tab bottom nav on every page
 * and no single file was responsible for noticing.
 *
 * ⚠️ Do NOT render <MobileNav /> here. It is rendered inside Header.tsx
 * (`Header.tsx:597`) and that is its ONLY render site — verified by grep before
 * this component was written. Adding it here would double it.
 *
 * <main> deliberately stays with each page: its bottom padding is page-specific
 * (pb-24 for the mobile nav, pb-28 on Cart, pb-40 on ProductDetail for the
 * sticky action bar, and Auth centres its content instead), so hoisting it here
 * would flatten four different clearances into one wrong one.
 */
export default function StorefrontLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Header />
      {children}
      <Footer />
    </div>
  );
}
