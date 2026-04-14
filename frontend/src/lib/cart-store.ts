import { create } from "zustand";
import type { CartItem } from "@/types";

interface CartState {
  items: CartItem[];
  source: "upahar_ghar" | "nescafe" | null;
  incentive: number;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  setIncentive: (amount: number) => void;
  clear: () => void;
  totalCost: () => number;
  totalWithIncentive: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  source: null,
  incentive: 20,

  addItem: (item) => {
    const state = get();
    // If switching source, clear cart
    if (state.source && state.source !== item.source) {
      set({ items: [{ ...item, quantity: 1 }], source: item.source });
      return;
    }
    const existing = state.items.find(
      (i) => i.menu_item_id === item.menu_item_id
    );
    if (existing) {
      set({
        items: state.items.map((i) =>
          i.menu_item_id === item.menu_item_id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
      });
    } else {
      set({
        items: [...state.items, { ...item, quantity: 1 }],
        source: item.source,
      });
    }
  },

  removeItem: (menuItemId) => {
    const items = get().items.filter((i) => i.menu_item_id !== menuItemId);
    set({ items, source: items.length > 0 ? get().source : null });
  },

  updateQuantity: (menuItemId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(menuItemId);
      return;
    }
    set({
      items: get().items.map((i) =>
        i.menu_item_id === menuItemId ? { ...i, quantity } : i
      ),
    });
  },

  setIncentive: (amount) => set({ incentive: Math.max(10, Math.min(50, amount)) }),

  clear: () => set({ items: [], source: null, incentive: 20 }),

  totalCost: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

  totalWithIncentive: () => get().totalCost() + get().incentive,
}));
