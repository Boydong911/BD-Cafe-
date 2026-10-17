import { Suspense } from "react";
import type { Metadata } from "next";
import { HeroSection } from "@/components/customer/hero-section";
import { TableSessionSync } from "@/components/customer/table-session-sync";
import { createClient } from "@/lib/supabase/server";
import type { ShowcaseMenuItem } from "@/components/customer/menu-showcase-slider";

/*
 * Catatan: judul di sini sengaja TANPA akhiran "-BD Cafe".
 *
 * Title template dari app/layout.tsx tidak berlaku untuk page.tsx di
 * segmen yang sama -- Next.js hanya menerapkannya ke segmen anak.
 *
 * Di halaman depan, menampilkan nama cafe saja lebih rapi: ini yang
 * pertama dilihat orang, jadi yang tampil sebaiknya brand, bukan
 * label halaman.
 */
export const metadata: Metadata = {
  title: "BD Cafe",
};

const FOOD_CATEGORY = "Makanan Ringan";

type RawMenuRow = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  categories: { name: string } | null;
};

async function getShowcaseMenu(): Promise<ShowcaseMenuItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, price, image_url, is_available, categories(name)")
    .eq("is_available", true);

  if (error || !data) return [];

  // TODO: root cause-nya sama kayak 9-12 Problems lama di menu/page.tsx —
  // Supabase client belum di-generic-type ke `Database`. Workaround cast
  // manual dulu di sini, fix permanen nanti pas beres-beres Problems lama.
  const rows = data as unknown as RawMenuRow[];

  const items = rows.map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    category: item.categories?.name ?? "Menu",
    imageUrl: item.image_url,
  }));

  const drinks = items.filter((i) => i.category !== FOOD_CATEGORY);
  const food = items.filter((i) => i.category === FOOD_CATEGORY);

  const favoriteDrinks = drinks
    .slice(0, 3)
    .map((i) => ({ ...i, tag: "✨ Minuman Favorit" }));
  const favoriteFood = food
    .slice(0, 3)
    .map((i) => ({ ...i, tag: "✨ Makanan Favorit" }));

  return [...favoriteDrinks, ...favoriteFood];
}

export default async function HomePage() {
  const menuItems = await getShowcaseMenu();

  return (
    <>
      <Suspense fallback={null}>
        <TableSessionSync />
      </Suspense>
      <main>
        <HeroSection menuItems={menuItems} />
      </main>
    </>
  );
}