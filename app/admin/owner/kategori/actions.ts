// File: app/admin/owner/kategori/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_DRINK_OPTIONS, toJsonOptions } from "@/lib/menu-defaults";

type ActionResult = { success: true } | { success: false; error: string };

const categorySchema = z.object({
  name: z.string().trim().min(1, "Nama kategori wajib diisi").max(50),
});

/**
 * Kategori dua tingkat. `parent_id` null = kategori tingkat atas (Minuman /
 * Makanan). Sub-kategori wajib punya induk.
 */
const createSchema = categorySchema.extend({
  parent_id: z.string().uuid(),
  is_drink: z.coerce.boolean().default(false),
});

/**
 * `categories` dikunci policy `categories_owner_all` (using is_owner()), jadi
 * RLS sudah menyingkirkan non-owner. Kita tetap cek role di sini supaya pesan
 * error yang muncul jelas ("Akses ditolak"), bukan 403 yang samar dari Postgres.
 */
async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, ok: false as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "owner") return { supabase, ok: false as const };
  return { supabase, ok: true as const };
}

/** Trigger page lain yang menampilkan daftar kategori. */
function revalidateCategories() {
  revalidatePath("/admin/owner/kategori");
  revalidatePath("/admin/owner/menu");
  revalidatePath("/admin/owner/menu/new");
  revalidatePath("/menu");
}

export async function createCategory(formData: FormData): Promise<ActionResult> {
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    parent_id: formData.get("parent_id"),
    is_drink: formData.get("is_drink") === "on",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { supabase, ok } = await requireOwner();
  if (!ok) return { success: false, error: "Akses ditolak." };

  // Induk yang dipilih harus benar-benar kategori tingkat atas, supaya tidak
  // terciptaan rantai tiga tingkat yang tidak di tangani filter mana pun.
  const { data: parent } = await supabase
    .from("categories")
    .select("id, parent_id, sort_order")
    .eq("id", parsed.data.parent_id)
    .single();

  if (!parent) return { success: false, error: "Kategori induk tidak ditemukan." };
  if (parent.parent_id) {
    return {
      success: false,
      error: "Kategori hanya boleh dua tingkat. Pilih kategori Minuman atau Makanan.",
    };
  }

  // Sub-kategori baru tempel di akhir daftar induknya.
  const { data: lastSibling } = await supabase
    .from("categories")
    .select("sort_order")
    .eq("parent_id", parent.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("categories").insert({
    name: parsed.data.name,
    parent_id: parent.id,
    is_drink: parsed.data.is_drink,
    sort_order: (lastSibling?.sort_order ?? parent.sort_order) + 1,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Kategori dengan nama itu sudah ada." };
    }
    return { success: false, error: error.message };
  }

  revalidateCategories();
  return { success: true };
}

export async function updateCategory(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { supabase, ok } = await requireOwner();
  if (!ok) return { success: false, error: "Akses ditolak." };

  const { error } = await supabase
    .from("categories")
    .update({ name: parsed.data.name })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Kategori dengan nama itu sudah ada." };
    }
    return { success: false, error: error.message };
  }

  revalidateCategories();
  return { success: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: "Data tidak valid." };
  }

  const { supabase, ok } = await requireOwner();
  if (!ok) return { success: false, error: "Akses ditolak." };

  // Kategori tidak dihapus diam-diam: cek dulu berapa menu yang menempel,
  // supaya owner tahu konsekuensinya sebelum menekan tombol.
  const { count } = await supabase
    .from("menu_items")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if ((count ?? 0) > 0) {
    return {
      success: false,
      error: `Kategori ini masih dipakai ${count} menu. Pindahkan menu-nya dulu, atau hapus paksa (menu jadi tanpa kategori).`,
    };
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidateCategories();
  return { success: true };
}

/**
 * Tandai kategori sebagai minuman / makanan.
 *
 * Ini yang menentukan apakah menu di dalamnya dapat tombol Gula + Ice/Hot.
 * Sekalian meng-update menu yang sudah ada di kategori itu, supaya saat owner
 * menandai kategori baru sebagai minuman, menu lamanya ikut dapat tombolnya —
 * dan saat tandanya dicabut, tombolnya hilang.
 */
export async function setCategoryDrink(
  id: string,
  isDrink: boolean
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: "Data tidak valid." };
  }

  const { supabase, ok } = await requireOwner();
  if (!ok) return { success: false, error: "Akses ditolak." };

  const { error } = await supabase
    .from("categories")
    .update({ is_drink: isDrink })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  if (isDrink) {
    await syncMenusToDrink(supabase, id);
  } else {
    await syncMenusToFood(supabase, id);
  }

  revalidateCategories();
  return { success: true };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Menu kosongkan hanya bila opsinya PERSIS sama dengan default minuman. */
async function syncMenusToFood(supabase: Supabase, categoryId: string) {
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, customization_options")
    .eq("category_id", categoryId);

  if (error) {
    console.error("[kategori] gagal ambil menu:", error.message);
    return;
  }

  for (const menu of data ?? []) {
    if (!isDefaultDrinkOptions(menu.customization_options)) continue;
    await supabase
      .from("menu_items")
      .update({ customization_options: [] })
      .eq("id", menu.id);
  }
}

/** Menu tanpa opsi (null / bukan array / array kosong) diberi default Gula+Suhu. */
async function syncMenusToDrink(supabase: Supabase, categoryId: string) {
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, customization_options")
    .eq("category_id", categoryId);

  if (error) {
    console.error("[kategori] gagal ambil menu:", error.message);
    return;
  }

  for (const menu of data ?? []) {
    if (hasCustomization(menu.customization_options)) continue;
    await supabase
      .from("menu_items")
      .update({ customization_options: toJsonOptions(DEFAULT_DRINK_OPTIONS) })
      .eq("id", menu.id);
  }
}

/** Apakah menu sudah punya grup kustomisasi? Sama dengan logika `normalizeCustomizationGroups`. */
function hasCustomization(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.some(
    (group) =>
      !!group &&
      typeof group === "object" &&
      Array.isArray((group as { options?: unknown }).options) &&
      (group as { options: unknown[] }).options.length > 0
  );
}

/** Bandingkan isi kolom jsonb dengan default (tanpa bergantung urutan formatting). */
function isDefaultDrinkOptions(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== DEFAULT_DRINK_OPTIONS.length) {
    return false;
  }

  return DEFAULT_DRINK_OPTIONS.every((expected, groupIndex) => {
    const actual = value[groupIndex] as { name?: unknown; options?: unknown } | undefined;
    if (!actual || actual.name !== expected.name) return false;
    if (!Array.isArray(actual.options) || actual.options.length !== expected.options.length) {
      return false;
    }
    return expected.options.every((option, optionIndex) => {
      const actualOption = actual.options![optionIndex] as
        | { label?: unknown; price_delta?: unknown }
        | undefined;
      return (
        actualOption?.label === option.label &&
        Number(actualOption?.price_delta ?? 0) === option.price_delta
      );
    });
  });
}

/** Hapus kategori walau masih ada menu-nya. Menu jadi `category_id = NULL`. */
export async function deleteCategoryForce(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: "Data tidak valid." };
  }

  const { supabase, ok } = await requireOwner();
  if (!ok) return { success: false, error: "Akses ditolak." };

  // FK `menu_items.category_id` sudah `on delete set null`, jadi cukup hapus
  // kategorinya — Postgres yang menosongkan kolom menu.
  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidateCategories();
  return { success: true };
}

/**
 * Tukar posisi `sort_order` dengan saudaranya di bawah/atasNYA SAJA.
 *
 * Penting: hanya bertukar dalam satu induk. Kalau seluruh kategori (termasuk
 * induknya) ikut diurutkan jadi satu daftar, tombol "naik" pada "Kopi" bisa
 * menabrakkan "Minuman" dan merusak urutan induk.
 */
export async function moveCategory(id: string, direction: "up" | "down"): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: "Data tidak valid." };
  }

  const { supabase, ok } = await requireOwner();
  if (!ok) return { success: false, error: "Akses ditolak." };

  // `name` ikut diambil karena `upsert` di bawah butuh kolom NOT NULL.
  const { data: targetRow, error: targetError } = await supabase
    .from("categories")
    .select("id, name, parent_id, sort_order")
    .eq("id", id)
    .single();

  if (targetError || !targetRow) {
    return { success: false, error: "Kategori tidak ditemukan." };
  }

  // Ambil SAUDARA: kategori dengan parent_id yang sama (null = tingkat atas).
  const { data: siblings, error: fetchError } = await supabase
    .from("categories")
    .select("id, name, sort_order")
    .eq("parent_id", targetRow.parent_id)
    .order("sort_order", { ascending: true });

  if (fetchError) return { success: false, error: fetchError.message };

  const list = siblings ?? [];
  const index = list.findIndex((row) => row.id === id);
  if (index === -1) return { success: false, error: "Kategori tidak ditemukan." };

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= list.length) {
    // Sudah di ujung — bukan error, cuma tidak ada yang perlu ditukar.
    return { success: true };
  }

  const current = list[index];
  const other = list[swapWith];

  // Cukup kirim kolom yang mau diubah. PostgREST hanya menulis kolom yang ada
  // di payload, jadi `parent_id` dan `is_drink` tetap utuh — penting, karena
  // kalau ikut tersalin, kategori minuman bisa berubah jadi makanan.
  const { error } = await supabase
    .from("categories")
    .upsert([
      { id: current.id, name: current.name, sort_order: other.sort_order },
      { id: other.id, name: other.name, sort_order: current.sort_order },
    ]);

  if (error) return { success: false, error: error.message };

  revalidateCategories();
  return { success: true };
}
