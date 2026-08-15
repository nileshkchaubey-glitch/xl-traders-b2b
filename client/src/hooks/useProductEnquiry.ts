import { useCallback } from "react";
import type { Product } from "@/lib/supabase";
import { useAuthStore } from "@/lib/authStore";
import { enquiryService, inquiriesService } from "@/lib/productService";

const WA_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";

/**
 * "Enquire on WhatsApp" for one product.
 *
 * Extracted out of ProductCard, which was performing two service writes and
 * composing a WhatsApp message inline — a presentational component reaching
 * straight into the data layer. The card now emits an intent and this hook owns
 * the side effects.
 *
 * Note the two DIFFERENT tables, which CLAUDE.md warns are distinct by design
 * and must not be merged:
 *   * `inquiries` — a lightweight click log, written for everyone.
 *   * `enquiries` — a real B2B lead, only for a signed-in user.
 *
 * The message never contains a price. A guest has no price to leak, and for a
 * signed-in buyer the rate belongs in the reply, not in a prefilled string they
 * could forward.
 */
export function useProductEnquiry() {
  const { isAuthenticated, user, profile } = useAuthStore();

  return useCallback(
    (product: Product) => {
      const message = isAuthenticated
        ? `Hi, I'm interested in: ${product.name}${product.sku ? ` (${product.sku})` : ""}. Please share your best rate and availability.`
        : `Hi, I'm interested in: ${product.name}. Could you please share the rate and more details?`;

      // Opened synchronously inside the click so the popup blocker allows it.
      window.open(
        `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer"
      );

      // Fire-and-forget: a logging failure must never break the WhatsApp handoff.
      inquiriesService
        .create({
          customer_name: isAuthenticated
            ? profile?.contact_person || profile?.company_name || user?.email || ""
            : "",
          phone: (isAuthenticated && profile?.phone) || "",
          message,
          product_name: product.name,
          source: "website",
        })
        .catch(() => {});

      if (isAuthenticated && user) {
        enquiryService
          .create({
            user_id: user.id,
            product_id: product.id,
            customer_name:
              profile?.contact_person ||
              profile?.company_name ||
              user.email ||
              "Customer",
            customer_email: profile?.email || user.email || "",
            customer_phone: profile?.phone || "",
            customer_company: profile?.company_name,
            quantity_requested: 1,
            enquiry_source: "whatsapp",
            status: "new",
          })
          .catch(() => {});
      }
    },
    [isAuthenticated, user, profile]
  );
}
