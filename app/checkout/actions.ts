"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CustomizationGroup } from "@/types/menu";

const cartItemSchema = z.object({
  menu_item_id: z.string().uuid(),
  quantity: z.number().int().min(1),
  selected_customizations: z
    .array(
      z.object({
        name: z.string(),        // contoh: "Gula"
        label: z.string(),       // contoh: "Less Sugar"
        price_delta: z.number().default(0), // DIABAIKAN — harga dihitung ulang dari DB
      })
    )
    .default([]),
});

const checkoutSchema = z.object({
  customer_name: z.string().min(2, "Nama pemesan wajib diisi"),
  order_type: z.enum(["dine_in", "takeaway"]),
  table_number: z.string().optional(),
  notes: z.string().optional(),
  payment_method: z.enum(["qris", "cash"]),
  items: z.array(cartItemSchema).min(1, "Keranjang tidak boleh kosong"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CheckoutState = { error?: string };

export async function createOrder(input: CheckoutInput): Promise<CheckoutState> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data pesanan tidak valid" };
  }

  const { customer_name, order_type, table_number, notes, payment_method, items } =
    parsed.data;

  if (order_type === "dine_in" && !table_number) {
    return { error: "Nomor meja wajib diisi untuk dine-in." };
  }

  const supabase = await createClient();

  // Ambil data menu terbaru dari DB (jangan percaya harga dari client!)
  const menuIds = items.map((i) => i.menu_item_id);
  const { data: menuItems, error: menuError } = await supabase
    .from("menu_items")
    .select("id, name, price, cost_price, is_available, customization_options")
    .in("id", menuIds);

  if (menuError || !menuItems || menuItems.length === 0) {
    return { error: "Gagal memuat data menu." };
  }

  const menuMap = new Map(menuItems.map((m) => [m.id, m]));

  let subtotal = 0;
  const orderItemsPayload: {
    menu_item_id: string;
    menu_name: string;
    unit_price: number;
    unit_cost: number;
    quantity: number;
    selected_customizations: unknown;
    subtotal: number;
  }[] = [];

  for (const item of items) {
    const menu = menuMap.get(item.menu_item_id);
    if (!menu) {
      return { error: "Salah satu menu tidak ditemukan." };
    }
    if (!menu.is_available) {
      return { error: `Menu "${menu.name}" sedang habis, silakan hapus dari keranjang.` };
    }

    // Validasi pilihan kustomisasi terhadap data DB — price_delta dari client DIABAIKAN
    const groups = (
      Array.isArray(menu.customization_options) ? menu.customization_options : []
    ) as unknown as CustomizationGroup[];

    const verified: { name: string; label: string; price_delta: number }[] = [];
    for (const sel of item.selected_customizations) {
      const group = groups.find((g) => g.name === sel.name);
      // group?. saja tidak cukup: data rusak bisa punya grup tanpa key "options"
      const options = Array.isArray(group?.options) ? group.options : [];
      const option = options.find((o) => o.label === sel.label);
      if (!group || !option) {
        return {
          error: `Pilihan kustomisasi untuk "${menu.name}" tidak valid, silakan pilih ulang.`,
        };
      }
      verified.push({
        name: group.name,
        label: option.label,
        price_delta: Number(option.price_delta) || 0,
      });
    }

    // Satu pilihan per grup
    if (new Set(verified.map((v) => v.name)).size !== verified.length) {
      return { error: `Pilihan kustomisasi untuk "${menu.name}" tidak valid.` };
    }

    const customizationDelta = verified.reduce((sum, c) => sum + c.price_delta, 0);
    const unitPrice = Number(menu.price) + customizationDelta;
    const lineSubtotal = unitPrice * item.quantity;
    subtotal += lineSubtotal;

    orderItemsPayload.push({
      menu_item_id: menu.id,
      menu_name: menu.name,
      unit_price: unitPrice,
      unit_cost: Number(menu.cost_price),
      quantity: item.quantity,
      selected_customizations: verified,
      subtotal: lineSubtotal,
    });
  }

  const total = subtotal; // tempat menambah pajak/biaya layanan jika ada

  // Nomor antrean BELUM dibuat di sini — baru saat pembayaran terkonfirmasi.
  // Cek constraint: dine_in wajib punya table_number, takeaway wajib null.
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_name,
      order_type,
      table_number: order_type === "dine_in" ? table_number : null,
      notes: notes || null,
      payment_method,
      payment_status: "pending",
      status: "pending",
      subtotal,
      total,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return { error: `Gagal membuat pesanan: ${orderError?.message ?? "unknown error"}` };
  }

  // 2) Insert order items
  const { error: itemsError } = await supabase.from("order_items").insert(
    orderItemsPayload.map((item) => ({ ...item, order_id: order.id }))
  );

  if (itemsError) {
    // Rollback manual: hapus order yang sudah terlanjur dibuat
    await supabase.from("orders").delete().eq("id", order.id);
    return { error: `Gagal menyimpan detail pesanan: ${itemsError.message}` };
  }

  // Belum bayar -> arahkan ke halaman pembayaran (QRIS / Tunai).
  // Nomor antrean dibuat setelah pembayaran terkonfirmasi.
  redirect(`/order/${order.id}/pay`);
}