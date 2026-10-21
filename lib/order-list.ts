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
  /** Nama outlet pesanan ini (join ke outlets) — untuk kolom Outlet. */
  outletName: string;
  /** Ringkasan isi pesanan, sudah dirangkai jadi satu string. */
  itemsSummary: string;
  itemCount: number;
};

/** Sisa pesanan: belum lunas ATAU belum selesai. */
export type PendingTotals = {
  count: number;
  total: number;
};

/** Satu halaman daftar pesanan + jumlah SEMUA pesanan pada rentang ini. */
export type OrderListPage = {
  rows: OrderListRow[];
  total: number;
};

type OrderRowDb = {
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
  outlets: { nama: string } | null;
  order_items: { menu_name: string; quantity: number; subtotal: number }[] | null;
};

/** Kolom yang diambil dari orders — dipakai bareng dua fungsi fetch di bawah. */
const ORDER_SELECT =
  "id, order_number, customer_name, order_type, table_number, payment_method, payment_status, status, total, created_at, outlets(nama), order_items(menu_name, quantity, subtotal)";

/**
 * Daftar pesanan untuk tabel laporan penjualan.
 *
 * Bedanya dengan `fetchSalesReport()`: yang ini mengembalikan detail per
 * pesanan (kode order, nama pemesan, menu, metode bayar), sedangkan yang itu
 * hanya agregat per bucket waktu untuk grafik.
 *
 * `start`/`end` boleh kosong (`null`) untuk menampilkan seluruh sejarah.
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

  let query = supabase.from("orders").select(ORDER_SELECT).order("created_at", {
    ascending: false,
  });

  if (start) query = query.gte("created_at", start.toISOString());
  if (end) query = query.lte("created_at", end.toISOString());
  if (outletId) query = query.eq("outlet_id", outletId);

  const { data, error } = await query;

  if (error) {
    console.error("[sales] gagal memuat daftar pesanan:", error.message);
    return [];
  }

  return mapOrderRows(data as unknown as OrderRowDb[]);
}

/**
 * Satu HALAMAN daftar pesanan (terbaru dulu) + jumlah seluruh pesanan pada
 * rentang ini — untuk tabel Riwayat Transaksi yang tampil 25 baris per
 * halaman dengan tombol "lihat transaksi lainnya" di bawah tabel.
 *
 * `page` mulai dari 1. `perPage` mis. 25.
 */
export async function fetchOrderListPage(
  start: Date | null,
  end: Date | null,
  outletId: string | null,
  page: number,
  perPage: number
): Promise<OrderListPage> {
  const supabase = await createClient();
  const from = (page - 1) * perPage;

  let query = supabase
    .from("orders")
    .select(ORDER_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + perPage - 1);

  if (start) query = query.gte("created_at", start.toISOString());
  if (end) query = query.lte("created_at", end.toISOString());
  if (outletId) query = query.eq("outlet_id", outletId);

  const { data, error, count } = await query;

  if (error) {
    console.error("[sales] gagal memuat halaman pesanan:", error.message);
    return { rows: [], total: 0 };
  }

  return { rows: mapOrderRows(data as unknown as OrderRowDb[]), total: count ?? 0 };
}

/**
 * Jumlah & nilai TOTAL seluruh pesanan pada rentang ini (semua halaman) —
 * dipakai baris ringkasan di atas tabel riwayat. Query ringan: satu kolom,
 * tanpa join.
 */
export async function fetchOrderListGrandTotal(
  start: Date | null,
  end: Date | null,
  outletId: string | null
): Promise<PendingTotals> {
  const supabase = await createClient();

  let query = supabase.from("orders").select("total");
  if (start) query = query.gte("created_at", start.toISOString());
  if (end) query = query.lte("created_at", end.toISOString());
  if (outletId) query = query.eq("outlet_id", outletId);

  const { data, error } = await query;

  if (error) {
    console.error("[sales] gagal menghitung total pesanan:", error.message);
    return { count: 0, total: 0 };
  }

  const rows = (data ?? []) as { total: number | string }[];
  return {
    count: rows.length,
    total: rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0),
  };
}

/** Pemetaan baris DB -> OrderListRow (dipakai bareng dua fungsi fetch). */
function mapOrderRows(data: OrderRowDb[] | null): OrderListRow[] {
  return (data ?? []).map((row) => {
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
      outletName: row.outlets?.nama ?? "—",
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
