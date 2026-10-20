import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Satu baris pesanan untuk tabel laporan penjualan. */
export type OrderListRow = {
  id: string;
  order_number: string | null;
  customer_name: string;
  order_type: "dine_in" | "takeaway";
  table_number: string | null;
  payment_method: "qris" | "cash";
  payment_status: "pending" | "paid";
  status: string;
  total: number;
  created_at: string;
  /** Ringkasan isi pesanan, sudah dirangkai jadi satu string. */
  itemsSummary: string;
  itemCount: number;
};

/** Sisa pesanan: belum lunas ATAU belum selesai. */
export type PendingTotals = {
  count: number;
  total: number;
};

/**
 * Daftar pesanan untuk tabel laporan penjualan.
 *
 * Bedanya dengan `fetchSalesReport()`: yang ini mengembalikan detail per
 * pesanan (kode order, nama pemesan, menu, metode bayar), sedangkan yang itu
 * hanya agregat per bucket waktu untuk grafik.
 *
 * `start`/`end` boleh kosong (`null`) untuk menampilkan seluruh sejarah —
 * dipakai halaman Riwayat Transaksi.
 * `outletId` null = semua outlet.
 *
 * Query dipecah dua supaya jelas mana yang belum lunas dan mana yang sudah,
 * tanpa filter `payment_status` yang bercampur dengan `status` — percampuran
 * seperti itu yang dulu bikin kategori "Selesai" di kasir terlihat kosong.
 */
export async function fetchOrderList(
  start: Date | null,
  end: Date | null,
  outletId: string | null = null
): Promise<OrderListRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, customer_name, order_type, table_number, payment_method, payment_status, status, total, created_at, order_items(menu_name, quantity, subtotal)"
    )
    .order("created_at", { ascending: false });

  if (start) query = query.gte("created_at", start.toISOString());
  if (end) query = query.lte("created_at", end.toISOString());
  if (outletId) query = query.eq("outlet_id", outletId);

  const { data, error } = await query;

  if (error) {
    console.error("[sales] gagal memuat daftar pesanan:", error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as {
    id: string;
    order_number: string | null;
    customer_name: string;
    order_type: "dine_in" | "takeaway";
    table_number: string | null;
    payment_method: "qris" | "cash";
    payment_status: "pending" | "paid";
    status: string;
    total: number;
    created_at: string;
    order_items: { menu_name: string; quantity: number; subtotal: number }[] | null;
  }[];

  return rows.map((row) => {
    const items = row.order_items ?? [];

    return {
      id: row.id,
      order_number: row.order_number,
      customer_name: row.customer_name,
      order_type: row.order_type,
      table_number: row.table_number,
      payment_method: row.payment_method,
      payment_status: row.payment_status,
      status: row.status,
      total: Number(row.total),
      created_at: row.created_at,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      itemsSummary: items
        .map((item) => `${item.quantity}x ${item.menu_name}`)
        .join(", "),
    };
  });
}

/**
 * Pesanan yang belum final: belum dibayar, atau sudah dibayar tapi belum
 * diselesaikan kasir.
 *
 * Ini yang ditampilkan sebagai "sedang berjalan" di dashboard owner, supaya
 * terlihat jelas uang mana yang belum masuk.
 */
export function splitByCompletion(rows: OrderListRow[]): {
  pending: OrderListRow[];
  settled: OrderListRow[];
} {
  const pending = rows.filter(
    (row) => row.payment_status !== "paid" || row.status !== "completed"
  );
  const settledIds = new Set(pending.map((row) => row.id));

  return {
    pending,
    settled: rows.filter((row) => !settledIds.has(row.id)),
  };
}

/** Jumlah & total nominal dari sekumpulan pesanan. */
export function totalsOf(rows: OrderListRow[]): PendingTotals {
  return {
    count: rows.length,
    total: rows.reduce((sum, row) => sum + row.total, 0),
  };
}
