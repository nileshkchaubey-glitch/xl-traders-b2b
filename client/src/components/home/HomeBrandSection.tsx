import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { Tag } from 'lucide-react';
import { productService } from '@/lib/productService';

export default function HomeBrandSection() {
  const [brands, setBrands] = useState<string[]>([]);

  useEffect(() => {
    productService.getBrands().then(setBrands).catch(() => setBrands([]));
  }, []);

  if (!brands.length) return null;

  return (
    <section className="py-10 md:py-14 bg-slate-50 border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-7">
          <div>
            <p className="text-red-600 text-sm font-semibold uppercase tracking-wider mb-1">
              Shop by Brand
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
              Trusted Brands
            </h2>
          </div>
          <Link
            href="/catalog"
            className="text-sm font-semibold text-red-600 hover:text-red-700 transition shrink-0"
          >
            Browse all products →
          </Link>
        </div>

        <div className="flex flex-wrap gap-3">
          {brands.map((brand, index) => (
            <motion.div
              key={brand}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.04 }}
            >
              <Link href={`/catalog?brand=${encodeURIComponent(brand)}`}>
                <div className="group flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-red-400 hover:shadow-md transition-all duration-200 cursor-pointer">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 group-hover:bg-red-100 transition">
                    <Tag size={13} className="text-red-600" />
                  </div>
                  <span className="text-sm font-semibold text-slate-800 group-hover:text-red-700 transition whitespace-nowrap">
                    {brand}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
