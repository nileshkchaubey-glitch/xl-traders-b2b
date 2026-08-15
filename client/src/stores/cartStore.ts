import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type OrderSpec,
  type Packs,
  asPacks,
  lineTotal,
  packsFromPcs,
  snapPcsToStep,
} from "@/lib/orderingModel";

export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  /** UNCHANGED — the price of ONE PACK (selling unit). */
  price: number;
  priceOnEnquiry?: boolean;
  /**
   * RENAMED from `quantity`. Canonical, integer, in PACKS. Money multiplies
   * this and only this.
   *
   * There is deliberately NO `pcs` field: the piece count is derived at render
   * via `pcsFromPacks`, exactly as the per-piece rate is derived and never
   * stored. Persisting both would recreate the `pack_size` drift problem
   * inside localStorage, with no way to tell which number the customer chose.
   */
  packs: Packs;
  /** UNCHANGED — unit_of_measure. */
  unit: string;
  imageUrl?: string;
  /** UNCHANGED — MOQ in packs. */
  moq: number;

  // ── ordering snapshot: display + stepping only, NEVER money ──
  // Snapshotted at add-time for the same reason `price` already is: this cart
  // is persisted and the catalogue can change underneath it. The snapshot
  // never touches money, so staleness cannot produce a wrong total.
  orderUnit: OrderSpec["unit"];
  packSize: number;
  orderStep: number;
}

export interface CustomerInfo {
  name: string;
  phone: string;
}

interface CartState {
  items: CartItem[];
  customer: CustomerInfo;
  addItem: (item: Omit<CartItem, "packs">, packs?: Packs) => void;
  removeItem: (productId: string) => void;
  /** Set the line quantity in PACKS. <= 0 removes the line. */
  setPacks: (productId: string, packs: Packs) => void;
  /**
   * Set the line quantity in PIECES. Snaps to the line's own step, converts to
   * packs, delegates to setPacks — so no component ever writes a conversion
   * into a store call itself.
   */
  setPcs: (productId: string, pcs: number) => void;
  setCustomer: (customer: CustomerInfo) => void;
  clearCart: () => void;
  getTotal: () => number;
  /** Selling units across the cart. */
  getPackCount: () => number;
  /** Pieces across the cart. */
  getPieceCount: () => number;
  /** Distinct products — what the badges show. */
  getLineCount: () => number;
}

/**
 * Rebuild the OrderSpec a line was added with, from its own snapshot.
 * Exported so every surface (cart page, WhatsApp message, steppers) reads the
 * line's ordering rules the same way instead of re-deriving them.
 */
export function specOfCartItem(item: CartItem): OrderSpec {
  return {
    unit: item.orderUnit,
    packSize: item.packSize,
    step: item.orderStep,
    minPacks: item.moq,
    minPcs: Math.ceil((item.moq * item.packSize) / item.orderStep) * item.orderStep,
    noun: item.unit,
  };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      customer: { name: "", phone: "" },

      addItem: (newItem, packs) => {
        set(state => {
          const existing = state.items.find(
            i => i.productId === newItem.productId
          );
          if (existing) {
            return {
              items: state.items.map(i =>
                i.productId === newItem.productId
                  ? { ...i, packs: asPacks(i.packs + 1) }
                  : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              { ...newItem, packs: packs ?? asPacks(1) },
            ],
          };
        });
      },

      removeItem: productId => {
        set(state => ({
          items: state.items.filter(i => i.productId !== productId),
        }));
      },

      setPacks: (productId, packs) => {
        if (packs <= 0) {
          get().removeItem(productId);
          return;
        }
        set(state => ({
          items: state.items.map(i =>
            i.productId === productId ? { ...i, packs } : i
          ),
        }));
      },

      setPcs: (productId, pcs) => {
        const item = get().items.find(i => i.productId === productId);
        if (!item) return;
        const spec = specOfCartItem(item);
        const snapped = snapPcsToStep(pcs, spec);
        get().setPacks(productId, packsFromPcs(snapped, spec));
      },

      setCustomer: customer => set({ customer }),

      clearCart: () => set({ items: [], customer: { name: "", phone: "" } }),

      // The ONLY multiply-by-price outside orderingModel, and it delegates.
      getTotal: () =>
        get().items.reduce((sum, i) => sum + lineTotal(i.packs, i.price), 0),

      getPackCount: () => get().items.reduce((n, i) => n + i.packs, 0),
      getPieceCount: () =>
        get().items.reduce((n, i) => n + i.packs * i.packSize, 0),
      getLineCount: () => get().items.length,
    }),
    {
      name: "xl-cart-storage",
      // v1: `quantity` became `packs` and the ordering snapshot was added. A
      // cart persisted under the old shape has no packSize/orderStep, so it
      // cannot be converted to pieces safely — discard it rather than guess.
      // zustand drops persisted state whose version differs and no migrate is
      // supplied, which is the intended behaviour here.
      version: 1,
      partialize: state => ({ items: state.items, customer: state.customer }),
    }
  )
);
