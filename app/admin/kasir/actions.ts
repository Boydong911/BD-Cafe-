"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/types/order";

type ActionResult = { success: true } | { success: false; error: string };

/*
 * Transisi status yang diizinkan (divalidasi di server, bukan cuma di UI).
 *
 * Alur disederhanakan sesuai permintaan owner:
 *   - "Terima Pesanan" (pending -> confirmed) DIHAPUS
 *   - "Mulai Dibuat"   (confirmed -> preparing) DIHAPUS
 *   - Setelah dibayar, pesanan LANGSUNG jadi "ready"
 *
 * Status confirmed dan preparing tidak dihapus dari enum karena pesanan lama
 * masih ada di database dengan status itu, dan halaman customer masih
 * menampilkan labelnya. Tapi kasir tidak perlu lagi lewat keduanya.
 */
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  // pending: bisa langsung ke ready kalau sudah bayar, atau batal
  pending: ["ready", "cancelled"],
  // Status lama:boleh lompat supaya kasir tidak terkunci kalau ada pesanan
  // yang sudah menempel di statuses ini dari sebelum alur disederhanakan.
  confirmed: ["preparing", "ready", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

const statusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum([
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "completed",
    "cancelled",
  ]),
});

async function assertStaff() {
  const supabase = await createClient("kasir");
  const { data: isStaff } = await supabase.rpc("is_staff");
  if (!isStaff) return { supabase, ok: false as const };
  return { supabase, ok: true as const };
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<ActionResult> {
  const parsed = statusSchema.safeParse({ orderId, status });
  if (!parsed.success) return { success: false, error: "Data tidak valid." };

  const { supabase, ok } = await assertStaff();
  if (!ok) return { success: false, error: "Akses ditolak." };

  const { data: current, error: fetchError } = await supabase
    .from("orders")
    .select("status, payment_status")
    .eq("id", orderId)
    .single();

  if (fetchError || !current) {
    return { success: false, error: "Pesanan tidak ditemukan." };
  }

  const cur = current as { status: OrderStatus; payment_status: PaymentStatus };

  if (!ALLOWED[cur.status].includes(status)) {
    return {
      success: false,
      error: "Perubahan status tidak diizinkan dari kondisi saat ini.",
    };
  }

  if (status === "completed" && cur.payment_status !== "paid") {
    return {
      success: false,
      error: "Konfirmasi pembayaran dulu sebelum menyelesaikan pesanan.",
    };
  }

  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) return { success: false, error: "Gagal memperbarui status." };

  revalidatePath("/admin/kasir");
  return { success: true };
}

/**
 * Satu tombol "Konfirmasi Bayar" untuk TUNAI maupun QRIS.
 *
 * Bedanya hanya di apakah pembayaran masih perlu dicatat di server:
 *
 *  - TUNAI: customer belum bayar. Kasir yang menerima uang, jadi kasir-lah
 *    yang mengubah payment_status jadi 'paid' (lewat RPC confirm_cash_payment).
 *
 *  - QRIS: customer sudah menekan "Sudah Bayar" di halamannya sendiri, jadi
 *    payment_status sudah 'paid' sebelum kasir menyentuhnya. Yang perlu
 *    dilakukan kasir hanya memindahkan status ke "ready" dan mencetak struk.
 *    Memanggil RPC pembayaran di sini tidak akan mengubah apa pun karena
 *    syaratnya sudah terpenuhi, makanya jalur itu dilewati.
 *
 * `@param paymentMethod` dikirim dari client sesuai badge pada kartu order.
 * Nilainya tetap divalidasi ulang di server dari database, bukan dipercaya
 * begitu saja -- kalau tidak, client bisa mengirim 'cash' untuk pesanan QRIS.
 */
export async function confirmPayment(
  orderId: string,
  paymentMethod: PaymentMethod = "cash"
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(orderId).success) {
    return { success: false, error: "Data tidak valid." };
  }

  const { supabase, ok } = await assertStaff();
  if (!ok) return { success: false, error: "Akses ditolak." };

  /*
   * Metode pembayaran dibaca ulang dari database. Nilai yang dikirim client
   * hanya petunjuk untuk memilih jalur mana yang relevan; keputusan sebenarnya
   * ikut data server.
   */
  const { data: row, error: fetchError } = await supabase
    .from("orders")
    .select("status, payment_method, payment_status")
    .eq("id", orderId)
    .single();

  if (fetchError || !row) {
    return { success: false, error: "Pesanan tidak ditemukan." };
  }

  const cur = row as unknown as {
    status: OrderStatus;
    payment_method: PaymentMethod;
    payment_status: PaymentStatus;
  };

  if (cur.status === "cancelled") {
    return { success: false, error: "Pesanan sudah dibatalkan." };
  }

  const method = cur.payment_method ?? paymentMethod;

  /*
   * TUNAI: pembayaran harus dicatat lewat RPC SECURITY DEFINER.
   * Update langsung tidak bisa dipakai karena harus lolos policy RLS, dan
   * jalur ini sama sekali tidak boleh longgar agar data pesanan tidak bocor.
   */
  if (method === "cash") {
    const { data, error } = await supabase.rpc("confirm_cash_payment", {
      p_order_id: orderId,
    });

    if (error) {
      // Pesan asli dicetak ke log server supaya bisa dibaca developer.
      console.error(
        "[kasir] confirm_cash_payment gagal:",
        error.code,
        error.message,
        error.details,
        error.hint
      );
      return { success: false, error: "Gagal konfirmasi pembayaran." };
    }

    // `false` = tidak ada baris berubah, artinya sudah dibayar atau dibatalkan.
    if (data !== true) {
      return {
        success: false,
        error: "Pesanan sudah dibayar atau sudah dibatalkan.",
      };
    }
  }

  /*
   * QRIS: pembayaran sudah 'paid' dari sisi customer. Tidak ada RPC yang perlu
   * dipanggil -- cukup pastikan lunas, kalau ternyata belum (mis. customer
   * belum menekan tombolnya) panggil confirm_qris_payment.
   */
  if (method === "qris" && cur.payment_status !== "paid") {
    const { data, error } = await supabase.rpc("confirm_qris_payment", {
      p_order_id: orderId,
    });

    if (error) {
      console.error("[kasir] confirm_qris_payment gagal:", error.message);
      return { success: false, error: "Gagal konfirmasi pembayaran." };
    }

    if (data !== true) {
      return { success: false, error: "Gagal konfirmasi pembayaran." };
    }
  }

  /*
   * Pembayaran beres. Pesanan LANGSUNG ditandai "ready" (Siap Disajikan)
   * supaya kasir tidak perlu klik "Mulai Dibuat" dulu.
   *
   * Idempoten: kalau sudah "ready"/"completed", tidak ada yang diubah dan
   * ini bukan error -- tombolnya sengaja tetap bisa ditekan untuk cetak struk.
   */
  const { error: statusError } = await supabase
    .from("orders")
    .update({ status: "ready" })
    .eq("id", orderId)
    .not("status", "in", "(ready,completed,cancelled)");

  if (statusError) {
    console.error("[kasir] update status ready gagal:", statusError.message);
  }

  revalidatePath("/admin/kasir");
  revalidatePath("/admin/owner");
  revalidatePath("/admin/owner/penjualan");
  return { success: true };
}

/**
 * Selesaikan pesanan dalam satu klik, untuk TUNAI maupun QRIS.
 *
 * Owner minta langkah "Konfirmasi Bayar" dihapus dari alur kasir untuk kedua
 * metode. Satu tombol "Selesaikan" yang melakukan semuanya:
 *
 *   TUNAI  -> catat pembayaran (RPC confirm_cash_payment, yang sekaligus
 *             memberi nomor antrean) -> ready -> completed
 *   QRIS   -> pembayaran sudah lunas dari sisi pelanggan -> ready -> completed
 *
 * Status tetap dikrok dua tahap (ready lalu completed), bukan langsung
 * completed, supaya pesanan sempat terlihat sebagai "Siap Disajikan" di
 * halaman pelanggan. Kalau langsung completed, pelanggan tidak pernah melihat
 * tahap itu.
 *
 * Idempoten: aman ditekan dua kali. Kalau sudah `completed`, tidak ada yang
 * diubah dan tetap dianggap berhasil.
 */
export async function completeOrder(orderId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(orderId).success) {
    return { success: false, error: "Data tidak valid." };
  }

  const { supabase, ok } = await assertStaff();
  if (!ok) return { success: false, error: "Akses ditolak." };

  const { data: current, error: fetchError } = await supabase
    .from("orders")
    .select("status, payment_method, payment_status")
    .eq("id", orderId)
    .single();

  if (fetchError || !current) {
    return { success: false, error: "Pesanan tidak ditemukan." };
  }

  const cur = current as unknown as {
    status: OrderStatus;
    payment_method: PaymentMethod;
    payment_status: PaymentStatus;
  };

  if (cur.status === "cancelled") {
    return { success: false, error: "Pesanan sudah dibatalkan." };
  }

  if (cur.status === "completed") {
    return { success: true };
  }

  /*
   * TUNAI: uang baru diterima di tangan kasir, jadi di sini pembayaran
   * dicatat lewat RPC SECURITY DEFINER. RPC itu juga yang memberi nomor
   * antrean, lewat trigger.
   *
   * QRIS: kalau ternyata belum lunas (customer belum menekan "Sudah Bayar"),
   * TIDAK dipaksa jadi lunas. Jalur itu ditahan supaya pelanggan tidak
   * dapat antrean gratis hanya karena menekan tombol.
   */
  if (cur.payment_method === "cash" && cur.payment_status !== "paid") {
    const { data, error } = await supabase.rpc("confirm_cash_payment", {
      p_order_id: orderId,
    });

    if (error) {
      console.error(
        "[kasir] completeOrder / confirm_cash_payment gagal:",
        error.code,
        error.message,
        error.details,
        error.hint
      );
      return { success: false, error: "Gagal mencatat pembayaran." };
    }

    if (data !== true) {
      return {
        success: false,
        error: "Pesanan sudah dibayar atau sudah dibatalkan.",
      };
    }
  } else if (cur.payment_status !== "paid") {
    return { success: false, error: "Pesanan belum lunas." };
  }

  // Tahap 1: ke "ready" saja kalau belum di sana.
  if (cur.status !== "ready") {
    const { error: readyError } = await supabase
      .from("orders")
      .update({ status: "ready" })
      .eq("id", orderId);

    if (readyError) {
      console.error("[kasir] completeOrder (ready) gagal:", readyError.message);
      return { success: false, error: "Gagal menyiapkan pesanan." };
    }
  }

  // Tahap 2: selesaikan.
  const { error: doneError } = await supabase
    .from("orders")
    .update({ status: "completed" })
    .eq("id", orderId);

  if (doneError) {
    console.error("[kasir] completeOrder (completed) gagal:", doneError.message);
    return { success: false, error: "Gagal menyelesaikan pesanan." };
  }

  revalidatePath("/admin/kasir");
  revalidatePath("/admin/owner");
  revalidatePath("/admin/owner/penjualan");
  return { success: true };
}