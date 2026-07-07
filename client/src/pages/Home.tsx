import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroMotionTiles from "@/components/home/HeroMotionTiles";
import HomeCategoryGrid from "@/components/home/HomeCategoryGrid";
import HomeFeaturedProducts from "@/components/home/HomeFeaturedProducts";
import HomeDailySuggestion from "@/components/home/HomeDailySuggestion";
import {
  MessageCircle,
  ArrowRight,
  Star,
  Check,
  Lock,
  Plus,
  Minus,
  MapPin,
} from "lucide-react";
import { productService } from "@/lib/productService";
import { useAuthStore } from "@/lib/authStore";

// Shared scroll-reveal: sections fade up once as they enter the viewport.
const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const TRUST_STATS = [
  { value: "4.8★", label: "Google Rating", sub: "From local businesses" },
  { value: "10+", label: "Years in Business", sub: "Wholesale since day one" },
  { value: "500+", label: "Businesses Served", sub: "Restaurants to kirana" },
  { value: "24h", label: "Dispatch Promise", sub: "Same-day in Surat" },
];

const TRUST_POINTS = [
  {
    glyph: "GST",
    title: "GST-registered wholesaler",
    body: "Proper GST invoice with every order — claim your input credit.",
  },
  {
    glyph: "₹",
    title: "Transparent wholesale pricing",
    body: "Sign in to see exact prices; bulk orders unlock better rates.",
  },
  {
    glyph: "✓",
    title: "Quality-checked supply",
    body: "Food-grade materials from verified manufacturers.",
  },
];

const SERVICE_AREAS = [
  "Surat City",
  "Udhna",
  "Katargam",
  "Varachha",
  "Navsari",
  "Bardoli",
  "Ankleshwar",
  "Pan-India",
];

const FAQS = [
  {
    q: "What is the minimum order quantity?",
    a: "Each product shows its own MOQ. The cart checks MOQ before you order so there are no surprises later.",
  },
  {
    q: "Do you deliver outside Surat?",
    a: "Yes — same-day in Surat city, next-day across South Gujarat, and 2–4 days pan-India via surface transport.",
  },
  {
    q: "Do I get a GST invoice?",
    a: "Every order ships with a GST invoice. Share your GSTIN on WhatsApp once and it is applied to all future orders.",
  },
  {
    q: "Can I get custom printing on bags and boxes?",
    a: "Yes, for bulk orders. Use the Bulk Quote button and we respond within 2 business hours with slab pricing.",
  },
];

export default function Home() {
  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";
  const isDev = import.meta.env.DEV;
  const { isAuthenticated } = useAuthStore();
  const [brands, setBrands] = useState<string[]>([]);
  const [openFaq, setOpenFaq] = useState(-1);

  useEffect(() => {
    productService
      .getBrands()
      .then(b => setBrands(b.slice(0, 10)))
      .catch(() => {});
  }, []);

  const bulkQuoteHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hi XL Traders, I need a bulk / custom order quote.")}`;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      <Header />

      <main className="flex-1 pb-20 md:pb-0">
        {/* ── HERO ── */}
        <section className="relative overflow-hidden border-b border-slate-100 bg-[radial-gradient(1000px_500px_at_20%_0%,#fef2f2_0%,#ffffff_55%)]">
          {/* Ambient blobs */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-red-100/50 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 left-1/3 w-80 h-80 rounded-full bg-amber-100/40 blur-3xl"
          />
          <div className="relative max-w-7xl mx-auto px-4 lg:px-8 py-12 lg:py-14 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-600 mb-5 shadow-sm">
                <span className="flex items-center gap-1 text-amber-700">
                  <Star size={13} className="fill-amber-500 text-amber-500" />
                  4.8 on Google
                </span>
                <span className="text-slate-300">·</span>
                <span>500+ businesses served</span>
              </div>
              <h1 className="text-4xl lg:text-[46px] font-extrabold tracking-tight leading-[1.08] mb-4">
                Packaging Solutions For{" "}
                <span className="text-red-600">Growing Businesses</span>
              </h1>
              <p className="text-base text-slate-600 max-w-md mb-6">
                Wholesale food containers, paper cups, carry bags, corrugated
                boxes and restaurant supplies. Order in under a minute —
                delivered same-day in Surat.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-7">
                <Link
                  href="/catalog"
                  className="inline-flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-3.5 rounded-xl text-[15px] font-bold hover:bg-red-700 transition shadow-[0_6px_20px_rgba(220,38,38,0.28)]"
                >
                  Browse Products
                  <ArrowRight size={16} />
                </Link>
                <a
                  href={bulkQuoteHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-white text-emerald-700 border-[1.5px] border-emerald-200 px-6 py-3.5 rounded-xl text-[15px] font-bold hover:bg-emerald-50 transition"
                >
                  <MessageCircle size={16} />
                  Get Quote on WhatsApp
                </a>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium text-slate-700">
                {[
                  "Bulk wholesale pricing",
                  "24h dispatch",
                  "GST invoice on every order",
                ].map(t => (
                  <span key={t} className="flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-600" strokeWidth={3} />
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Hero motion tiles — auto-rotating product imagery */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, delay: 0.15, ease: "easeOut" }}
            >
              <HeroMotionTiles />
            </motion.div>
          </div>
        </section>

        {/* ── MARQUEE STRIP — brands when we have enough, value props otherwise ── */}
        <section className="bg-white border-b border-slate-100 py-3.5 overflow-hidden">
          <div
            className="relative"
            style={{
              maskImage:
                "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            }}
          >
            <div className="xl-marquee flex w-max items-center gap-10">
              {(() => {
                const entries =
                  brands.length >= 4
                    ? brands.map(b => ({
                        label: b,
                        href: `/catalog?brand=${encodeURIComponent(b)}`,
                      }))
                    : [
                        "Same-day delivery in Surat",
                        "GST invoice on every order",
                        "500+ businesses served",
                        "Bulk slab pricing",
                        "24h dispatch pan-India",
                        "Food-grade materials",
                        ...brands.map(b => b),
                      ].map(label => ({ label, href: "/catalog" }));
                return [...entries, ...entries].map((e, i) => (
                  <Link
                    key={`${e.label}-${i}`}
                    href={e.href}
                    className="flex items-center gap-2.5 text-[13px] font-extrabold tracking-wide text-slate-400 hover:text-red-600 transition whitespace-nowrap uppercase"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-300" />
                    {e.label}
                  </Link>
                ));
              })()}
            </div>
          </div>
        </section>

        {/* ── SIGN-IN HOOK ── */}
        {!isAuthenticated && (
          <motion.section
            {...fadeUp}
            className="max-w-7xl mx-auto px-4 lg:px-8 pt-7 w-full"
          >
            <div className="bg-slate-900 rounded-2xl px-5 py-5 md:px-6 flex flex-col md:flex-row md:items-center gap-4">
              <div className="w-10 h-10 bg-red-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Lock size={19} className="text-red-400" />
              </div>
              <div className="flex-1">
                <div className="text-white text-[15px] font-bold">
                  Unlock exact wholesale prices in 10 seconds
                </div>
                <div className="text-slate-400 text-[13px]">
                  Sign in to see exact prices and order with one tap on
                  WhatsApp.
                </div>
              </div>
              <Link
                href="/auth"
                className="inline-flex items-center justify-center bg-red-600 text-white px-5 py-3 rounded-xl text-[13.5px] font-bold hover:bg-red-700 transition flex-shrink-0"
              >
                Sign In
              </Link>
            </div>
          </motion.section>
        )}

        {/* ── CATEGORIES (existing data-wired grid) ── */}
        <HomeCategoryGrid />

        {/* ── FEATURED PRODUCTS ── */}
        <HomeFeaturedProducts whatsappNumber={whatsappNumber} />

        {/* ── BULK BANNER ── */}
        <motion.section
          {...fadeUp}
          className="max-w-7xl mx-auto px-4 lg:px-8 py-6 w-full"
        >
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl px-6 py-8 md:px-9 flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-red-400 mb-2">
                Bulk &amp; Custom Orders
              </div>
              <div className="text-white text-xl md:text-[22px] font-extrabold tracking-tight mb-1.5">
                Ordering 10,000+ units or need custom branding?
              </div>
              <div className="text-slate-400 text-sm">
                Get a dedicated quote with slab pricing, custom printing and
                scheduled deliveries. Response within 2 business hours.
              </div>
            </div>
            <a
              href={bulkQuoteHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-3.5 rounded-xl text-[14.5px] font-bold hover:bg-red-700 transition shadow-[0_6px_20px_rgba(220,38,38,0.35)] flex-shrink-0"
            >
              Get Bulk Quote
              <ArrowRight size={16} />
            </a>
          </div>
        </motion.section>

        {/* ── TRUST ── */}
        <motion.section
          {...fadeUp}
          className="max-w-7xl mx-auto px-4 lg:px-8 py-8 w-full"
        >
          <div className="text-center mb-6">
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-red-600 mb-1">
              Why XL Traders
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">
              Built For Repeat Wholesale Buying
            </h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-3.5">
            {TRUST_STATS.map(s => (
              <div
                key={s.label}
                className="bg-white border border-slate-200 rounded-2xl p-5 text-center"
              >
                <div className="text-[26px] font-extrabold text-red-600 tracking-tight">
                  {s.value}
                </div>
                <div className="text-[13px] font-semibold mt-0.5">
                  {s.label}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-3.5">
            {TRUST_POINTS.map(tp => (
              <div
                key={tp.title}
                className="flex gap-3.5 bg-white border border-slate-200 rounded-2xl p-5"
              >
                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0 text-red-600 font-extrabold text-[15px]">
                  {tp.glyph}
                </div>
                <div>
                  <div className="text-sm font-bold">{tp.title}</div>
                  <div className="text-[12.5px] text-slate-500 mt-0.5">
                    {tp.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── SERVICE AREAS + BRANDS ── */}
        <motion.section
          {...fadeUp}
          className="max-w-7xl mx-auto px-4 lg:px-8 py-4 w-full grid md:grid-cols-2 gap-3.5"
        >
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-[14.5px] font-bold mb-3">
              <MapPin size={16} className="text-red-600" />
              Service Areas
            </div>
            <div className="text-[13px] text-slate-600 mb-3">
              <strong className="text-emerald-700">Same-day:</strong> Surat
              city · <strong>Next-day:</strong> South Gujarat ·{" "}
              <strong>2–4 days:</strong> Pan-India
            </div>
            <div className="flex flex-wrap gap-2">
              {SERVICE_AREAS.map(a => (
                <span
                  key={a}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs font-medium text-slate-700"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="text-[14.5px] font-bold mb-3">Brands We Stock</div>
            {brands.length > 0 ? (
              <div className="flex flex-wrap gap-2.5">
                {brands.map(b => (
                  <Link
                    key={b}
                    href={`/catalog?brand=${encodeURIComponent(b)}`}
                    className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13.5px] font-bold text-slate-600 hover:border-red-300 hover:text-red-600 transition"
                  >
                    {b}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-[13px] text-slate-500">
                Trusted brands plus our own XL value range at the lowest
                per-piece prices.
              </div>
            )}
          </div>
        </motion.section>

        {/* ── FAQ ── */}
        <motion.section
          {...fadeUp}
          className="max-w-3xl mx-auto px-4 lg:px-8 py-10 w-full"
        >
          <h2 className="text-[22px] font-extrabold tracking-tight text-center mb-5">
            Common Questions
          </h2>
          <div className="flex flex-col gap-2.5">
            {FAQS.map((f, i) => (
              <div
                key={f.q}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-left"
                >
                  {f.q}
                  {openFaq === i ? (
                    <Minus size={16} className="text-slate-400 flex-shrink-0" />
                  ) : (
                    <Plus size={16} className="text-slate-400 flex-shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-[13.5px] text-slate-600">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.section>

        {/* Daily improvement suggestions — dev mode only */}
        {isDev && <HomeDailySuggestion />}
      </main>

      <Footer />
    </div>
  );
}
