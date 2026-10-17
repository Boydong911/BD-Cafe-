import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { MenuCatalog } from "@/components/customer/menu-catalog";
import { CartSheet } from "@/components/customer/cart-sheet";
import { SiteNav } from "@/components/customer/site-nav";
import { TableSessionSync } from "@/components/customer/table-session-sync";
import { fetchMenuCatalog } from "@/lib/categories";
import { tableTitle } from "@/lib/page-title";

export const revalidate = 0; // selalu ambil data stok terbaru

/*
 * Harus generateMetadata, bukan metadata statis, karena judulnya
 * bergantung pada `?table=` di URL.
 *
 * Hasil:
 *   /menu          -> "Menu - BD Cafe"
 *   /menu?table=02 -> "Our Menu Meja No 02 - BD Cafe"
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}): Promise<Metadata> {
  const { table } = await searchParams;

  return {
    title: tableTitle(table) || "Menu",
  };
}

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const [{ table }] = await Promise.all([searchParams]);
  const { items, groups } = await fetchMenuCatalog();

  return (
    <div className="min-h-dvh">
      {/*
        Navbar hanya untuk halaman katalog (/menu tanpa ?table=).

        Kalau pelanggan datang dari QR meja, layar HP-nya sudah penuh dengan
        tombol pesan di setiap kartu -- navbar hanya memakan ruang dan
        menjauhkan menu dari jangkauan ibu jari. Logo di bawah yang menggantikannya.
      */}
      {!table && <SiteNav />}

      <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 sm:p-6">
      <Suspense fallback={null}>
        <TableSessionSync />
      </Suspense>

      <div className="flex flex-col items-center gap-2 text-center">
        {table && (
          <Image
            src="/LOGO.png"
            alt="BD Cafe"
            width={88}
            height={88}
            priority
            className="h-20 w-20 object-contain sm:h-24 sm:w-24"
          />
        )}

        <h1 className="font-serif text-3xl font-bold">BD Cafe Menu</h1>
        {table && (
          <p className="text-sm text-muted-foreground">
            Meja <span className="font-medium text-foreground">{table}</span> —
            pilih menu untuk mulai pesan.
          </p>
        )}
      </div>

      <MenuCatalog
        items={items}
        groups={groups}
        tableParam={table ?? null}
        centerFilter
      />
      </div>

      {/*
        Tombol keranjang mengambang hanya saat ada meja. Di /menu polos
        halaman ini katalog saja -- tidak ada yang bisa ditambahkan dari
        sana, jadi keranjang hanya menambah ruang yang terisi.
      */}
      {table && <CartSheet />}
    </div>
  );
}