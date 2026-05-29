import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Truck, Shield, Zap, Users } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { categoryService, productService } from '@/lib/productService';
import { Category, Product } from '@/lib/supabase';

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [cats, products] = await Promise.all([
          categoryService.getAll(),
          productService.getFeatured(6),
        ]);
        setCategories(cats);
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Left Content */}
              <div>
                <div className="inline-flex items-center gap-2 bg-red-500/20 text-red-300 px-4 py-2 rounded-full mb-6 text-sm font-semibold">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  Trusted by 500+ Businesses
                </div>

                <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
                  Premium Wholesale <span className="text-red-500">Packaging</span> Solutions
                </h1>

                <p className="text-lg text-slate-300 mb-8 leading-relaxed">
                  Quality disposable containers, food packaging, and supplies for restaurants, catering, and retail businesses across India. Fast delivery. GST invoicing.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/catalog" className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition">
                    Browse Catalog
                    <ArrowRight size={20} />
                  </Link>
                  <a
                    href={`https://wa.me/${whatsappNumber}?text=Hi, I'm interested in your packaging products. Can you share the catalog?`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-6 rounded-lg border border-white/20 transition"
                  >
                    💬 WhatsApp Us
                  </a>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mt-12">
                  <div>
                    <p className="text-3xl font-bold text-red-500">500+</p>
                    <p className="text-sm text-slate-400">Happy Customers</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-red-500">1000+</p>
                    <p className="text-sm text-slate-400">Products</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-red-500">24h</p>
                    <p className="text-sm text-slate-400">Delivery</p>
                  </div>
                </div>
              </div>

              {/* Right Image */}
              <div className="hidden md:block">
                <div className="bg-gradient-to-br from-red-500/20 to-red-500/5 rounded-2xl p-8 border border-red-500/20">
                  <div className="aspect-square bg-slate-800 rounded-xl flex items-center justify-center text-7xl">
                    📦
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Browse by Category
              </h2>
              <p className="text-slate-600 text-lg">
                Explore our wide range of packaging solutions
              </p>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-slate-500">Loading categories...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.slice(0, 6).map((category) => (
                  <Link key={category.id} href={`/catalog?category=${category.slug}`}>
                    <div className="bg-white border border-slate-200 rounded-lg p-8 hover:shadow-lg hover:border-red-300 transition cursor-pointer text-center">
                      <div className="text-5xl mb-4">{category.icon_emoji || '📦'}</div>
                      <h3 className="font-bold text-lg text-slate-900 mb-2">{category.name}</h3>
                      <p className="text-sm text-slate-600 mb-4">{category.description}</p>
                      <div className="text-red-600 font-semibold text-sm flex items-center justify-center gap-1">
                        Explore <ArrowRight size={16} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Featured Products Section */}
        <section className="py-16 md:py-24 bg-white">
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
        <section className="py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Why Choose XL Traders?
              </h2>
              <p className="text-slate-600 text-lg">
                We're committed to quality, reliability, and exceptional service
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Feature 1 */}
              <div className="bg-white border border-slate-200 rounded-lg p-8 hover:shadow-lg transition">
                <div className="text-4xl mb-4 text-red-600">
                  <Truck />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">Fast Delivery</h3>
                <p className="text-slate-600 text-sm">
                  Same-day delivery available in Surat. Quick turnaround on bulk orders.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white border border-slate-200 rounded-lg p-8 hover:shadow-lg transition">
                <div className="text-4xl mb-4 text-red-600">
                  <Shield />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">Quality Assured</h3>
                <p className="text-slate-600 text-sm">
                  Premium materials, rigorous quality checks, and certified suppliers.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white border border-slate-200 rounded-lg p-8 hover:shadow-lg transition">
                <div className="text-4xl mb-4 text-red-600">
                  <Zap />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">Competitive Pricing</h3>
                <p className="text-slate-600 text-sm">
                  Best wholesale rates with volume discounts and flexible payment terms.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="bg-white border border-slate-200 rounded-lg p-8 hover:shadow-lg transition">
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
