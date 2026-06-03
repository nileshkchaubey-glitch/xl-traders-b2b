import { MessageCircle } from 'lucide-react';

/**
 * Floating WhatsApp button — always-visible conversion CTA.
 * Sits bottom-right on every page so bulk buyers can reach out in one tap.
 */
export default function WhatsAppFloat() {
  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || '919773239442';
  const message = 'Hi XL Traders, I would like to enquire about your products.';
  const href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Enquire on WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-green-600 px-4 py-3 text-white shadow-lg transition hover:bg-green-700 hover:shadow-xl active:scale-95"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="hidden sm:inline text-sm font-semibold">Enquire</span>
    </a>
  );
}
