import { enquiryService } from "./productService";
import { openWhatsApp } from "./whatsapp";
import type { Product, UserProfile } from "./supabase";

interface EnquiryUser {
  id: string;
  email?: string | null;
}

export async function submitEnquiryAndOpenWhatsApp(opts: {
  product: Product;
  isAuthenticated: boolean;
  user: EnquiryUser | null;
  profile: UserProfile | null;
}): Promise<void> {
  const { product, isAuthenticated, user, profile } = opts;

  if (isAuthenticated && user) {
    try {
      await enquiryService.create({
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
      });
    } catch (err) {
      console.error("Failed to save enquiry:", err);
    }
  }

  const message = isAuthenticated
    ? `Hi, I'm interested in: ${product.name}\n\nPrice: ₹${product.price}\nQuantity: ${product.quantity_in_unit} ${product.unit_of_measure}\n\nPlease provide more details and availability.`
    : `Hi, I'm interested in: ${product.name}\n\nQuantity: ${product.quantity_in_unit} ${product.unit_of_measure}\n\nCould you please share the price and availability?`;

  openWhatsApp(message);
}
