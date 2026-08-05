import { MessageCircle } from "lucide-react";

/**
 * The storefront footer (docs/DESIGN_SYSTEM.md §3.7).
 *
 * Deliberately almost empty: a logo and one WhatsApp affordance, separated
 * from the page by a single hairline. The address, GSTIN and legal links that
 * used to live in a four-column dark footer now sit at the bottom of the
 * Account screen and in About — a buyer looking for the GSTIN is doing
 * paperwork, and paperwork lives in the account, not under the product grid.
 *
 * The four-column category/company/ordering link farm is gone with it. On this
 * site categories are the first section of the homepage, so repeating them
 * under the fold was the same duplication the trust surfaces had.
 */
export default function Footer() {
  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";
  const displayNumber = import.meta.env.VITE_PHONE_1 || "9773239442";
  // "9773239442" → "97732 39442", the way it is written on the van.
  const pretty = displayNumber
    .replace(/^(?:\+?91)/, "")
    .replace(/(\d{5})(\d{5})/, "$1 $2");

  return (
    <footer className="mt-auto border-t border-rule bg-white">
      <div className="shell py-[18px] md:py-6 flex items-center justify-between gap-3">
        <img
          src="/images/brand/xl-traders-logo.png"
          alt="XL Traders"
          className="h-[26px] md:h-[30px] w-auto block flex-none"
        />
        <a
          href={`https://wa.me/${whatsappNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-none flex items-center gap-2 border border-rule text-wa rounded-full px-3.5 md:px-4 py-2.5 hover:border-wa transition-colors duration-150"
        >
          <MessageCircle size={16} className="flex-none" />
          <span className="text-body-sm font-semibold whitespace-nowrap">
            WhatsApp {pretty}
          </span>
        </a>
      </div>
    </footer>
  );
}
