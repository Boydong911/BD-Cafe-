// File: app/daftar/actions.ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loginWithPassword } from "./helpers";

export type DaftarState = {
  error?: string;
  success?: string;
};

/**
 * Pendaftaran karyawan baru dari halaman publik `/daftar`.
 *
 * PENTING soal keamanan:
 *   Halaman ini bisa diakses siapa saja yang membuka link-nya, jadi siapa pun
 *   bisa membuat akun kasir tanpa lewat owner dulu. Itu memang yang diminta
 *   owner (kasir bisa mendaftar sendiri), tapi konsekuensinya harus jelas:
 *   siapa pun yang tahu URL /daftar bisa masuk ke dashboard kasir.
 *
 *   Yang TIDAK bisa dilakukan lewat halaman ini:
 *     - memilih role sendiri (selalu 'kasir', di-hardcode di SQL)
 *     - menyentuh akun owner
 *     - membaca data karyawan lain
 *
 * Password di-hash di dalam database. String aslinya tidak pernah disimpan,
 * jadi kalau ini bocor, yang bocor adalah hash-nya — bukan password.
 */
const daftarSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(3, "Nama lengkap minimal 3 karakter")
    .max(100, "Nama lengkap terlalu panjang"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username minimal 3 karakter")
    .max(30, "Username maksimal 30 karakter")
    .regex(
      /^[a-z0-9._-]+$/,
      "Username hanya boleh huruf kecil, angka, titik, _ dan -"
    ),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export async function daftarAction(
  _prevState: DaftarState,
  formData: FormData
): Promise<DaftarState> {
  const parsed = daftarSchema.safeParse({
    full_name: formData.get("full_name"),
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const supabase = await createClient();

  // Pakai register_staff_account(), bukan create_staff_account(). Yang latter
  // hanya bisa dipanggil owner; ini halaman publik, jadi pakai function
  // khusus yang role-nya di-hardcode 'kasir' di dalam SQL.
  const { error } = await supabase.rpc("register_staff_account", {
    p_username: parsed.data.username,
    p_password: parsed.data.password,
    p_full_name: parsed.data.full_name,
  });

  if (error) {
    return { error: error.message };
  }

  // Akun langsung dipakai: sign-in di sini supaya kasir tidak perlu mengetik
  // ulang username & password yang baru saja dibuat.
  const login = await loginWithPassword(parsed.data.username, parsed.data.password);
  if (!login.ok) {
    return {
      success: `Akun ${parsed.data.username} berhasil dibuat. Silakan masuk dengan username & password tadi.`,
    };
  }

  redirect("/admin/kasir");
}
