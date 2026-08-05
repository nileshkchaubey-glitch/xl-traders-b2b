import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Building2,
  ChevronRight,
  FileText,
  LogOut,
  MapPin,
  MessageCircle,
  Package,
  Pencil,
  Phone,
  Receipt,
  RotateCcw,
  ScrollText,
  Share2,
  Shield,
  Truck,
  type LucideIcon,
} from "lucide-react";
import Header from "@/components/Header";
import { useAuthStore } from "@/lib/authStore";
import { orderService } from "@/lib/orderService";
import { Order } from "@/lib/supabase";
import { formatRupees } from "@/lib/priceUtils";
import { settingsService, FALLBACKS } from "@/lib/settingsService";
import { toast } from "sonner";

/**
 * Account (docs/DESIGN_SYSTEM.md §4).
 *
 * Two states, ONE component tree: signed out shows the sign-in block and the
 * rows an account unlocks; signed in shows the business, its orders and its
 * GSTIN. The rows themselves are the same list in both states — a new buyer
 * can see what an account is actually for rather than being told.
 *
 * This screen is also where the legal furniture lives. The homepage carries no
 * address, GSTIN or policy links: someone looking for those is doing paperwork,
 * and paperwork belongs in the account, not under the product grid.
 *
 * Bulk quote stays open to guests — it needs no account and never has.
 */

interface RowLink {
  icon: LucideIcon;
  label: string;
  sub?: string;
  href?: string;
  external?: boolean;
  accent?: boolean;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-meta font-medium uppercase tracking-[0.16em] text-ink-faint mb-3">
      {children}
    </div>
  );
}

function Row({ row, trailing }: { row: RowLink; trailing?: React.ReactNode }) {
  const body = (
    <>
      <row.icon
        size={18}
        className={`flex-none ${row.accent ? "text-red-600" : "text-ink-faint"}`}
        strokeWidth={1.75}
      />
      <div className="flex-1 min-w-0">
        <div
          className={`text-body ${row.sub ? "font-semibold" : "font-normal"} text-ink`}
        >
          {row.label}
        </div>
        {row.sub && (
          <div className="text-micro text-ink-faint mt-0.5">{row.sub}</div>
        )}
      </div>
      {trailing ?? (
        <ChevronRight size={16} className="flex-none text-ink-faint" />
      )}
    </>
  );

  const cls =
    "flex items-center gap-3.5 py-3.5 border-b border-rule-soft w-full text-left hover:bg-quiet transition-colors duration-150";

  if (row.external && row.href) {
    return (
      <a
        href={row.href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
      >
        {body}
      </a>
    );
  }
  return (
    <Link href={row.href ?? "#"} className={cls}>
      {body}
    </Link>
  );
}

export default function Account() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, profile, user, signOut } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [legal, setLegal] = useState(FALLBACKS.legal);

  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";
  const phone1 = import.meta.env.VITE_PHONE_1 || "9773239442";
  const prettyPhone = phone1
    .replace(/^(?:\+?91)/, "")
    .replace(/(\d{5})(\d{5})/, "$1 $2");

  useEffect(() => {
    settingsService
      .getContent("legal")
      .then(setLegal)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setOrders([]);
      return;
    }
    // Scoped by phone — see orderService.getForPhone. Returns [] when the
    // profile has no phone rather than falling back to every order.
    orderService
      .getForPhone(profile?.phone)
      .then(setOrders)
      .catch(() => {});
  }, [isAuthenticated, profile?.phone]);

  const bulkQuoteHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    "Hi XL Traders, I'd like a bulk quote. Here's my list:"
  )}`;

  const moreRows: RowLink[] = [
    { icon: Truck, label: "Shipping policy", href: "/catalog" },
    { icon: RotateCcw, label: "Returns & replacements", href: "/catalog" },
    { icon: Shield, label: "Privacy policy", href: "/catalog" },
    { icon: ScrollText, label: "Terms of use", href: "/catalog" },
    { icon: Building2, label: "About XL Traders", href: "/catalog" },
  ];

  const lockedRows: RowLink[] = [
    {
      icon: Package,
      label: "Orders",
      sub: "Order history and one-tap reorder",
    },
    { icon: MapPin, label: "Addresses", sub: "Delivery points for your shop" },
    {
      icon: Receipt,
      label: "GST details",
      sub: "GSTIN on every invoice, for input credit",
    },
  ];

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    setLocation("/");
  };

  const initials = (
    profile?.company_name ||
    profile?.contact_person ||
    user?.email ||
    "XL"
  )
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-white flex flex-col text-ink">
      <Header />

      <main className="flex-1 pb-28 md:pb-24">
        <div className="shell max-w-2xl">
          <div className="border-b-2 border-ink pt-5 pb-4 flex items-center justify-between gap-4">
            <h1 className="font-display text-display-sm font-bold tracking-[-0.025em]">
              Account
            </h1>
            <span className="font-mono text-caption font-medium uppercase tracking-[0.14em] text-ink-faint">
              {isAuthenticated ? "Signed in" : "Signed out"}
            </span>
          </div>

          {isAuthenticated ? (
            <>
              {/* ── Business identity ── */}
              <section className="py-6 border-b border-rule">
                <div className="flex items-center gap-3.5">
                  <div className="w-[54px] h-[54px] flex-none bg-ink text-white flex items-center justify-center font-mono text-[19px] font-bold">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[20px] leading-tight font-bold tracking-[-0.02em] truncate">
                      {profile?.company_name || "Your business"}
                    </div>
                    <div className="text-body-sm text-ink-faint mt-1 truncate">
                      {[profile?.contact_person, profile?.phone || user?.email]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <Pencil size={17} className="flex-none text-ink-faint" />
                </div>

                {/* The rate rule, carrying the one fact that changes what this
                    buyer sees on every other screen. */}
                <div className="border-t-2 border-ink mt-4 flex">
                  <span className="bg-wa text-white font-mono text-caption font-semibold uppercase tracking-[0.08em] px-[9px] py-1.5 whitespace-nowrap">
                    Wholesale rates active
                  </span>
                </div>
              </section>

              {/* ── Recent orders ── */}
              <section className="pt-6">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-display text-display-sm font-bold tracking-[-0.025em]">
                    Recent orders
                  </h2>
                  {orders.length > 0 && (
                    <span className="font-mono text-caption font-medium text-ink-faint tabular-nums">
                      {orders.length}
                    </span>
                  )}
                </div>

                {orders.length === 0 ? (
                  <p className="text-body-sm text-ink-muted mt-3">
                    {profile?.phone
                      ? "No orders yet. Your first order will appear here for one-tap reorder."
                      : "Add a phone number to your profile to see your order history here."}
                  </p>
                ) : (
                  <div className="mt-4 flex flex-col gap-[22px]">
                    {orders.map(o => (
                      <div key={o.id}>
                        <div className="flex items-baseline justify-between gap-2.5">
                          <span className="font-mono text-body-sm font-semibold text-ink whitespace-nowrap">
                            #{o.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className="font-mono text-caption text-ink-faint whitespace-nowrap">
                            {new Date(o.created_at).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </span>
                        </div>

                        {/* Same rate rule, carrying the order total. */}
                        <div className="border-t-2 border-ink mt-3 flex">
                          <span className="bg-ink text-white font-mono text-micro font-semibold px-2 py-[5px] whitespace-nowrap tabular-nums">
                            {formatRupees(Number(o.total_amount ?? 0))}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3 mt-2.5">
                          <span className="font-mono text-caption text-ink-faint tabular-nums">
                            {o.item_count ?? 0} item
                            {(o.item_count ?? 0) === 1 ? "" : "s"} · {o.status}
                          </span>
                          <Link
                            href="/catalog"
                            className="flex-none bg-ink text-white px-4 py-2.5 text-micro font-semibold hover:bg-red-600 transition-colors duration-150"
                          >
                            Reorder
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Business details ── */}
              <section className="pt-8">
                <SectionLabel>Business details</SectionLabel>
                <div className="border-t border-rule">
                  <Row
                    row={{
                      icon: Receipt,
                      label: "GST details",
                      sub: profile?.gst_number || "Not added yet",
                      accent: !!profile?.gst_number,
                    }}
                    trailing={
                      profile?.gst_number ? (
                        <span className="flex-none bg-wa text-white font-mono text-[9px] font-semibold uppercase tracking-[0.1em] px-2 py-1">
                          Verified
                        </span>
                      ) : undefined
                    }
                  />
                  <Row
                    row={{
                      icon: MapPin,
                      label: "Addresses",
                      sub:
                        [profile?.city, profile?.pincode]
                          .filter(Boolean)
                          .join(" · ") || "No delivery address saved",
                    }}
                  />
                  <Row
                    row={{
                      icon: FileText,
                      label: "Bulk quote request",
                      sub: "Rates for 10,000+ pieces",
                      href: bulkQuoteHref,
                      external: true,
                      accent: true,
                    }}
                  />
                </div>
              </section>
            </>
          ) : (
            <>
              {/* ── Sign in ── */}
              <section className="bg-ink px-[18px] md:px-7 py-6 md:py-7 mt-6">
                <h2 className="font-display text-[30px] leading-[1.1] font-bold text-white tracking-[-0.03em] text-pretty">
                  Your wholesale rates
                </h2>
                <p className="text-body text-ink-inverse mt-2.5 leading-relaxed">
                  Public pages show MRP. Signed in, every pack shows the rate
                  you actually pay.
                </p>
                <Link
                  href="/auth"
                  className="mt-5 w-full h-12 bg-red-600 text-white text-body-md font-semibold flex items-center justify-center hover:bg-red-700 transition-colors duration-150"
                >
                  Sign in
                </Link>
                <p className="text-body-sm text-ink-inverse mt-3.5">
                  New buyer?{" "}
                  <Link href="/auth" className="text-white font-semibold">
                    Create a business account
                  </Link>
                </p>
              </section>

              {/* ── What an account unlocks ── */}
              <section className="pt-7">
                <SectionLabel>Behind sign-in</SectionLabel>
                <div className="border-t border-rule">
                  {lockedRows.map(r => (
                    <Row
                      key={r.label}
                      row={{ ...r, href: "/auth" }}
                      trailing={
                        <span className="flex-none font-mono text-caption font-medium uppercase tracking-[0.1em] text-red-600 whitespace-nowrap">
                          Sign in
                        </span>
                      }
                    />
                  ))}
                  {/* Open to guests — a bulk quote never needed an account. */}
                  <Row
                    row={{
                      icon: FileText,
                      label: "Bulk quote request",
                      sub: "No account needed — send us a list",
                      href: bulkQuoteHref,
                      external: true,
                      accent: true,
                    }}
                  />
                </div>
              </section>
            </>
          )}

          {/* ── Talk to us — same in both states ── */}
          <section className="pt-8">
            <SectionLabel>Talk to us</SectionLabel>
            <div className="grid grid-cols-2 gap-px bg-rule border-y border-rule">
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-wa text-white px-4 pt-4 pb-[17px]"
              >
                <MessageCircle size={20} />
                <div className="text-body font-semibold mt-2.5">WhatsApp</div>
                <div className="font-mono text-micro text-emerald-100 mt-0.5 tabular-nums">
                  {prettyPhone}
                </div>
              </a>
              <a
                href={`tel:${phone1}`}
                className="bg-white text-ink px-4 pt-4 pb-[17px]"
              >
                <Phone size={20} className="text-red-600" />
                <div className="text-body font-semibold mt-2.5">Call</div>
                <div className="text-micro text-ink-faint mt-0.5">
                  Mon–Sat, 9–8
                </div>
              </a>
            </div>
          </section>

          {/* ── More ── */}
          <section className="pt-8">
            <SectionLabel>More</SectionLabel>
            <div className="border-t border-rule">
              {moreRows.map(r => (
                <Row key={r.label} row={r} />
              ))}
              <Row
                row={{ icon: Share2, label: "Share XL Traders", href: "/" }}
              />
              {isAuthenticated && (
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3.5 py-3.5 border-b border-rule-soft w-full text-left hover:bg-quiet transition-colors duration-150"
                >
                  <LogOut
                    size={17}
                    className="flex-none text-red-600"
                    strokeWidth={1.75}
                  />
                  <span className="flex-1 text-body font-semibold text-red-600">
                    Log out
                  </span>
                </button>
              )}
            </div>
          </section>

          {/* ── The legal furniture. Deliberately here and nowhere else. ──
              The GSTIN line is omitted until a real one is entered in Site
              Content; the design board's placeholder is not shipped. */}
          <p className="font-mono text-caption leading-[1.7] text-ink-faint py-6">
            {legal.entity} · {legal.address}
            <br />
            {legal.gstin ? `GSTIN ${legal.gstin} · ` : ""}
            {legal.version}
          </p>
        </div>
      </main>
    </div>
  );
}
