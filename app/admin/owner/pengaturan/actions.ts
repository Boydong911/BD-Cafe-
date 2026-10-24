"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const changePasswordSchema = z
  .object({
    current: z.string().min(6, "Password sekarang minimal 6 karakter"),
    next: z.string().min(6, "Password baru minimal 6 karakter"),
    confirm: z.string().min(6, "Konfirmasi password minimal 6 karakter"),
  })
  .refine((v) => v.next === v.confirm, {
    message: "Konfirmasi password tidak sama dengan password baru.",
    path: ["confirm"],
  });

export type ChangePasswordState = {
  error?: string;
  success?: string;
};

/**
 * Ubah password login OWNER dari halaman Pengaturan.
 *
 * Jalur wajib menembus dua gerbang dulu:
 *   1) Middleware — /admin/owner* hanya bisa dibuka dengan sesi seat owner.
 *   2) Di sini — role profil yang bersesi WAJIB owner (kalau RLS/jaringan timpang,
 *      aksi ditolak, bukan dipercaya dari URL).
 *
 * Password sekarang di-verifikasi dulu dengan signInWithPassword lewat email
 * internal user yang bersesi — Supabase Auth cek hash bcrypt-nya sendiri.
 * Sesi seat owner SETELAH verifikasi adalah sesi user yang sama (cookie seat
 * tertulis ulang), jadi dashboard tidak terasa apa-apa.
 */
export async function changeOwnerPasswordAction(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const parsed = changePasswordSchema.safeParse({
    current: formData.get("current_password"),
    next: formData.get("new_password"),
    confirm: formData.get("confirm_password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const supabase = await createClient("owner");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { error: "Sesi berakhir. Login lagi ya." };
  }

  // Gerbang kedua: profil yang bersesi harus owner.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "owner") {
    return { error: "Halaman ini khusus owner." };
  }

  // 1) Verifikasi password SEKARANG (sign-in ulang dengan kredensial lama).
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current,
  });
  if (verifyError) {
    // Sengaja digenalisir: entah user lupa password / typo — pesannya satu.
    return { error: "Password sekarang salah." };
  }

  // 2) Simpan password yang baru di sesi yang sama.
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.next,
  });

  if (error) {
    console.error("[pengaturan] updateUser password gagal:", error.message);
    return { error: "Gagal mengubah password. Coba lagi sebentar." };
  }

  return {
    success: "Password berhasil diubah — pakai password yang baru di login berikutnya.",
  };
}
