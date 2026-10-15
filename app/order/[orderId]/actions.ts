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
 * Tombol "Sudah Bayar" di halaman QRIS.
 *
 * CATATAN KEAMANAN: aksi ini sengaja bisa dipanggil WITHOUT login, karena
 * yang menekan adalah customer-nya sendiri, bukan staff. Keamanannya
 * bersandar pada `order_id` berupa UUID acak yang tidak bisa ditebak.
 *
 * ⚠️ Ini placeholder — saat QRIS asli terhubung ke payment gateway,
 *    status "paid" harus datang dari webhook gateway, BUKAN dari tombol ini.
 *    Kalau tidak, siapa pun yang tahu UUID pesanan bisa dapat antrean gratis.
 */
export async function confirmQrisPayment(orderId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(orderId);
  if (!parsed.success) return { success: false, error: "Data tidak valid." };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .update({ payment_status: "paid" } as never)
    .eq("id", orderId)
    .eq("payment_method", "qris")
    .eq("payment_status", "pending")
    .neq("status", "cancelled")
    .select("id, total, customer_name, status")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: "Pesanan sudah dibayar atau dibatalkan.",
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

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, payment_status, created_at")
    .eq("id", orderId)
    .single();

  if (!order) return { success: false, error: "Pesanan tidak ditemukan." };

  const cur = order as unknown as {
    id: string;
    status: string;
    payment_status: string;
    created_at: string;
  };

  // Sudah dibayar / sudah diproses — jangan dibatalkan
  if (cur.payment_status === "paid" || cur.status !== "pending") {
    return { success: false, error: "Pesanan sudah diproses." };
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelled" } as never)
    .eq("id", orderId)
    .eq("payment_status", "pending");

  if (error) return { success: false, error: "Gagal membatalkan pesanan." };

  revalidatePath(`/order/${orderId}`);
  revalidatePath(`/order/${orderId}/pay`);
  revalidatePath("/admin/kasir");
  return { success: true };
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
    await supabase
      .from("orders")
      .update({ status: "cancelled" } as never)
      .eq("id", orderId)
      .eq("payment_status", "pending");
    revalidatePath(`/order/${orderId}`);
    revalidatePath("/admin/kasir");
  }

  return { expired };
}
