"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CartItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  quantity: number;
};

export type OrderSession = {
  orderType: "dine_in" | "takeaway";
  tableNumber: string | null;
  /** true kalau tableNumber didapat dari scan QR (bukan diketik manual) */
  isScanned: boolean;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  session: OrderSession;
  /** Dipanggil dari toggle/Input manual di cart-sheet — TIDAK mengosongkan keranjang */
  setManualSession: (session: Omit<OrderSession, "isScanned">) => void;
  /** Dipanggil saat ada ?table= baru dari QR — reset keranjang kalau beda dari sesi aktif */
  applyScannedTable: (table: string) => void;
  /** true setelah cart & sesi selesai dimuat dari localStorage */
  hydrated: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);
const CART_STORAGE_KEY = "bd-coffee-cart";
const SESSION_STORAGE_KEY = "bd-coffee-session";

const DEFAULT_SESSION: OrderSession = {
  orderType: "takeaway",
  tableNumber: null,
  isScanned: false,
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [session, setSession] = useState<OrderSession>(DEFAULT_SESSION);
  const [hydrated, setHydrated] = useState(false);

  // Load cart & sesi dari localStorage sekali pas mount
  useEffect(() => {
    try {
      const rawItems = localStorage.getItem(CART_STORAGE_KEY);
      if (rawItems) setItems(JSON.parse(rawItems));

      const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);
      if (rawSession) setSession(JSON.parse(rawSession));
    } catch {
      // storage rusak/kosong, biarin default
    }
    setHydrated(true);
  }, []);

  // Sync ke localStorage tiap kali cart berubah
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  // Sync ke localStorage tiap kali sesi berubah
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }, [session, hydrated]);

  const addItem: CartContextValue["addItem"] = (item, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { ...item, quantity }];
    });
  };

  const updateQuantity: CartContextValue["updateQuantity"] = (id, quantity) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((i) => i.id !== id);
      return prev.map((i) => (i.id === id ? { ...i, quantity } : i));
    });
  };

  const removeItem: CartContextValue["removeItem"] = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearCart = () => setItems([]);

  const setManualSession: CartContextValue["setManualSession"] = (next) => {
    setSession({ ...next, isScanned: false });
  };

  const applyScannedTable: CartContextValue["applyScannedTable"] = (table) => {
    // Meja sama kayak sesi yang lagi aktif (misal reload halaman) — jangan reset
    if (session.isScanned && session.tableNumber === table) return;

    // Meja baru / beda dari sesi aktif — mulai pesanan baru dari nol
    setItems([]);
    setSession({ orderType: "dine_in", tableNumber: table, isScanned: true });
  };

  const totalItems = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );
  const totalPrice = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity * i.price, 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        totalItems,
        totalPrice,
        session,
        setManualSession,
        applyScannedTable,
        hydrated,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart harus dipakai di dalam <CartProvider>");
  return ctx;
}