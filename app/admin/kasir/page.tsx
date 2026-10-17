import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { KasirBoard } from "@/components/admin/kasir-board";
import { addDays } from "@/lib/format";
import type { KasirOrder } from "@/types/order";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kasir",
};

export default async function KasirPage() {
  const supabase = await createClient();

  const now = new Date();

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
      .select("*, order_items(*)")
      .in("status", ["pending", "confirmed", "preparing", "ready"])
      .order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select("*, order_items(*)")
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

  return <KasirBoard orders={orders} />;
}