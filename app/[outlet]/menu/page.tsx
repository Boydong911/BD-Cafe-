import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MenuCatalog } from "@/components/customer/menu-catalog";
import { CartSheet } from "@/components/customer/cart-sheet";
import { SiteNav } from "@/components/customer/site-nav";
import { SiteFooter } from "@/components/customer/site-footer";
import { TableSessionSync } from "@/components/customer/table-session-sync";
import { fetchMenuCatalog } from "@/lib/categories";
import { fetchOutletBySlug } from "@/lib/outlets";
import { tableTitle } from "@/lib/page-title";

export const revalidate = 0; // selalu ambil data stok terbaru

/*
 * Harus generateMetadata, bukan metadata statis, karena judulnya
 * bergantung pada slug outlet dan `?table=` di URL.
 *
 * Hasil:
 *   /outlet-a/menu?table=02 -> "Our Menu Meja No 02 - ${nama outlet} - BD Cafe"
 *   /outlet-b/menu          -> "Menu Outlet ${nama outlet} - BD Cafe"
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ outlet: string }>;
  searchParams: Promise<{ table?: string }>;
}): Promise<Metadata> {
  const [{ outlet: slug }, { table }] = await Promise.all([params, searchParams]);
  const outlet = await fetchOutletBySlug((slug ?? "").toLowerCase());

  if (!outlet) return { title: "Outlet tidak dikenal" };
  if (!outlet.is_active) return { title: `${outlet.nama} sedang tutup` };

  const tabel = tableTitle(table);
  return {
    title: tabel
      ? `${tabel} - ${outlet.nama}`
      : `Menu Outlet ${outlet.nama}`,
  };
}

export default async function OutletMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ outlet: string }>;
  searchParams: Promise<{ table?: string }>;
}) {
  const [{ outlet: slug }, { table }] = await Promise.all([params, searchParams]);

  /*
   * Slug dicek di database, bukan dipercaya dari URL. Alasannya:
   *   - QR yang tercetak mungkin salah ketik -> jangan tampilkan menu
   *     outlet yang salah, tampilkan halaman "tidak dikenal".
   *   - Outlet yang diarsipkan tetap punya slug, tapi menu-nya tidak
   *     ditampilkan lagi.
   */
  const outlet = await fetchOutletBySlug((slug ?? "").toLowerCase());
  if (!outlet) notFound();

  if (!outlet.is_active) {
    // Outlet dulu aktif (QR tercetak betulan) tapi sekarang diarsipkan.
    // Pesan ramah, bukan 404, supaya pelanggan tahu ini bukan salah QR.
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <Image
          src="/LOGO.png"
          alt="BD Cafe"
          width={88}
          height={88}
          priority
          className="h-20 w-20 object-contain sm:h-24 sm:w-24"
        />
        <h1 className="font-serif text-2xl font-bold">{outlet.nama} sedang tutup</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Outlet ini sedang tidak menerima pesanan. Silakan kembali lagi nanti
          atau kunjungi outlet kami yang lain.
        </p>
      </div>
    );
  }

  // Menu milik outlet INI — bukan gabungan semua outlet.
  const { items, groups } = await fetchMenuCatalog(outlet.id);

  return (
    <div className="min-h-dvh">
      {/*
        Navbar hanya untuk halaman katalog (menu tanpa ?table=).

        Kalau pelanggan datang dari QR meja, layar HP-nya sudah penuh dengan
        tombol pesan di setiap kartu -- navbar hanya memakan ruang dan
        menjauhkan menu dari jangkauan ibu jari. Logo di bawah yang menggantikannya.
      */}
      {!table && <SiteNav outletSlug={outlet.slug} />}

      <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 sm:p-6">
        <Suspense fallback={null}>
          <TableSessionSync outletSlug={outlet.slug} />
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

          <h1 className="font-serif text-3xl font-bold">{outlet.nama} Menu</h1>
          {table && (
            <p className="text-sm text-muted-foreground">
              Meja <span className="font-medium text-foreground">{table}</span> —
              pilih menu untuk mulai pesan.
            </p>
          )}
        </div>

        {items.length === 0 ? (
          // Menu outlet ini masih kosong — identik dengan kondisi "kasir
          // lupa menyalin menu" pada outlet baru. Pesan ramah, bukan
          // katalog kosong yang membeku.
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="font-serif text-lg font-semibold">Maaf, menu belum ada.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Menu outlet ini sedang disiapkan. Mampir lagi sekejap lagi, ya.
            </p>
          </div>
        ) : (
          <MenuCatalog
            items={items}
            groups={groups}
            tableParam={table ?? null}
            outletSlug={outlet.slug}
            centerFilter
          />
        )}
      </div>

      {/*
        Footer hanya untuk menu KATALOG (tanpa ?table=). Pelanggan yang datang
        dari QR meja sedang dalam mode pesan-cepat; footer hanya menambah
        scroll panjang yang tidak perlu.
      */}
      {!table && <SiteFooter />}

      {/*
        Tombol keranjang mengambang hanya saat ada meja. Di menu polos
        halaman ini katalog saja -- tidak ada yang bisa ditambahkan dari
        sana, jadi keranjang hanya menambah ruang yang terisi.
      */}
      {table && <CartSheet />}
    </div>
  );
}
