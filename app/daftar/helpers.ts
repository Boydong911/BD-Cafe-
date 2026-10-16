import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Sign-in memakai username + password.
 *
 * Username diterjemahkan ke email internal lewat RPC `get_login_email()`
 * (SECURITY DEFINER), lalu password diverifikasi Supabase Auth terhadap hash
 * bcrypt-nya. Password tidak pernah melewati RPC mana pun.
 *
 * Dibuat sebagai helper (bukan "use server") supaya bisa dipakai dari
 * beberapa server action tanpa menduplikasi logikanya.
 */
export async function loginWithPassword(
  username: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data: email, error: rpcError } = await supabase.rpc("get_login_email", {
    p_username: username,
  });

  if (rpcError || !email) {
    return { ok: false, error: "Username atau password salah." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { ok: false, error: "Username atau password salah." };
  return { ok: true };
}
