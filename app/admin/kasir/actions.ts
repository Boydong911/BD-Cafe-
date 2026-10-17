"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus, PaymentStatus } from "@/types/order";

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
  const supabase = await createClient();
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

export async function confirmPayment(orderId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(orderId).success) {
    return { success: false, error: "Data tidak valid." };
  }

  const { supabase, ok } = await assertStaff();
  if (!ok) return { success: false, error: "Akses ditolak." };

  /*
   * Memakai RPC `confirm_cash_payment`, bukan `.update()` langsung.
   *
   * Alasannya: update langsung harus lolos policy RLS, sementara jalur QRIS
   * (confirm_qris_payment) jalan lewat function SECURITY DEFINER yang bypass
   * RLS. lalu yang tidak konsisten antar dua jalur pembayaran.
   */
  const { data, error } = await supabase.rpc("confirm_cash_payment", {
    p_order_id: orderId,
  });

  if (error) {
    // Pesan asli dicetak ke log server supaya bisa dibaca developer.
    // Untuk kasir tetap dipakai kalimat yang bisa dipahami.
    console.error(
      "[kasir] confirm_cash_payment gagal:",
      error.code,
      error.message,
      error.details,
      error.hint
    );
    return { success: false, error: "Gagal konfirmasi pembayaran." };
  }

  // `false` = tidak ada baris yang berubah (sudah dibayar / sudah dibatalkan).
  if (data !== true) {
    return {
      success: false,
      error: "Pesanan sudah dibayar atau sudah dibatalkan.",
    };
  }

  /*
   * Payment sudah lunas. Sekarang pesanan LANGSUNG ditandai jadi "ready"
   * (Siap Disajikan) supaya kasir tidak perlu klik "Mulai Dibuat" dulu.
   *
   * Dicoba idempoten: kalau pesanan sudah "ready" atau "completed", tidak
   * ada yang perlu diubah dan ini bukan error.
   */
  const { data: current } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();

  const status = (current as unknown as { status?: OrderStatus } | null)?.status;

  if (status && status !== "ready" && status !== "completed" && status !== "cancelled") {
    const { error: statusError } = await supabase
      .from("orders")
      .update({ status: "ready" })
      .eq("id", orderId);

    if (statusError) {
      console.error("[kasir] update status ready gagal:", statusError.message);
    }
  }

  revalidatePath("/admin/kasir");
  revalidatePath("/admin/owner");
  revalidatePath("/admin/owner/penjualan");
  return { success: true };
}