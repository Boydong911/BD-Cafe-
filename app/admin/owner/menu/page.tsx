import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { MenuTable } from "@/components/admin/menu-table";
import { OutletPicker } from "@/components/admin/outlet-picker";
import { fetchCategoryTree } from "@/lib/categories";
import { fetchOutlets, pickOutlet } from "@/lib/outlets";
import type { MenuItemRow } from "@/types/menu";

export const metadata: Metadata = {
  title: "Kelola Menu",
};

export default async function OwnerMenuPage({
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
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Menu & Produk</h1>
        <p className="rounded-xl border border-amber-600/30 bg-amber-600/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-400">
          Belum ada outlet terdaftar. Jalankan dulu fondasi multi-outlet
          (supabase/migrations/20261020-01-fondasi-multi-outlet.sql) di
          Supabase SQL Editor.
        </p>
      </div>
    );
  }

  const [{ data, error }, categoryGroups] = await Promise.all([
    supabase
      .from("menu_items")
      .select("*, categories(name)")
      .eq("outlet_id", outlet.id)
      .order("created_at", { ascending: false }),
    fetchCategoryTree(),
  ]);

  const menuItems = (data ?? []) as unknown as MenuItemRow[];

  return (
    <div className="space-y-6">
      {/* `flex-col sm:flex-row` supaya tombol turun ke bawah di layar HP */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Menu & Produk</h1>
          <p className="text-sm text-muted-foreground">
            Menu milik{" "}
            <span className="font-medium text-foreground">{outlet.nama}</span>.
            Kategori dipakai bersama semua outlet.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <OutletPicker outlets={outlets} currentSlug={outlet.slug} />
          <Button
            asChild
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
          >
            <Link href={`/admin/owner/menu/new?outlet=${outlet.slug}`}>
              <Plus className="mr-1.5 h-4 w-4" />
              Tambah Menu
            </Link>
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">Gagal memuat menu: {error.message}</p>}

      <MenuTable items={menuItems} groups={categoryGroups} outletSlug={outlet.slug} />
    </div>
  );
}
