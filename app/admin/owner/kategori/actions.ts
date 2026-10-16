// File: app/admin/owner/kategori/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { success: true } | { success: false; error: string };

const categorySchema = z.object({
  name: z.string().trim().min(1, "Nama kategori wajib diisi").max(50),
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
  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { supabase, ok } = await requireOwner();
  if (!ok) return { success: false, error: "Akses ditolak." };

  // sort_order berikutnya: tempel di akhir daftar.
  const { data: last } = await supabase
    .from("categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("categories").insert({
    name: parsed.data.name,
    sort_order: (last?.sort_order ?? 0) + 1,
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
 * Tukar posisi `sort_order` dengan kategori di atasnya.
 * Owner melihat urutan ini di filter kategori halaman menu customer.
 */
export async function moveCategory(id: string, direction: "up" | "down"): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: "Data tidak valid." };
  }

  const { supabase, ok } = await requireOwner();
  if (!ok) return { success: false, error: "Akses ditolak." };

  // `name` ikut diambil karena `upsert` di bawah butuh seluruh kolom NOT NULL.
  const { data: rows, error: fetchError } = await supabase
    .from("categories")
    .select("id, name, sort_order")
    .order("sort_order", { ascending: true });

  if (fetchError) return { success: false, error: fetchError.message };

  const list = rows ?? [];
  const index = list.findIndex((row) => row.id === id);
  if (index === -1) return { success: false, error: "Kategori tidak ditemukan." };

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= list.length) {
    // Sudah di ujung — bukan error, cuma tidak ada yang perlu ditukar.
    return { success: true };
  }

  const current = list[index];
  const target = list[swapWith];

  const { error } = await supabase
    .from("categories")
    .upsert([
      { id: current.id, name: current.name, sort_order: target.sort_order },
      { id: target.id, name: target.name, sort_order: current.sort_order },
    ]);

  if (error) return { success: false, error: error.message };

  revalidateCategories();
  return { success: true };
}
