import { Link } from "wouter";
import { Mail, Phone, MapPin, Facebook, Linkedin, Twitter } from "lucide-react";

export default function Footer() {
  const businessName = import.meta.env.VITE_BUSINESS_NAME || "XL Traders";
  const businessCity = import.meta.env.VITE_BUSINESS_CITY || "Surat";
  const businessState = import.meta.env.VITE_BUSINESS_STATE || "Gujarat";
  const businessCountry = import.meta.env.VITE_BUSINESS_COUNTRY || "India";
  const email = import.meta.env.VITE_EMAIL || "xltraders990@gmail.com";
  const phone1 = import.meta.env.VITE_PHONE_1 || "9773239442";
  const phone2 = import.meta.env.VITE_PHONE_2 || "7778052990";
  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";

  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-300 mt-20">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Company Info */}
          <div>
            <h3 className="text-xl font-bold text-white mb-4">
              <span className="text-red-600">XL</span> Traders
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Premium wholesale packaging and disposables supplier serving
              businesses across India.
            </p>
            <div className="flex gap-3">
              <a
                href={`https://facebook.com`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-slate-800 rounded hover:bg-red-600 transition"
              >
                <Facebook size={16} />
              </a>
              <a
                href={`https://linkedin.com`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-slate-800 rounded hover:bg-red-600 transition"
              >
                <Linkedin size={16} />
              </a>
              <a
                href={`https://twitter.com`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-slate-800 rounded hover:bg-red-600 transition"
              >
                <Twitter size={16} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/"
                  className="text-slate-400 hover:text-red-500 transition"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog"
                  className="text-slate-400 hover:text-red-500 transition"
                >
                  Product Catalog
                </Link>
              </li>
              <li>
                <Link
                  href="/auth"
                  className="text-slate-400 hover:text-red-500 transition"
                >
                  Sign In
                </Link>
              </li>
              <li>
                <a
                  href="#contact"
                  className="text-slate-400 hover:text-red-500 transition"
                >
                  Contact Us
                </a>
              </li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-semibold text-white mb-4">Categories</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/catalog?category=round-container"
                  className="text-slate-400 hover:text-red-500 transition"
                >
                  Food Containers
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog?category=paper-cup"
                  className="text-slate-400 hover:text-red-500 transition"
                >
                  Paper Cups
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog?category=paper-box"
                  className="text-slate-400 hover:text-red-500 transition"
                >
                  Carry Bags
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog?category=aluminum-containers"
                  className="text-slate-400 hover:text-red-500 transition"
                >
                  Aluminium Containers
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog?category=meal-tray"
                  className="text-slate-400 hover:text-red-500 transition"
                >
                  Meal Trays
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog?category=pizza-box"
                  className="text-slate-400 hover:text-red-500 transition"
                >
                  Pizza Boxes
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog?category=cling-wrap"
                  className="text-slate-400 hover:text-red-500 transition"
                >
                  Wrapping Films
                </Link>
              </li>
              <li>
                <Link
                  href="/catalog"
                  className="text-slate-400 hover:text-red-500 transition"
                >
                  View All →
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-semibold text-white mb-4">Contact Us</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-2">
                <MapPin
                  size={16}
                  className="flex-shrink-0 text-red-500 mt-0.5"
                />
                <span className="text-slate-400">
                  {businessCity}, {businessState}
                  <br />
                  {businessCountry}
                </span>
              </li>
              <li className="flex gap-2">
                <Phone
                  size={16}
                  className="flex-shrink-0 text-red-500 mt-0.5"
                />
                <div className="text-slate-400">
                  <a
                    href={`tel:${phone1}`}
                    className="hover:text-red-500 transition block"
                  >
                    {phone1}
                  </a>
                  <a
                    href={`tel:${phone2}`}
                    className="hover:text-red-500 transition block"
                  >
                    {phone2}
                  </a>
                </div>
              </li>
              <li className="flex gap-2">
                <Mail size={16} className="flex-shrink-0 text-red-500 mt-0.5" />
                <a
                  href={`mailto:${email}`}
                  className="text-slate-400 hover:text-red-500 transition"
                >
                  {email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800 pt-8">
          {/* Bottom Bar */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
            <p>
              &copy; {currentYear} {businessName}. All rights reserved.
            </p>
            <div className="flex gap-6">
              <a href="#privacy" className="hover:text-red-500 transition">
                Privacy Policy
              </a>
              <a href="#terms" className="hover:text-red-500 transition">
                Terms of Service
              </a>
              <a href="#cookies" className="hover:text-red-500 transition">
                Cookie Policy
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
