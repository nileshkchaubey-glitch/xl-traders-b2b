import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Truck, Shield, Zap, Users } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import HomeHero from '@/components/home/HomeHero';
import { categoryService, productService } from '@/lib/productService';
import { Product } from '@/lib/supabase';

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const products = await productService.getFeatured(6);
        setFeaturedProducts(products);
      } catch (error) {
        console.error('Error loading home data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || '919773239442';
  const phone1 = import.meta.env.VITE_PHONE_1 || '9773239442';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header variant="home" />

      <main className="flex-1 pb-20 md:pb-0">
        <HomeHero whatsappNumber={whatsappNumber} phone={phone1} />

        {/* Featured Products Section */}
        <section className="py-16 md:py-24 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-12">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                  Featured Products
                </h2>
                <p className="text-slate-600">
                  Our most popular packaging solutions
                </p>
              </div>
              <Link href="/catalog" className="text-red-600 font-semibold hover:text-red-700 flex items-center gap-1 transition">
                View All <ArrowRight size={18} />
              </Link>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-slate-500">Loading products...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Why Choose XL Traders?
              </h2>
              <p className="text-slate-600 text-lg">
                We&apos;re committed to quality, reliability, and exceptional service
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="bg-white border border-slate-200 rounded-xl p-8 hover:shadow-lg transition">
                <div className="text-4xl mb-4 text-red-600">
                  <Truck />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">Fast Delivery</h3>
                <p className="text-slate-600 text-sm">
                  Same-day delivery available in Surat. Quick turnaround on bulk orders.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-8 hover:shadow-lg transition">
                <div className="text-4xl mb-4 text-red-600">
                  <Shield />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">Quality Assured</h3>
                <p className="text-slate-600 text-sm">
                  Premium materials, rigorous quality checks, and certified suppliers.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-8 hover:shadow-lg transition">
                <div className="text-4xl mb-4 text-red-600">
                  <Zap />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">Competitive Pricing</h3>
                <p className="text-slate-600 text-sm">
                  Best wholesale rates with volume discounts and flexible payment terms.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-8 hover:shadow-lg transition">
                <div className="text-4xl mb-4 text-red-600">
                  <Users />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">Expert Support</h3>
                <p className="text-slate-600 text-sm">
                  Dedicated WhatsApp support and consultation for your packaging needs.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-gradient-to-r from-red-600 to-red-700 text-white py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Order?
            </h2>
            <p className="text-lg text-red-100 mb-8">
              Contact us today for bulk orders, custom quotes, and special requests
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={`tel:${phone1}`}
                className="inline-flex items-center justify-center gap-2 bg-white text-red-600 font-bold py-3 px-8 rounded-lg hover:bg-red-50 transition"
              >
                📞 Call Now
              </a>
              <a
                href={`https://wa.me/${whatsappNumber}?text=Hi, I'm interested in placing an order. Can you help me?`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-green-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-600 transition"
              >
                💬 WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
