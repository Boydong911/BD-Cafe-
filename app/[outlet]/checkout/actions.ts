"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient, createActiveStaffClient, hasStaffSession } from "@/lib/supabase/server";
import { fetchOutletBySlug } from "@/lib/outlets";
import type { CustomizationGroup } from "@/types/menu";
import type { Json } from "@/types/database.types";

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
  /**
   * Slug outlet tempat checkout berdiri (/outlet-a, /outlet-b, ...).
   *
   * Dikirim dari params halaman checkout, tapi TIDAK dipercaya mentah-mentah:
   * server tetap mencocokkannya dengan tabel outlets dan menempelkan
   * outlet_id hasil lookup ke pesanan. Ini yang membuat nomor antrean
   * per-outlet, laporan per-outlet, dan board kasir per-outlet benar.
   */
  outlet_slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Alamat outlet tidak sah."),
  /**
   * Dikirim client, tetap harus digabungkan dengan `hasStaffSession()` di server.
   *
   * Penanda ini HANYA untuk tampilan, tapi ikut menentukan apakah pesanan
   * tunai langsung dicatat lunas. Kalau tidak digabung dengan sesi staff,
   * pesanan tunai seorang pelanggan di tablet counter yang dipakai bersama
   * akan otomatis diperlakukan lunas tanpa pernah membayar -- dia cuma perlu
   * ikut pakai perangkat tempat kasir masih login.
   */
  from_kasir: z.boolean().optional().default(false),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CheckoutState = { error?: string };

export async function createOrder(input: CheckoutInput): Promise<CheckoutState> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data pesanan tidak valid" };
  }

  const {
    customer_name,
    order_type,
    table_number,
    notes,
    payment_method,
    items,
    from_kasir,
    outlet_slug,
  } = parsed.data;

  if (order_type === "dine_in" && !table_number) {
    return { error: "Nomor meja wajib diisi untuk dine-in." };
  }

  /*
   * Tentukan outlet dari slug halaman checkout. Inilah sumber kebenaran
   * outlet untuk pesanan ini — bukan isian dari keranjang (client).
   */
  const outlet = await fetchOutletBySlug(outlet_slug);
  if (!outlet) {
    return {
      error:
        "Outlet tidak dikenal. Pesan ulang lewat QR meja atau URL outlet yang benar.",
    };
  }
  if (outlet.is_active === false) {
    return { error: `Outlet "${outlet.nama}" sedang tidak aktif.` };
  }

  // Seat mengikuti siapa yang memesan: kasir dari board (seat kasir), owner
  // yang mencoba alur (seat owner), atau pelanggan anonim (tidak ada sesi,
  // insert tetap terbuka via RLS). createActiveStaffClient yang memilih.
  const supabase = await createActiveStaffClient();

  // Ambil data menu terbaru dari DB (jangan percaya harga dari client!).
  // Dibatasi ke outlet checkout ini: keranjang yang dibawa menyimpang dari
  // outlet lain tidak tembus — menu outlet B yang dipakai di outlet A ditolak.
  const menuIds = items.map((i) => i.menu_item_id);
  const { data: menuItems, error: menuError } = await supabase
    .from("menu_items")
    .select("id, name, price, cost_price, is_available, customization_options")
    .in("id", menuIds)
    .eq("outlet_id", outlet.id);

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
    selected_customizations: Json;
    subtotal: number;
  }[] = [];

  for (const item of items) {
    const menu = menuMap.get(item.menu_item_id);
    if (!menu) {
      return { error: "Salah satu menu tidak ditemukan di outlet ini." };
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

  // Nomor antrean BELUM dibuat di sini — baru saat pembayaran terkonfirmasi
  // (trigger per-outlet). outlet_id ditempel langsung dari lookup slug; trigger
  // fondasi tetap jadi jaring pengaman kalau suatu saat ada insert tanpa outlet_id.
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
      outlet_id: outlet.id,
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

  /*
   * Ke mana pesanan baru diarahkan.
   *
   * Pelanggan biasa selalu ke halaman pembayaran: QRIS untuk scan QR,
   * halaman "Bayar di Kasir" untuk tunai.
   *
   * Kasir yang memesan lewat tab "Pesan Menu" tidak butuh halaman pembayaran
   * untuk TUNAI: uangnya ada di tangan kasir, jadi dia yang mencatat
   * pembayaran. Melewati halaman QR berarti satu langkah yang tidak berguna.
   *
   * QRIS tetap lewat halaman pembayaran, karena di situ kasir menekan
   * "Sudah Bayar" untuk mendapatkan nomor antrean.
   *
   * Keduanya kini diarahkan ke HALAMAN OUTLET YANG SAMA
   * (/{slug}/order/...), supaya semua tombol balik di dalamnya punya
   * konteks outlet yang benar.
   */
  if (payment_method === "cash" && from_kasir && (await hasStaffSession())) {
    /*
     * Catat pembayaran TUNAI sekalian.
     *
     * Panggil RPC yang sama dengan yang dipakai board kasir, bukan update
     * langsung. Alasannya tiga:
     *   1. RPC-nya SECURITY DEFINER, jadi tidak bergantung pada policy RLS
     *      update tabel orders.
     *   2. Update `payment_status` ke 'paid' itu yang memicu trigger
     *      trg_orders_order_number -- itulah yang memberi NOMOR ANTREAN dan
     *      menaikkan status dari pending ke confirmed.
     *   3. Function ini hanya boleh dipanggil sesi owner/kasir -- persis
     *      yang kita mau. Pelanggan tidak bisa menandai lunas sendiri
     *      karena tidak punya sesi.
     *
     * Kalau gagal, pesanan TIDAK dihapus. Dia tetap muncul di board kasir
     * dengan status "belum bayar", dan kasir bisa menekan "Selesaikan" di
     * sana -- yang akan mencoba confirm_cash_payment lagi. Jadi kegagalan di
     * sini bisa dipulihkan tanpa sisa pesanan nyangkut.
     */
    const { error: cashError } = await supabase.rpc("confirm_cash_payment", {
      p_order_id: order.id,
    });

    if (cashError) {
      console.error("[checkout] confirm_cash_payment gagal:", cashError.message);
    }

    redirect(`/${outlet.slug}/order/${order.id}`);
  }

  redirect(`/${outlet.slug}/order/${order.id}/pay`);
}
