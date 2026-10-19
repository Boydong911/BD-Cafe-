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
  // Seat kasir: board harus membaca sesi dari cookie kasir. Bila masih
  // memakai cookie default, sesi yang terbaca adalah milik dashboard owner
  // (atau tidak ada) dan data board jadi salah.
  const supabase = await createClient("kasir");

  const now = new Date();

  /*
   * Nama kasir yang sedang memakai halaman ini.
   *
   * Hanya satu baris profil milik orang yang sedang login. RLS
   * "profiles_select_self_or_owner" sudah mengizinkan itu untuk staf
   * (`id = auth.uid()`), jadi tidak perlu loosening policy apa pun.
   *
   * Sengaja tidak dibikin wajib: kalau gagal diambil, board tetap harus
   * jalan. Kasir yang sedang login tidak boleh kehilangan board hanya
   * karena nama gagal dimuat.
   */
  const kasirName = await fetchCurrentStaffName(supabase);

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
   *
   * Owner minta kartu "Belum Bayar" tidak muncul di board. Filternya:
   *   tampilkan kalau sudah lunas, ATAU dibayar tunai
   *
   * ⚠️ "dibayar tunai" (yang BELUM lunas) WAJIB ikut tampilkan. Pelanggan
   * yang pesan tunai akan mendarat di /pay lalu diberi tahu "bayar di
   * kasir" -- kalau kartunya tidak ada di board, kasir tidak punya apa pun
   * untuk ditekan "Selesaikan" dan uangnya tidak pernah tercatat.
   *
   * Yang disembunyikan hanya QRIS yang belum dibayar: sejak tombol
   * "Batalkan Pembayaran" ada, itu pilihan pelanggannya (bayar atau batal),
   * jadi tidak perlu menggantung di board sampai timer 15 menit habis.
   * Begitu dia menekan "Sudah Bayar", order-nya lunas dan langsung muncul
   * di sini.
   *
   * Catatan: `.or()` di sini menyatu DUA kolom (payment_status dan
   * payment_method) pada satu level, bukan mencampur status. `.in("status")`
   * tetap AND-ed di luar oleh PostgREST.
   */
  const [active, recentlyFinished] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, order_type, table_number, payment_method, payment_status, status, notes, total, created_at, order_items(id, quantity, menu_name, subtotal, selected_customizations)"
      )
      .in("status", ["pending", "confirmed", "preparing", "ready"])
      .or("payment_status.eq.paid,payment_method.eq.cash")
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
      kasirName={kasirName}
    />
  );
}

/**
 * Nama lengkap staf yang sedang login, untuk ditampilkan di board kasir.
 *
 * Fallback ke username kalau full_name kosong. Keduanya milik orang yang
 * sedang login saja -- RLS "profiles_select_self_or_owner" membatasi
 * select ke baris sendiri.
 *
 * Gagal membaca profil TIDAK membuat halaman error: papan antrean harus
 * tetap bisa dipakai. Yang hilang cuma nama, bukan board-nya.
 */
async function fetchCurrentStaffName(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data } = await supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", user.id)
      .maybeSingle();

    const name = data?.full_name?.trim();
    return name ? name : (data?.username?.trim() ?? null);
  } catch {
    return null;
  }
}