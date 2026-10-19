"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Seat } from "@/lib/supabase/seats";

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
  password: string,
  seat: Seat = "owner"
): Promise<VerifyResult> {
  const supabase = await createClient(seat);

  // 1) Terjemahkan username -> email internal lewat RPC (SECURITY DEFINER).
  const { data: email, error: rpcError } = await supabase.rpc("get_login_email", {
    p_username: username,
  });

  if (rpcError || !email) {
    /*
     * Pesan ke pengguna digeneralisir supaya tidak bocorkan apakah username
     * ada atau tidak. Detail sebenarnya hanya ditulis ke log server, karena
     * "get_login_email tidak mengembalikan email" dan "RPC-nya error" adalah
     * dua masalah yang sangat berbeda.
     */
    console.error("[login] RPC get_login_email gagal:", rpcError?.message ?? "tidak ada pesan", "| email:", email ?? "null");
    return { ok: false, error: "Username atau password salah." };
  }

  // 2) Sign-in sesungguhnya ke Supabase Auth — password di-verifikasi
  //    terhadap hash bcrypt oleh Supabase sendiri.
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.user) {
    /*
     * Semua alasan ditulis ke log server SEMENTARA respons yang dikirim ke
     * peramban digeneralisir supaya tidak membocorkan apakah username itu
     * ada. Pesan Auth yang paling berbeda-beda (contoh):
     *   Invalid login credentials  -> email tidak ketemu / hash tidak cocok
     *   Email not confirmed        -> email_confirmed_at kosong
     *   Database error querying schema -> baris user gagal dibaca (kolom NULL)
     */
    console.error(
      "[login] Auth gagal:",
      `status=${signInError?.status ?? "-"}`,
      `code=${signInError?.code ?? "-"}`,
      `pesan=${signInError?.message ?? "-"}`,
      `| email=${email}`
    );
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

  const result = await verifyCredentials(parsed.data.username, parsed.data.password, "owner");

  if (!result.ok) {
    return { error: result.error ?? "Username atau password salah." };
  }

  if (result.role !== "owner") {
    /*
     * Jangan sampai kasir diam-diam mendarat di halaman owner.
     *
     * signInWithPassword di seat owner di atas MEMBUAT sesi untuk akun kasir
     * itu (langkah verifikasi dan pembuatan sesi tak terpisahkan di sisi
     * Supabase Auth). Sesi nyangkut di seat owner berbahaya: sebab akibatnya
     * kasir membawa sesi kasir di area owner. Maka LEPAH sesi tersebut di
     * sini (scope local = hanya seat ini), baru arahkan ke login kasir.
     *
     * `notice` dioper sebagai KODE (bukan teks mentah) supaya URL tidak bisa
     * dipakai menampilkan kata-kata sembarangan; teksnya dipilih di
     * app/login/kasir/page.tsx dari daftar whitelist.
     */
    const supabase = await createClient("owner");
    await supabase.auth.signOut({ scope: "local" });
    redirect("/login/kasir?notice=bukan-owner");
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

  /*
   * Seat "kasir": sesinya menempel di cookie kasir, tidak mengganggu sesi
   * dashboard owner. Owner YANG LURES BOLEH memakai login di sini (dia yang
   * memilih membuka halaman kasir) — karena itu tidak ada pemeriksaan role
   * di jalur ini; pembatasan area hanya di jalur /admin/owner.
   */
  const result = await verifyCredentials(parsed.data.username, parsed.data.password, "kasir");

  if (!result.ok) {
    return { error: result.error ?? "Username atau password salah." };
  }

  redirect("/admin/kasir");
}

async function signOutThenRedirect(target: "/login" | "/login/kasir", seat: Seat) {
  const supabase = await createClient(seat);
  /*
   * scope "local": hanya sesi di seat INI yang dicabut -- sesi milik seat
   * lain (dashboard sebelah) tetap hidup. Nilai default supabase-js adalah
   * "global", yang mencabut SEMUA sesi user itu dan akan melogout dashboard
   * lain di peramban yang sama.
   */
  await supabase.auth.signOut({ scope: "local" });
  redirect(target);
}

/**
 * Keluar dari sesi dari sidebar owner.
 *
 * Seat sudah pasti "owner" — tombol ini hanya ada di halaman dashboard
 * owner, dan /admin/owner hanya bisa dibuka dengan sesi seat owner. Jadi
 * tidak perlu membaca role dulu seperti dulu (waktu keduanya berbagi satu
 * cookie): sign out seat owner, lalu ke /login.
 */
export async function logoutAction() {
  return signOutThenRedirect("/login", "owner");
}

/**
 * Keluar dari sesi dari DASHBOARD KASIR.
 *
 * Seat "kasir": sesi yang dilepah hanya cookie kasir. Sesi dashboard owner
 * di seat lain tidak tersentuh — itulah tujuan pemisahan seat: kasir boleh
 * keluar/masuk tanpa mengganggu owner di peramban yang sama.
 */
export async function kasirLogoutAction() {
  return signOutThenRedirect("/login/kasir", "kasir");
}
