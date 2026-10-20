"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type SelectedCustomization = {
  name: string; // nama grup, contoh: "Level Gula"
  label: string; // pilihan, contoh: "Less Sugar"
  price_delta: number;
};

export type CartItem = {
  /** Kunci unik baris keranjang: menu + kombinasi kustomisasi */
  lineId: string;
  /** ID menu di database (menu_items.id) */
  id: string;
  name: string;
  description: string | null;
  /** Harga satuan, sudah termasuk kustomisasi */
  price: number;
  imageUrl: string | null;
  quantity: number;
  customizations: SelectedCustomization[];
};

export type OrderSession = {
  orderType: "dine_in" | "takeaway";
  tableNumber: string | null;
  /** true kalau tableNumber didapat dari scan QR (bukan diketik manual) */
  isScanned: boolean;
  /**
   * Slug outlet tempat pesanan dibuat (/outlet-a, /outlet-b, ...).
   * Diisi TableSessionSync di setiap halaman ber-outlet, dipakai tombol
   * "Lanjut ke Checkout" di keranjang agar mendarat di checkout outlet yang
   * sama. null -> dianggap outlet pusat (halaman tanpa konteks outlet).
   */
  outletSlug: string | null;
  /** "Pesanan Atas Nama" — nama yang dipanggil kasir saat pesanan siap */
  customerName: string;
};

type AddItemInput = Omit<CartItem, "quantity" | "lineId" | "customizations"> & {
  customizations?: SelectedCustomization[];
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: AddItemInput, quantity?: number) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  session: OrderSession;
  /** Dipanggil dari toggle/Input manual di cart-sheet — TIDAK mengosongkan keranjang */
  setManualSession: (session: Pick<OrderSession, "orderType" | "tableNumber">) => void;
  /** Dipanggil dari kolom "Pesanan Atas Nama" di keranjang */
  setCustomerName: (name: string) => void;
  /**
   * Dipanggil saat ada ?table= baru dari QR — reset keranjang kalau beda dari
   * sesi aktif. Slug outlet tempat QR itu tercetak ikut dikunci ke sesi.
   */
  applyScannedTable: (table: string, outletSlug: string) => void;
  /**
   * Dipanggil saat halaman dibuka TANPA ?table= (mis. customer masuk lewat
   * tombol "Lihat Menu" di landing page). Membersihkan sisa sesi meja hasil
   * scan sebelumnya supaya customer bebas pilih Dine In / Take Away sendiri.
   * Isian "Pesanan Atas Nama" tetap dipertahankan. Slug outlet halaman ini
   * selalu disimpan supaya keranjang tahu ke outlet mana checkout-nya.
   */
  clearScannedTable: (outletSlug: string) => void;
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
  outletSlug: null,
  customerName: "",
};

function buildLineId(id: string, customizations: SelectedCustomization[]) {
  const signature = customizations
    .map((c) => `${c.name}=${c.label}`)
    .sort()
    .join("|");
  return `${id}::${signature}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [session, setSession] = useState<OrderSession>(DEFAULT_SESSION);
  const [hydrated, setHydrated] = useState(false);

  // Muat sesi dari localStorage sekali pas mount.
  // Keranjang SENGAJA tidak dipulihkan: setiap kali halaman di-refresh /
  // pull-to-refresh, pilihan menu direset supaya pesanan tidak tertinggal
  // dari order sebelumnya. Nomor meja & nama tetap terbaca.
  useEffect(() => {
    try {
      localStorage.removeItem(CART_STORAGE_KEY); // bersihkan sisa versi lama

      const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);
      if (rawSession) {
        const parsed = JSON.parse(rawSession) as Partial<OrderSession>;
        setSession({
          orderType: parsed.orderType ?? DEFAULT_SESSION.orderType,
          tableNumber: parsed.tableNumber ?? null,
          isScanned: parsed.isScanned ?? false,
          outletSlug: parsed.outletSlug ?? null,
          customerName: parsed.customerName ?? "",
        });
      }
    } catch {
      // storage rusak/kosong, biarin default
    }
    setHydrated(true);
  }, []);

  // Sync ke localStorage tiap kali sesi berubah
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }, [session, hydrated]);

  const addItem: CartContextValue["addItem"] = (item, quantity = 1) => {
    const customizations = item.customizations ?? [];
    const lineId = buildLineId(item.id, customizations);

    setItems((prev) => {
      const existing = prev.find((i) => i.lineId === lineId);
      if (existing) {
        return prev.map((i) =>
          i.lineId === lineId ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { ...item, customizations, lineId, quantity }];
    });
  };

  const updateQuantity: CartContextValue["updateQuantity"] = (lineId, quantity) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((i) => i.lineId !== lineId);
      return prev.map((i) => (i.lineId === lineId ? { ...i, quantity } : i));
    });
  };

  const removeItem: CartContextValue["removeItem"] = (lineId) => {
    setItems((prev) => prev.filter((i) => i.lineId !== lineId));
  };

  const clearCart = () => setItems([]);

  const setManualSession: CartContextValue["setManualSession"] = (next) => {
    // customerName dipertahankan — yang diubah di sini hanya tipe & meja
    setSession((prev) => ({ ...prev, ...next, isScanned: false }));
  };

  const setCustomerName: CartContextValue["setCustomerName"] = (name) => {
    setSession((prev) => ({ ...prev, customerName: name }));
  };

  const applyScannedTable: CartContextValue["applyScannedTable"] = (
    table,
    outletSlug
  ) => {
    // Meja sama kayak sesi yang lagi aktif (misal reload halaman) — jangan reset
    if (
      session.isScanned &&
      session.tableNumber === table &&
      session.outletSlug === outletSlug
    ) {
      return;
    }

    // Meja baru / beda dari sesi aktif — mulai pesanan baru dari nol
    setItems([]);
    setSession({
      orderType: "dine_in",
      tableNumber: table,
      isScanned: true,
      outletSlug,
      customerName: "",
    });
  };

  const clearScannedTable: CartContextValue["clearScannedTable"] = (
    outletSlug
  ) => {
    // Slug outlet halaman ini selalu dicatat sesi (dipakai tombol checkout).
    if (!session.isScanned) {
      if (session.outletSlug !== outletSlug) {
        setSession((prev) => ({ ...prev, outletSlug }));
      }
      return;
    }

    setSession((prev) => ({
      ...DEFAULT_SESSION,
      customerName: prev.customerName,
      outletSlug,
    }));
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
        setCustomerName,
        applyScannedTable,
        clearScannedTable,
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