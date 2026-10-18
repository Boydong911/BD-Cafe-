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
    // Pesan ke pengguna digeneralisir supaya tidak bocorkan apakah username
    // ada atau tidak. Detail sebenarnya hanya ditulis ke log server, karena
    // "get_login_email tidak mengembalikan email" dan "RPC-nya error" adalah
    // dua masalah yang sangat berbeda.
    const detail = `DEBUG-1 rpc: ${rpcError?.message ?? "tidak ada error"} | email: ${email ?? "null"}`;
    console.error("[login]", detail);
    return { ok: false, error: detail };
  }

  // 2) Sign-in sesungguhnya ke Supabase Auth — password di-verifikasi
  //    terhadap hash bcrypt oleh Supabase sendiri.
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.user) {
    /*
     * GoTrue membalas dengan alasan yang sangat berbeda-beda, dan itu satu-
     * satunya petunjuk yang benar-benar berguna. Contoh pesan yang pernah
     * muncul:
     *   Invalid login credentials  -> email tidak ketemu, atau hash tidak cocok
     *   Email not confirmed        -> email_confirmed_at kosong
     *
     * Semua disamarkan jadi satu kalimat supaya tidak membocorkan apakah
     * username itu ada. Detailnya ditulis ke log server saja, TIDAK pernah
     * dikirim ke peramban.
     */
    const detail = `DEBUG-2 auth: status=${signInError?.status ?? "-"} code=${signInError?.code ?? "-"} pesan=${signInError?.message ?? "-"} | email=${email} | adaUser=${Boolean(signInData?.user)}`;
    console.error("[login]", detail);
    return { ok: false, error: detail };
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

async function signOutThenRedirect(target: "/login" | "/login/kasir") {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(target);
}

/**
 * Keluar dari sesi dari sidebar owner.
 *
 * Tujunya dibaca dari ROLE akun: kasir yang logout dari mana pun mendarat
 * di /login/kasir, owner di /login.
 *
 * Role harus dibaca SEBELUM signOut -- sesudah keluar, sesi sudah tidak ada
 * dan tidak ada cara tahu dia kasir atau owner.
 */
export async function logoutAction() {
  const supabase = await createClient();

  let target: "/login" | "/login/kasir" = "/login/kasir";

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

  return signOutThenRedirect(target);
}

/**
 * Keluar dari sesi dari DASHBOARD KASIR.
 *
 * Selalu ke /login/kasir, apa pun role akun yang sedang dipakai.
 *
 * Kalau tujuannya ikut mengikuti role, hasilnya bergantung pada siapa yang
 * menekan, bukan dari halaman mana. Owner yang sedang mencoba alur kasir
 * memakai akun owner-nya, lalu keluar dari /admin/kasir dan mendarat di
 * login owner -- padahal dia menekan tombol di halaman kasir.
 */
export async function kasirLogoutAction() {
  return signOutThenRedirect("/login/kasir");
}
