import "server-only";

import { createClient } from "@/lib/supabase/server";

export type RegistrationEntry = {
  id: string;
  username: string;
  full_name: string | null;
  /** "self_register" = daftar sendiri dari /daftar, "owner" = dibuat owner. */
  source: string;
  created_at: string;
  /** Masih ada di tabel profiles = akunnya masih bisa login. */
  still_active: boolean;
};

/**
 * Pendaftaran karyawan yang belum sempat dilihat owner.
 *
 * Yang dicek: `created_at` lebih baru dari `last_seen_at` owner. Ini disimpan
 * di database (bukan localStorage) supaya tetap berlaku kalau owner ganti
 * perangkat atau membuka dashboard dari HP.
 */
export async function fetchUnseenRegistrations(
  days = 7
): Promise<RegistrationEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("list_recent_registrations", {
    p_days: days,
  });

  if (error) {
    console.error("[registrations] gagal memuat:", error.message);
    return [];
  }

  const entries = (data ?? []) as unknown as RegistrationEntry[];
  if (entries.length === 0) return [];

  // Function RPC-nya sudah dibatasi owner di dalam SQL, tapi dicek lagi di
  // sini supaya tidak pernah menampilkan data kalau pemanggilnya bukan owner.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: seen } = await supabase
    .from("staff_registration_reads")
    .select("last_seen_at")
    .eq("staff_id", user.id)
    .maybeSingle();

  if (!seen) return entries;

  const lastSeen = new Date(seen.last_seen_at).getTime();
  return entries.filter((entry) => new Date(entry.created_at).getTime() > lastSeen);
}
