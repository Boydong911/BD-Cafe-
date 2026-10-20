import type { Metadata } from "next";
import { MenuForm } from "@/components/admin/menu-form";
import { fetchCategoryTree } from "@/lib/categories";
import { fetchOutlets, pickOutlet } from "@/lib/outlets";
import type { MenuFormCategory } from "@/components/admin/menu-form";

export const metadata: Metadata = {
  title: "Tambah Menu",
};

export default async function NewMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string }>;
}) {
  const { outlet: outletParam } = await searchParams;

  const [groups, outlets] = await Promise.all([
    fetchCategoryTree(),
    fetchOutlets(),
  ]);
  const outlet = pickOutlet(outlets, outletParam);

  if (!outlet) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Tambah Menu</h1>
        <p className="rounded-xl border border-amber-600/30 bg-amber-600/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-400">
          Belum ada outlet terdaftar. Jalankan dulu fondasi multi-outlet
          (supabase/migrations/20261020-01-fondasi-multi-outlet.sql) di
          Supabase SQL Editor.
        </p>
      </div>
    );
  }

  // Menu hanya boleh menempel ke SUB-kategori, jadi kategori tingkat atas
  // (Minuman / Makanan) sengaja tidak ikut dikirim ke form.
  const categories: MenuFormCategory[] = groups.flatMap((group) =>
    group.children.map((child) => ({
      id: child.id,
      name: child.name,
      groupName: group.name,
      isDrink: child.isDrink,
    }))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tambah Menu</h1>
        <p className="text-sm text-muted-foreground">
          Isi detail menu baru untuk {outlet.nama}.
        </p>
      </div>
      <MenuForm mode="create" categories={categories} outletId={outlet.id} />
    </div>
  );
}
