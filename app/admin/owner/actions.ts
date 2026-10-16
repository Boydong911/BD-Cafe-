// File: app/admin/owner/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Tandai notifikasi pendaftaran sudah dibaca.
 *
 * Setelah dipanggil, banner di dashboard owner hilang sampai ada pendaftaran
 * baru. Disimpan di database, bukan localStorage, jadi tetap berlaku kalau
 * owner ganti perangkat.
 */
export async function markRegistrationsSeen(): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Belum masuk." };

  const { error } = await supabase.rpc("mark_registrations_seen", {
    p_staff_id: user.id,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/owner");
  return { success: true };
}
