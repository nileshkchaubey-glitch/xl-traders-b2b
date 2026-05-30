import { motion } from 'framer-motion';
import { UtensilsCrossed, Coffee, Truck, ShoppingBag, Cake, Gift, Package, Store } from 'lucide-react';
import { Link } from 'wouter';

const USE_CASES = [
  {
    icon: UtensilsCrossed,
    name: 'Restaurants',
    description: 'Food containers, meal trays, takeaway boxes and disposable cutlery for dine-in and delivery.',
    color: 'bg-red-50 text-red-600',
    border: 'hover:border-red-200',
  },
  {
    icon: Coffee,
    name: 'Cafes & Coffee Shops',
    description: 'Premium ripple cups, paper cups, lids, cup sleeves and carry bags for your daily service.',
    color: 'bg-amber-50 text-amber-600',
    border: 'hover:border-amber-200',
  },
  {
    icon: Truck,
    name: 'Cloud Kitchens',
    description: 'Leak-proof containers, tamper-evident boxes, and delivery-safe packaging for online orders.',
    color: 'bg-blue-50 text-blue-600',
    border: 'hover:border-blue-200',
  },
  {
    icon: ShoppingBag,
    name: 'Caterers',
    description: 'Aluminum containers, meal trays and bulk disposable tableware for events and bulk catering.',
    color: 'bg-emerald-50 text-emerald-600',
    border: 'hover:border-emerald-200',
  },
  {
    icon: Cake,
    name: 'Bakery Shops',
    description: 'Pastry boxes, carry bags, tissue paper and display boxes for breads, cakes and sweets.',
    color: 'bg-pink-50 text-pink-600',
    border: 'hover:border-pink-200',
  },
  {
    icon: Gift,
    name: 'Sweet Shops',
    description: 'Attractive boxes, wrapping foils and gift-ready packaging for mithai and festive sweets.',
    color: 'bg-yellow-50 text-yellow-700',
    border: 'hover:border-yellow-200',
  },
  {
    icon: Package,
    name: 'Retail Packaging',
    description: 'Custom-printed bags, boxes, and branded packaging to give your products premium shelf appeal.',
    color: 'bg-purple-50 text-purple-600',
    border: 'hover:border-purple-200',
  },
  {
    icon: Store,
    name: 'Grocery & FMCG',
    description: 'Corrugated boxes, stretch films, wrapping paper and bulk storage containers for retail chains.',
    color: 'bg-teal-50 text-teal-600',
    border: 'hover:border-teal-200',
  },
] as const;

export default function HomeUseCases() {
  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-10">
          <p className="text-red-600 text-sm font-semibold uppercase tracking-wider mb-2">Who We Serve</p>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Packaging For Every Business</h2>
          <p className="text-slate-500 mt-3 max-w-xl mx-auto text-sm md:text-base">
            From small bakeries to large cloud kitchens — we supply the packaging that keeps your business running.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {USE_CASES.map((useCase, index) => {
            const Icon = useCase.icon;
            return (
              <motion.div
                key={useCase.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <div className={`group h-full bg-white border border-slate-200 ${useCase.border} rounded-2xl p-4 md:p-5 hover:shadow-lg transition-all duration-300`}>
                  <div className={`inline-flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl ${useCase.color} mb-3`}>
                    <Icon size={20} />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm md:text-base mb-1.5">{useCase.name}</h3>
                  <p className="text-xs md:text-sm text-slate-500 leading-relaxed line-clamp-3">{useCase.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <p className="text-slate-600 mb-4 text-sm">Can't find your business type? We supply to all food service industries.</p>
          <Link
            href="/catalog"
            className="inline-flex items-center gap-2 bg-slate-900 text-white font-semibold px-6 py-3 rounded-xl hover:bg-slate-800 transition text-sm"
          >
            Browse Full Catalog
          </Link>
        </div>
      </div>
    </section>
  );
}
