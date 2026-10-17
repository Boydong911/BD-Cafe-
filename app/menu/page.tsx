import { Suspense } from "react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { MenuCatalog } from "@/components/customer/menu-catalog";
import { TableSessionSync } from "@/components/customer/table-session-sync";
import type { MenuCardItem } from "@/components/customer/menu-card";
import { normalizeCustomizationGroups } from "@/lib/menu-customizations";
import { fetchCategoryTree } from "@/lib/categories";
import Image from "next/image";

export const revalidate = 0; // selalu ambil data stok terbaru

export const metadata: Metadata = {
  title: "Menu",
};

type MenuRow = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  image_url: string | null;
  is_available: boolean;
  customization_options: unknown;
  categories: { id: string; name: string } | null;
};

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const { table } = await searchParams;
  const supabase = await createClient();

  const [{ data: menuItems, error: menuError }, categoryGroups] = await Promise.all([
    supabase
      .from("menu_items")
      .select(
        "id, name, description, price, image_url, is_available, customization_options, categories(id, name)"
      )
      .order("name", { ascending: true }),
    fetchCategoryTree(),
  ]);

  const rows = (menuItems ?? []) as unknown as MenuRow[];

  const items: MenuCardItem[] = rows.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: Number(item.price),
    image_url: item.image_url,
    is_available: item.is_available,
    category_id: item.categories?.id ?? null,
    category_name: item.categories?.name ?? null,
    customization_groups: normalizeCustomizationGroups(item.customization_options),
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
          groups={categoryGroups}
          tableParam={table ?? null}
        />
      )}
    </div>
  );
}