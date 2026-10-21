// File: app/admin/owner/karyawan/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StaffManager, type StaffRow } from "@/components/admin/staff-manager";
import { OutletPicker } from "@/components/admin/outlet-picker";
import { fetchOutlets, pickOutlet } from "@/lib/outlets";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Karyawan",
};

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string }>;
}) {
  const { outlet: outletParam } = await searchParams;
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

  const [{ data, error }, outlets] = await Promise.all([
    supabase.rpc("list_staff"),
    fetchOutlets(),
  ]);

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-2xl font-bold text-foreground">Karyawan</h1>
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Gagal memuat daftar karyawan: {error.message}
          <br />
          <span className="text-xs">
            Jalankan dulu fondasi multi-outlet
            (supabase/migrations/20261020-01-fondasi-multi-outlet.sql) di
            Supabase SQL Editor.
          </span>
        </p>
      </div>
    );
  }

  const outlet = pickOutlet(outlets, outletParam);

  if (!outlet) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-2xl font-bold text-foreground">Karyawan</h1>
        <p className="rounded-xl border border-amber-600/30 bg-amber-600/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-400">
          Belum ada outlet terdaftar. Jalankan dulu fondasi multi-outlet di
          Supabase SQL Editor.
        </p>
      </div>
    );
  }

  // Papan ini milik SATU outlet terpilih. Akun penjaga (owner) hanya tampil
  // di outlet pusat — dia menjangkau semua outlet, bukan milik satu cabang.
  const allStaff = (data ?? []) as unknown as StaffRow[];
  const staff = allStaff.filter((person) =>
    person.role === "owner" ? outlet.is_pusat : person.outlet_id === outlet.id
  );
  const activeOutlets = outlets.filter((o) => o.is_active);

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Karyawan</h1>
          <p className="text-sm text-muted-foreground">
            Kasir di{" "}
            <span className="font-medium text-foreground">{outlet.nama}</span>{" "}
            hanya melihat dan memproses pesanan outlet ini; owner menjangkau
            semuanya.
          </p>
        </div>
        <OutletPicker outlets={outlets} currentSlug={outlet.slug} />
      </div>

      {/* `key={outlet.id}`: cegah daftar karyawan & default outlet form basi saat ganti outlet. */}
      <StaffManager
        key={outlet.id}
        staff={staff}
        currentUserId={user.id}
        outlets={activeOutlets}
        selectedOutletId={outlet.id}
      />
    </div>
  );
}
