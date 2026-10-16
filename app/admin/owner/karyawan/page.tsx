// File: app/admin/owner/karyawan/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StaffManager, type StaffRow } from "@/components/admin/staff-manager";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware sudah menyaring, tapi halaman ini memanggil function SQL yang
  // hanya ada untuk owner — jadi cek lagi di sini agar pesannya jelas.
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  if (!user || profile?.role !== "owner") {
    redirect("/admin/owner");
  }

  const { data, error } = await supabase.rpc("list_staff");

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-2xl font-bold text-foreground">Karyawan</h1>
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Gagal memuat daftar karyawan: {error.message}
          <br />
          <span className="text-xs">
            Jalankan migrasi <code>20261017-create-staff.sql</code> di Supabase
            SQL Editor.
          </span>
        </p>
      </div>
    );
  }

  const staff = (data ?? []) as unknown as StaffRow[];

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Karyawan</h1>
        <p className="text-sm text-muted-foreground">
          Kelola akun yang bisa login ke dashboard. Kasir hanya melihat dan
          memproses pesanan; owner punya akses penuh.
        </p>
      </div>

      <StaffManager staff={staff} currentUserId={user.id} />
    </div>
  );
}
