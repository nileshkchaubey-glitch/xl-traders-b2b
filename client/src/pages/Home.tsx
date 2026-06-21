import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HomeHero from "@/components/home/HomeHero";
import HomeCategoryGrid from "@/components/home/HomeCategoryGrid";
import HomeFeaturedProducts from "@/components/home/HomeFeaturedProducts";
import HomeUseCases from "@/components/home/HomeUseCases";
import HomeBrandSection from "@/components/home/HomeBrandSection";
import HomeDailySuggestion from "@/components/home/HomeDailySuggestion";
import { MessageCircle, Phone } from "lucide-react";

export default function Home() {
  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";
  const phone1 = import.meta.env.VITE_PHONE_1 || "9773239442";
  const isDev = import.meta.env.DEV;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header variant="home" />

      <main className="flex-1 pb-20 md:pb-0">
        {/* Hero + TrustStrip + BrandsSlider */}
        <HomeHero whatsappNumber={whatsappNumber} phone={phone1} />

        {/* Multi-product category grid */}
        <HomeCategoryGrid />

        {/* Featured products: Best Sellers / Trending / New Arrivals */}
        <HomeFeaturedProducts whatsappNumber={whatsappNumber} />

        {/* Business use cases */}
        <HomeUseCases />

        {/* Shop by Brand (renders only when brands exist in DB) */}
        <HomeBrandSection />

        {/* CTA Section */}
        <section className="bg-gradient-to-r from-red-600 to-red-700 text-white py-14 md:py-20">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-4xl font-bold mb-3">
              Ready to Place a Bulk Order?
            </h2>
            <p className="text-base text-red-100 mb-8 max-w-xl mx-auto">
              Contact us directly for wholesale pricing, custom requirements,
              and same-day dispatch in Surat.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={`tel:${phone1}`}
                className="inline-flex items-center justify-center gap-2 bg-white text-red-600 font-bold py-3 px-8 rounded-xl hover:bg-red-50 transition shadow-lg"
              >
                <Phone size={18} />
                Call Now
              </a>
              <a
                href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hi XL Traders, I'm ready to place a bulk order. Can you help?")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-emerald-500 text-white font-bold py-3 px-8 rounded-xl hover:bg-emerald-600 transition shadow-lg"
              >
                <MessageCircle size={18} />
                WhatsApp Us
              </a>
            </div>
          </div>
        </section>

        {/* Daily improvement suggestions — dev mode only */}
        {isDev && <HomeDailySuggestion />}
      </main>

      <Footer />
    </div>
  );
}
