import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { MenuTable } from "@/components/admin/menu-table";
import { fetchCategoryTree } from "@/lib/categories";
import type { MenuItemRow } from "@/types/menu";

export default async function OwnerMenuPage() {
  const supabase = await createClient();

  const [{ data, error }, categoryGroups] = await Promise.all([
    supabase
      .from("menu_items")
      .select("*, categories(name)")
      .order("created_at", { ascending: false }),
    fetchCategoryTree(),
  ]);

  const menuItems = (data ?? []) as unknown as MenuItemRow[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Menu & Produk</h1>
          <p className="text-sm text-muted-foreground">
            Kelola daftar menu, harga, HPP, dan stok BD Coffee.
          </p>
        </div>
        <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/admin/owner/menu/new">
            <Plus className="mr-1.5 h-4 w-4" />
            Tambah Menu
          </Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">Gagal memuat menu: {error.message}</p>}

      <MenuTable items={menuItems} groups={categoryGroups} />
    </div>
  );
}