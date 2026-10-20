// File: app/admin/owner/meja/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

const tableSchema = z.object({
  table_number: z.string().trim().min(1, "Nomor meja wajib diisi").max(10),
  label: z.string().trim().max(50).optional().nullable(),
});

async function requireOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "owner") throw new Error("Forbidden: owner only");
  return supabase;
}

export async function createTable(formData: FormData) {
  const parsed = tableSchema.safeParse({
    table_number: formData.get("table_number"),
    label: formData.get("label") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Meja selalu milik satu outlet (hidden input dari halaman meja).
  const outletId = String(formData.get("outlet_id") ?? "");
  if (!z.string().uuid().safeParse(outletId).success) {
    return { error: "Outlet tidak valid." };
  }

  const supabase = await requireOwner();

  // Jaring pengaman: outlet harus ada dan masih aktif.
  const { data: outlet } = await supabase
    .from("outlets")
    .select("is_active")
    .eq("id", outletId)
    .maybeSingle();
  if (!outlet || !outlet.is_active) {
    return { error: "Outlet tidak ditemukan atau sudah diarsipkan." };
  }

  // Catatan: `tsconfig` memakai `strict: false`, dan tanpa `strictNullChecks`
  // inferensi Zod v3 degrade — `parsed.data` jadi bertipe semua-opsional.
  // Karena itu payload ditulis eksplisit supaya kolom wajib tidak hilang.
  const payload: Database["public"]["Tables"]["tables"]["Insert"] = {
    table_number: parsed.data.table_number,
    label: parsed.data.label ?? null,
    outlet_id: outletId,
  };

  const { error } = await supabase.from("tables").insert(payload);

  if (error) {
    if (error.code === "23505") {
      return { error: "Nomor meja sudah ada di outlet ini." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/owner/meja");
  return { success: true };
}

export async function toggleTableActive(id: string, is_active: boolean) {
  const supabase = await requireOwner();
  const { error } = await supabase
    .from("tables")
    .update({ is_active })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/owner/meja");
  return { success: true };
}

export async function deleteTable(id: string) {
  const supabase = await requireOwner();
  const { error } = await supabase.from("tables").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/owner/meja");
  return { success: true };
}