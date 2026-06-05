import { WHATSAPP_NUMBER } from "./contactConfig";

export function buildWhatsAppUrl(
  message: string,
  phone: string = WHATSAPP_NUMBER
): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function openWhatsApp(
  message: string,
  phone: string = WHATSAPP_NUMBER
): void {
  window.open(buildWhatsAppUrl(message, phone), "_blank");
}
