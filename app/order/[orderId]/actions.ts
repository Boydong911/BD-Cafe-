"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_WINDOW_MINUTES } from "@/lib/payment";

export type ActionResult = { success: true } | { success: false; error: string };

function minutesSince(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 60_000;
}

/**
 * Panggil RPC Postgres yang mengembalikan boolean.
 *
 * `types/database.types.ts` belum di-generate, jadi nama function RPC belum
 * dikenal oleh tipe Supabase client (masuk kategori `never` yang sama seperti
 * error `never` lain di project ini). Cast di sini mengisolasi masalahnya di
 * satu tempat — nanti cukup regenerate types, cast ini bisa dihapus.
 */
async function callBooleanRpc(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fn: "confirm_qris_payment" | "cancel_unpaid_order",
  orderId: string
): Promise<{ ok: boolean; error: string | null }> {
  const result = (await supabase.rpc(fn, { p_order_id: orderId } as never)) as {
    data: boolean | null;
    error: { message: string } | null;
  };

  if (result.error) return { ok: false, error: result.error.message };
  return { ok: result.data === true, error: null };
}

/**
 * Tombol "Sudah Bayar" di halaman QRIS.
 *
 * Memakai RPC `confirm_qris_payment` (SECURITY DEFINER) karena customer
 * adalah pengguna 'anon' yang tidak punya hak UPDATE pada tabel orders.
 * Function tersebut hanya boleh mengubah payment_status -> 'paid'.
 *
 * CATATAN KEAMANAN: aksi ini sengaja bisa dipanggil WITHOUT login, karena
 * yang menekan adalah customer-nya sendiri, bukan staff. Keamanannya
 * bersandar pada `order_id` berupa UUID acak yang tidak bisa ditebak,
 * plus function yang hanya mengizinkan perubahan payment_status.
 *
 * ⚠️ Ini placeholder — saat QRIS asli terhubung ke payment gateway,
 *    status "paid" harus datang dari webhook gateway, BUKAN dari tombol ini.
 *    Kalau tidak, siapa pun yang tahu UUID pesanan bisa dapat antrean gratis.
 */
export async function confirmQrisPayment(orderId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(orderId);
  if (!parsed.success) return { success: false, error: "Data tidak valid." };

  const supabase = await createClient();

  const { ok, error } = await callBooleanRpc(supabase, "confirm_qris_payment", orderId);

  if (error) {
    return { success: false, error: "Gagal konfirmasi pembayaran." };
  }

  if (!ok) {
    return {
      success: false,
      error: "Pesanan sudah dibayar, dibatalkan, atau bukan QRIS.",
    };
  }

  revalidatePath(`/order/${orderId}`);
  revalidatePath(`/order/${orderId}/pay`);
  revalidatePath("/admin/kasir");
  return { success: true };
}

/**
 * Dipanggil timer di halaman QRIS saat 15 menit habis.
 * Hanya membatalkan kalau pesanan masih pending (belum dibayar).
 */
export async function expireOrder(orderId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(orderId);
  if (!parsed.success) return { success: false, error: "Data tidak valid." };

  const supabase = await createClient();

  const { ok, error } = await callBooleanRpc(supabase, "cancel_unpaid_order", orderId);

  if (error) return { success: false, error: "Gagal membatalkan pesanan." };

  revalidatePath(`/order/${orderId}`);
  revalidatePath(`/order/${orderId}/pay`);
  revalidatePath("/admin/kasir");

  return ok
    ? { success: true }
    : { success: false, error: "Pesanan sudah diproses." };
}

/**
 * Dipanggil saat halaman /order/[id]/pay dibuka: kalau sudah lewat 15 menit
 * tapi belum dibayar, batalkan sekalian (biar tidak menggantung di kasir).
 */
export async function getPaymentState(orderId: string) {
  const parsed = z.string().uuid().safeParse(orderId);
  if (!parsed.success) return { expired: false };

  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select("status, payment_status, created_at")
    .eq("id", orderId)
    .single();

  if (!data) return { expired: false };

  const cur = data as unknown as {
    status: string;
    payment_status: string;
    created_at: string;
  };

  if (cur.payment_status === "paid" || cur.status === "cancelled") {
    return { expired: false };
  }

  const expired = minutesSince(cur.created_at) > PAYMENT_WINDOW_MINUTES;

  if (expired) {
    await callBooleanRpc(supabase, "cancel_unpaid_order", orderId);
    revalidatePath(`/order/${orderId}`);
    revalidatePath("/admin/kasir");
  }

  return { expired };
}
