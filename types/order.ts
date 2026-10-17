import type { Database } from "@/types/database.types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];

/**
 * Bentuk pesanan yang benar-benar diambil oleh halaman kasir.
 *
 * Sengaja lebih sempit dari `OrderRow` penuh. Query kasir di
 * `app/admin/kasir/page.tsx` tidak mengambil `subtotal`, `updated_at`,
 * `unit_cost`, dan beberapa kolom lain.
 *
 * Kalau tipe ini tetap memakai `OrderRow` penuh, membaca kolom yang tidak
 * diambil akan lolos dari `tsc` dan muncul sebagai `undefined` saat runtime
 * * -- supaya saja tidak terlihat di halaman. Persempitan inilah yang membuat
 * `tsc` menangkapnya.
 * `tsc` menangkapnya.
 *
 * Tambah kolom di sini DAN di string select kasir setiap kali
 * OrderCard / ReceiptPrint butuh kolom baru.
 */
export type KasirOrder = Pick<
  OrderRow,
  | "id"
  | "order_number"
  | "customer_name"
  | "order_type"
  | "table_number"
  | "payment_method"
  | "payment_status"
  | "status"
  | "notes"
  | "total"
  | "created_at"
> & {
  order_items: Pick<
    OrderItemRow,
    "id" | "quantity" | "menu_name" | "subtotal" | "selected_customizations"
  >[];
};