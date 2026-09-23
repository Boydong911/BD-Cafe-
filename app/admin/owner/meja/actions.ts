// File: app/admin/owner/meja/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await requireOwner();
  const { error } = await supabase.from("tables").insert(parsed.data);

  if (error) {
    if (error.code === "23505") return { error: "Nomor meja sudah ada" };
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