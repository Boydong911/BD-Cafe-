import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { MenuCatalog } from "@/components/customer/menu-catalog";
import { TableSessionSync } from "@/components/customer/table-session-sync";
import type { MenuCardItem } from "@/components/customer/menu-card";
import Image from "next/image";

export const revalidate = 0; // selalu ambil data stok terbaru

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const { table } = await searchParams;
  const supabase = await createClient();

  const [{ data: menuItems, error: menuError }, { data: categories }] =
    await Promise.all([
      supabase
        .from("menu_items")
        .select("id, name, description, price, image_url, is_available, categories(name)")
        .order("name", { ascending: true }),
      supabase
        .from("categories")
        .select("id, name")
        .order("sort_order", { ascending: true }),
    ]);

    type MenuRow = {
    id: string;
    name: string;
    description: string | null;
    price: number | string;
    image_url: string | null;
    is_available: boolean;
    categories: { name: string } | null;
  };

  const rows = (menuItems ?? []) as unknown as MenuRow[];

  const items: MenuCardItem[] = rows.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: Number(item.price),
    image_url: item.image_url,
    is_available: item.is_available,
    category_name: item.categories?.name ?? null,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 sm:p-6">
      <Suspense fallback={null}>
        <TableSessionSync />
      </Suspense>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">BD Coffee Menu</h1>
          {table && (
            <p className="text-sm text-muted-foreground">
              Meja <span className="font-medium">{table}</span> — pilih menu untuk mulai pesan.
            </p>
          )}
        </div>
        <Image
          src="/logo.png"
          alt="BD Coffee"
          width={64}
          height={64}
          priority
          className="h-20 w-20 shrink-0 object-contain"
        />
      </div>

      {menuError ? (
        <p className="text-sm text-destructive">
          Gagal memuat menu. Silakan refresh halaman.
        </p>
      ) : (
        <MenuCatalog
          items={items}
          categories={categories ?? []}
          tableParam={table ?? null}
        />
      )}
    </div>
  );
}