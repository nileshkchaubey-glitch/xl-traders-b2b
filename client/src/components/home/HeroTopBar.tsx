import { useState } from 'react';
import { useLocation } from 'wouter';
import { MapPin, Search, Phone, MessageCircle, FileText, Zap } from 'lucide-react';

interface HeroTopBarProps {
  whatsappNumber: string;
  phone: string;
}

export default function HeroTopBar({ whatsappNumber, phone }: HeroTopBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [, setLocation] = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/catalog?search=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
    }
  };

  const quoteMessage = encodeURIComponent(
    'Hi XL Traders, I need a wholesale quote for packaging supplies. Please share pricing.'
  );

  return (
    <div className="border-b border-slate-200/80 bg-white">
      <div className="max-w-7xl mx-auto px-4 py-3 md:py-4 space-y-3">
        {/* Delivery location */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600">
              <MapPin size={16} />
            </span>
            <div>
              <span className="font-semibold text-slate-900">Surat, Gujarat</span>
              <span className="mx-2 text-slate-300">|</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <Zap size={14} className="fill-emerald-500 text-emerald-500" />
                Fast Delivery
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 hidden sm:block">
            Serving restaurants, cafes, cloud kitchens &amp; caterers
          </p>
        </div>

        {/* Search + actions */}
        <div className="flex flex-col lg:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="flex rounded-xl border-2 border-slate-200 bg-slate-50/80 shadow-sm transition focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-500/10">
              <div className="flex items-center pl-4 text-slate-400">
                <Search size={20} />
              </div>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search containers, cups, carry bags, boxes..."
                className="flex-1 bg-transparent px-3 py-3.5 md:py-4 text-sm md:text-base text-slate-900 placeholder:text-slate-400 outline-none"
                aria-label="Search products"
              />
              <button
                type="submit"
                className="m-1.5 rounded-lg bg-red-600 px-5 md:px-8 text-sm font-semibold text-white hover:bg-red-700 transition"
              >
                Search
              </button>
            </div>
          </form>

          <div className="flex gap-2 shrink-0">
            <a
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Hi, I need packaging supplies from XL Traders.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition shadow-sm"
            >
              <MessageCircle size={18} />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
            <a
              href={`tel:${phone}`}
              className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:border-red-300 hover:text-red-600 transition"
            >
              <Phone size={18} />
              <span className="hidden sm:inline">Call Now</span>
            </a>
            <a
              href={`https://wa.me/${whatsappNumber}?text=${quoteMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              <FileText size={18} />
              <span className="hidden sm:inline">Get Quote</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
