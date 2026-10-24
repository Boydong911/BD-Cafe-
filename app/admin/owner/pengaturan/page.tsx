import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PasswordChangeForm } from "./password-change-form";

export const metadata: Metadata = {
  title: "Pengaturan Toko",
};

export default async function OwnerPengaturanPage() {
  /*
   * Username akun yang sedang bersesi, ditampilkan di kartu supaya owner
   * tahu pintu mana yang passwordnya sedang diganti. Gagal membaca? Kartu
   * tetap jalan tanpa nama.
   */
  const supabase = await createClient("owner");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    username = profile?.username ?? null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Pengaturan Toko
        </h1>
        <p className="text-sm text-muted-foreground">
          Kelola akun & pengaturan kedai di sini.
        </p>
      </div>

      {/* Pengaturan pertama: ganti password login owner */}
      <div className="max-w-md">
        <PasswordChangeForm username={username} />
      </div>
    </div>
  );
}
