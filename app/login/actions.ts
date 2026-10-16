"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  username: z.string().min(3, "Username minimal 3 karakter"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export type LoginState = {
  error?: string;
};

/**
 * Verifikasi kredensial lalu kembalikan id user-nya.
 *
 * Password TIDAK PERNAH lewat ke RPC mana pun — `get_login_email()` hanya
 * mengembalikan email internal. Verifikasi password dilakukan Supabase Auth
 * sendiri terhadap hash bcrypt yang tersimpan di auth.users.
 */
/**
 * Hasil verifikasi kredensial.
 *
 * Bentuknya satu objek dengan field opsional, bukan discriminated union:
 * project ini masih `strict: false`, dan tanpa strictNullChecks TypeScript
 * tidak mau mempersempit union lewat `if (!result.ok)`.
 */
type VerifyResult = {
  ok: boolean;
  error?: string;
  userId?: string;
  role?: "owner" | "kasir";
};

async function verifyCredentials(
  username: string,
  password: string
): Promise<VerifyResult> {
  const supabase = await createClient();

  // 1) Terjemahkan username -> email internal lewat RPC (SECURITY DEFINER).
  const { data: email, error: rpcError } = await supabase.rpc("get_login_email", {
    p_username: username,
  });

  if (rpcError || !email) {
    // Pesan digeneralisir supaya tidak bocorkan apakah username ada atau tidak.
    return { ok: false, error: "Username atau password salah." };
  }

  // 2) Sign-in sesungguhnya ke Supabase Auth — password di-verifikasi
  //    terhadap hash bcrypt oleh Supabase sendiri.
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.user) {
    return { ok: false, error: "Username atau password salah." };
  }

  // 3) Ambil role untuk menentukan halaman tujuan.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", signInData.user.id)
    .single();

  return {
    ok: true,
    userId: signInData.user.id,
    role: profile?.role === "owner" ? "owner" : "kasir",
  };
}

/**
 * Login untuk dashboard OWNER (`/login`).
 *
 * Akun kasir yang masuk ke sini akan dialihkan ke halaman kasir — supaya
 * jelas halaman mana yang harus dipakai.
 */
export async function ownerLoginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const result = await verifyCredentials(parsed.data.username, parsed.data.password);

  if (!result.ok) {
    return { error: result.error ?? "Username atau password salah." };
  }

  if (result.role !== "owner") {
    // Jangan sampai kasir diam-diam mendarat di halaman owner.
    redirect("/login/kasir");
  }

  redirect("/admin/owner");
}

/** Login untuk dashboard KASIR (`/login/kasir`). */
export async function kasirLoginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const result = await verifyCredentials(parsed.data.username, parsed.data.password);

  if (!result.ok) {
    return { error: result.error ?? "Username atau password salah." };
  }

  redirect("/admin/kasir");
}

/**
 * Keluar dari sesi.
 *
 * Arahkan ke halaman login yang SESUAI dengan role-nya, bukan selalu ke
 * `/login` (halaman owner). Kasir yang keluar dari dashboard kasir akan
 * mendarat di `/login/kasir`, jadi tidak salah masuk ke halaman owner.
 *
 * Role dibaca SEBELUM signOut — sesudah keluar, sesi sudah tidak ada dan
 * tidak ada cara tahu dia kasir atau owner.
 */
export async function logoutAction() {
  const supabase = await createClient();

  let target = "/login/kasir";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "owner") target = "/login";
  }

  await supabase.auth.signOut();
  redirect(target);
}
