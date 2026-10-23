// File: lib/site-links.ts

import { PUSAT_SLUG } from "@/lib/outlet-routes";

/**
 * SATU sumber daftar halaman utama BD Cafe — dipakai navbar (site-nav.tsx)
 * dan footer (site-footer.tsx) supaya keduanya selalu sependapat.
 *
 * `href: null` = halamannya belum dibangun; navbar & footer menampilkannya
 * sebagai teks kusam (bukan link yang 404). Begitu halamannya ada, isi
 * `href`-nya di sini dan navbar + footer otomatis jadi link berdua.
 *
 * "Our Menu" selalu tahu outlet konteksnya: di halaman outlet menuju menu
 * outlet tersebut; di landing (tanpa konteks outlet) memakai outlet pusat.
 * Tautan sistem (kasir, dashboard owner, order, checkout) SENGAJA tidak ada
 * di daftar ini — navbar & footer adalah area pelanggan, bukan staf.
 */
export function sitePageLinks(outletSlug: string = PUSAT_SLUG) {
  return [
    { label: "Home", href: "/" as string | null },
    { label: "About Us", href: "/about-us" as string | null },
    { label: "Our Menu", href: `/${outletSlug}/menu` as string | null },
    { label: "Our Outlet", href: "/our-outlet" as string | null },
    { label: "Facility", href: "/facility" as string | null },
    { label: "Partnership", href: "/partnership" as string | null },
    { label: "Proposal", href: "/proposal" as string | null },
    { label: "Contact", href: "/contact" as string | null },
  ];
}

/** Nomor WhatsApp resmi BD Cafe — satu sumber agar tidak ada nomor jadul. */
export const SITE_WA = {
  display: "0895-7115-3695",
  url: "https://wa.me/6289571153695",
};

/** Alamat kedai pusat — satu sumber untuk footer & halaman kontak. */
export const SITE_ADDRESS =
  "Jl. Ngopi Dulu No. 7, Sebelah Toko yang Tutup, Batam";

/** Jam operasional — satu sumber, biar tidak ada jam yang berbeda antar halaman. */
export const SITE_HOURS = "Senin–Minggu · 09.00–23.00 WIB";
