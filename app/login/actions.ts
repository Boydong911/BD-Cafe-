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

export async function loginAction(
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

  const { username, password } = parsed.data;
  const supabase = await createClient();

  // 1) Terjemahkan username -> email internal lewat RPC (SECURITY DEFINER).
  //    Password TIDAK pernah lewat di sini — hanya email yang dikembalikan.
  const { data: email, error: rpcError } = await supabase.rpc(
    "get_login_email",
    { p_username: username }
  );

  if (rpcError || !email) {
    // Pesan digeneralisir supaya tidak bocorkan apakah username ada atau tidak.
    return { error: "Username atau password salah." };
  }

  // 2) Sign-in sesungguhnya ke Supabase Auth — password di-verifikasi
  //    terhadap hash bcrypt yang tersimpan di auth.users oleh Supabase sendiri.
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.user) {
    return { error: "Username atau password salah." };
  }

  // 3) Ambil role untuk redirect ke dashboard yang sesuai.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", signInData.user.id)
    .single();

  redirect(profile?.role === "owner" ? "/admin/owner" : "/admin/kasir");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
