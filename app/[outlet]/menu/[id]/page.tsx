import { Suspense, cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MenuDetail } from "@/components/customer/menu-detail";
import { CartSheet } from "@/components/customer/cart-sheet";
import { TableSessionSync } from "@/components/customer/table-session-sync";
import { normalizeCustomizationGroups } from "@/lib/menu-customizations";
import { outletMenuHref } from "@/lib/outlet-routes";
import { fetchOutletBySlug } from "@/lib/outlets";
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
const fetchItem = cache(async (id: string, outletId: string) => {
  const supabase = await createClient();

  return supabase
    .from("menu_items")
    .select(
      "id, name, description, price, image_url, is_available, customization_options, categories(name)"
    )
    .eq("id", id)
    // Menu WAJIB milik outlet di URL — menu outlet B lewat link /outlet-a
    // tidak boleh tampil walau id-nya sah.
    .eq("outlet_id", outletId)
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
  params: Promise<{ outlet: string; id: string }>;
  searchParams: Promise<{ table?: string }>;
}): Promise<Metadata> {
  const [{ outlet: slug, id }, { table }] = await Promise.all([params, searchParams]);

  const outlet = await fetchOutletBySlug((slug ?? "").toLowerCase());
  if (!outlet) return { title: "Outlet tidak dikenal" };

  const { data } = await fetchItem(id, outlet.id);
  const row = data as unknown as DetailRow | null;

  const name = row?.name ?? "Menu";
  const prefix = tableTitle(table);

  return {
    title: prefix ? `${prefix} - ${name}` : name,
    description: row?.description ?? undefined,
  };
}

export default async function OutletMenuDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ outlet: string; id: string }>;
  searchParams: Promise<{ table?: string }>;
}) {
  const [{ outlet: slug, id }, { table }] = await Promise.all([params, searchParams]);

  const outlet = await fetchOutletBySlug((slug ?? "").toLowerCase());
  if (!outlet) notFound();

  const { data } = await fetchItem(id, outlet.id);

  if (!outlet.is_active) notFound();
  if (!data) notFound();

  const row = data as unknown as DetailRow;

  // Buang grup/pilihan kosong supaya UI tidak menampilkan baris tanpa label.
  // Pakai normalizer agar data rusak di DB tidak bikin halaman ini error 500.
  const cleanGroups = normalizeCustomizationGroups(row.customization_options);

  // Kembali ke katalog outlet yang sama, membawa nomor meja kalau ada.
  const backHref = outletMenuHref(outlet.slug, table ?? null);

  return (
    <div className="mx-auto max-w-3xl p-4 pb-28 sm:p-6">
      <Suspense fallback={null}>
        <TableSessionSync outletSlug={outlet.slug} />
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

      {/* Detail menu selalu bisa dipesan, jadi keranjang selalu ada. */}
      <CartSheet />
    </div>
  );
}
