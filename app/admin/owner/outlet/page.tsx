// File: app/admin/owner/outlet/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchOutlets } from "@/lib/outlets";
import {
  OutletManager,
  type OutletCardData,
} from "@/components/admin/outlet-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Outlet",
};

export default async function OutletPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware sudah menyaring halaman owner, tapi cek lagi di sini agar
  // pesannya jelas (pola sama seperti halaman Karyawan).
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  if (!user || profile?.role !== "owner") {
    redirect("/admin/owner");
  }

  const outlets = await fetchOutlets();

  // Hitung menu per outlet di memori - jumlah menu kecil (ratusan paling
  // banyak), jadi lebih murah daripada query group-by terpisah.
  const { data: menuRows } = await supabase
    .from("menu_items")
    .select("outlet_id");
  const menuCount = new Map<string, number>();
  for (const row of menuRows ?? []) {
    menuCount.set(row.outlet_id, (menuCount.get(row.outlet_id) ?? 0) + 1);
  }

  const cards: OutletCardData[] = outlets.map((outlet) => ({
    id: outlet.id,
    slug: outlet.slug,
    nama: outlet.nama,
    tanggal_bangun: outlet.tanggal_bangun,
    menu_mode: outlet.menu_mode,
    is_pusat: outlet.is_pusat,
    is_active: outlet.is_active,
    menuCount: menuCount.get(outlet.id) ?? 0,
  }));

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Outlet</h1>
        <p className="text-muted-foreground">
          Daftar cabang cafe. Slug dibekukan karena tercetak di QR — yang bisa
          die-edit hanya nama &amp; tanggal bangun.
        </p>
      </div>

      <OutletManager outlets={cards} />
    </div>
  );
}
