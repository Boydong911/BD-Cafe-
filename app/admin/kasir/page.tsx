import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { KasirBoard } from "@/components/admin/kasir-board";
import { addDays } from "@/lib/format";
import { fetchMenuCatalog } from "@/lib/categories";
import type { KasirOrder } from "@/types/order";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kasir",
};

/*
 * Select kolom eksplisit, bukan `*`.
 *
 * Yang sengaja TIDAK diambil karena tidak pernah dibaca di sisi kasir:
 *   orders      -> subtotal, updated_at
 *   order_items -> created_at, menu_item_id, order_id, unit_cost, unit_price
 *
 * unit_cost tidak ikut karena harga modal tidak perlu sampai ke browser kasir.
 *
 * PENTING: string select di bawah ini SENGAJA ditulis langsung, bukan
 * disimpan ke variabel. Supabase-js di setup ini TIDAK memvalidasi isi string
 * select terhadap skema (sudah diuji: kolom palsu tidak bikin `tsc` gagal),
 * jadi penjaga yang benar ada di `types/order.ts` -- tipe `KasirOrder` hanya
 * menyatakan kolom yang benar-benar diambil. Pembaca kolom lain akan tertangkap
 * `tsc`.
 */

export default async function KasirPage() {
  const supabase = await createClient();

  const now = new Date();

  // Katalog untuk tab "Pesan Menu". Menu jarang berubah dalam satu shift,
  // jadi query tambahan ini murah dibanding menulis ulang query di tab itu.
  const { items: menuItems, groups: categoryGroups } = await fetchMenuCatalog();

  // Garis waktu untuk order SELESAI/BATAL: 24 jam ke belakang, bukan cuma
  // hari kalender. Jadi order yang dibuat kemarin sore lalu diselesaikan
  // pagi ini tetap terlihat di kasir -- inilah yang bikin kategori "Selesai"
  // terlihat kosong padahal barusan ada yang diselesaikan.
  const recentFinishedFrom = addDays(now, -1).toISOString();

  /*
   * Query dimuat dua kali, bukan satu dengan `.or()`, supaya tidak ada
   * kekeliruan operator AND/OR di dalam filter:
   *   1) order yang masih aktif, kapan pun dibuat
   *   2) order yang baru selesai/batal dalam 24 jam terakhir
   * Order yang cocok keduanya hanya muncul sekali (de-dupe by id).
   */
  const [active, recentlyFinished] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, order_type, table_number, payment_method, payment_status, status, notes, total, created_at, order_items(id, quantity, menu_name, subtotal, selected_customizations)"
      )
      .in("status", ["pending", "confirmed", "preparing", "ready"])
      .order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, order_type, table_number, payment_method, payment_status, status, notes, total, created_at, order_items(id, quantity, menu_name, subtotal, selected_customizations)"
      )
      .in("status", ["completed", "cancelled"])
      .gte("created_at", recentFinishedFrom)
      .order("created_at", { ascending: false }),
  ]);

  const error = active.error ?? recentlyFinished.error;

  // Pesanan yang selesai dalam 24 jam terakhir tetap ditampilkan di kasir;
  // yang lebih lama sudah tidak relevan untuk kasir dan hanya ada di
  // dashboard owner.
  const byId = new Map<string, KasirOrder>();

  for (const row of (active.data ?? []) as unknown as KasirOrder[]) {
    byId.set(row.id, row);
  }
  for (const row of (recentlyFinished.data ?? []) as unknown as KasirOrder[]) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }

  // Urutkan: yang aktif lebih dulu (paling lama di atas), selesai/batal di
  // akhir supaya kasir tidak perlu menggulir untuk mencari antrean baru.
  const ACTIVE_STATUSES = ["pending", "confirmed", "preparing", "ready"];
  const orders = [...byId.values()].sort((a, b) => {
    const aActive = ACTIVE_STATUSES.includes(a.status) ? 0 : 1;
    const bActive = ACTIVE_STATUSES.includes(b.status) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  if (error) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Gagal memuat pesanan. Coba muat ulang halaman.
      </p>
    );
  }

  return (
    <KasirBoard
      orders={orders}
      menuItems={menuItems}
      categoryGroups={categoryGroups}
    />
  );
}