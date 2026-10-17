import { Suspense, cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MenuDetail } from "@/components/customer/menu-detail";
import { TableSessionSync } from "@/components/customer/table-session-sync";
import { normalizeCustomizationGroups } from "@/lib/menu-customizations";
import { menuHref } from "@/lib/menu-href";
import { tableTitle } from "@/lib/page-title";

export const revalidate = 0; // selalu ambil stok & harga terbaru

type DetailRow = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  image_url: string | null;
  is_available: boolean;
  customization_options: unknown;
  categories: { name: string } | null;
};

/*
 * Bungkus query dengan cache() supaya generateMetadata dan halaman tidak
 * menembak database dua kali untuk id yang sama.
 *
 * cache() hanya bertahan selama satu permintaan render, jadi halaman
 * berikutnya tetap membaca data terbaru dari database -- tidak ada menu
 * basi karena cache.
 */
const fetchItem = cache(async (id: string) => {
  const supabase = await createClient();

  return supabase
    .from("menu_items")
    .select(
      "id, name, description, price, image_url, is_available, customization_options, categories(name)"
    )
    .eq("id", id)
    .maybeSingle();
});

/*
 * Berbeda dari halaman lain, judul di sini memakai nama menunya:
 * "Kopi Susu Gula Aren - BD Cafe". Ini yang muncul di tab browser saat
 * pelanggan menyimpan halaman atau mengirimkannya ke grup.
 *
 * Kalau dibuka lewat `?table=`, nomor meja ikut di depan supaya kasir
 * tahu tanpa harus bertanya:
 *   "Our Menu Meja No 02 - Kopi Susu Gula Aren - BD Cafe"
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ table?: string }>;
}): Promise<Metadata> {
  const [{ id }, { table }] = await Promise.all([params, searchParams]);

  const { data } = await fetchItem(id);
  const row = data as unknown as DetailRow | null;

  const name = row?.name ?? "Menu";
  const prefix = tableTitle(table);

  return {
    title: prefix ? `${prefix} - ${name}` : name,
    description: row?.description ?? undefined,
  };
}

export default async function MenuDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ table?: string }>;
}) {
  const [{ id }, { table }] = await Promise.all([params, searchParams]);

  const { data } = await fetchItem(id);

  if (!data) notFound();

  const row = data as unknown as DetailRow;

  // Buang grup/pilihan kosong supaya UI tidak menampilkan baris tanpa label.
  // Pakai normalizer agar data rusak di DB tidak bikin halaman ini error 500.
  const cleanGroups = normalizeCustomizationGroups(row.customization_options);

  const backHref = menuHref(table);

  return (
    <div className="mx-auto max-w-3xl p-4 pb-28 sm:p-6">
      <Suspense fallback={null}>
        <TableSessionSync />
      </Suspense>

      <MenuDetail
        item={{
          id: row.id,
          name: row.name,
          description: row.description,
          price: Number(row.price),
          image_url: row.image_url,
          is_available: row.is_available,
          category_name: row.categories?.name ?? null,
        }}
        groups={cleanGroups}
        backHref={backHref}
      />
    </div>
  );
}