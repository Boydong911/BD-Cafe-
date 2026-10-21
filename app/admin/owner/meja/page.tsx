// File: app/admin/owner/meja/page.tsx
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { TableManager } from "@/components/admin/table-manager";
import { OutletPicker } from "@/components/admin/outlet-picker";
import { fetchOutlets, pickOutlet } from "@/lib/outlets";

export const metadata: Metadata = {
  title: "Kelola Meja",
};

export default async function MejaPage({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string }>;
}) {
  const { outlet: outletParam } = await searchParams;
  const supabase = await createClient();

  const outlets = await fetchOutlets();
  const outlet = pickOutlet(outlets, outletParam);

  if (!outlet) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-1">Manajemen Meja</h1>
        <p className="rounded-xl border border-amber-600/30 bg-amber-600/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-400">
          Belum ada outlet terdaftar. Jalankan dulu fondasi multi-outlet
          (supabase/migrations/20261020-01-fondasi-multi-outlet.sql) di
          Supabase SQL Editor.
        </p>
      </div>
    );
  }

  const { data: tables } = await supabase
    .from("tables")
    .select("*")
    .eq("outlet_id", outlet.id)
    .order("table_number", { ascending: true });

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Manajemen Meja</h1>
          <p className="text-muted-foreground">
            Nomor meja unik per outlet — meja untuk{" "}
            <span className="font-medium text-foreground">{outlet.nama}</span>.
          </p>
        </div>
        <OutletPicker outlets={outlets} currentSlug={outlet.slug} />
      </div>

      {/* `key={outlet.id}`: cegah daftar meja basi saat ganti outlet (lihat menu/page.tsx). */}
      <TableManager
        key={outlet.id}
        initialTables={tables ?? []}
        outletId={outlet.id}
        outletSlug={outlet.slug}
      />
    </div>
  );
}
