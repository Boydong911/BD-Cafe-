"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types/order";

type ActionResult = { success: true } | { success: false; error: string };

// Transisi status yang diizinkan (divalidasi di server, bukan cuma di UI)
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed"],
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

  const cur = current as unknown as {
    status: OrderStatus;
    payment_status: "pending" | "paid";
  };

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
    .update({ status } as never)
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

  const { error } = await supabase
    .from("orders")
    .update({ payment_status: "paid" } as never)
    .eq("id", orderId)
    .eq("payment_status", "pending")
    .neq("status", "cancelled");

  if (error) return { success: false, error: "Gagal konfirmasi pembayaran." };

  revalidatePath("/admin/kasir");
  return { success: true };
}