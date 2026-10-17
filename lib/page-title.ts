/**
 * Nama cafe untuk judul tab.
 *
 * Dipakai di app/layout.tsx sebagai title template, jadi tidak ada lagi
 * string "BD Cafe" yang ditulis manual di file lain.
 */
export const SITE_NAME = "BD Cafe";

/**
 * Title template untuk seluruh halaman.
 *
 * Halaman cukup export `title: "Kasir"`, hasilnya "Kasir - BD Cafe".
 */
export const TITLE_TEMPLATE = `%s - ${SITE_NAME}`;

/**
 * Judul halaman untuk URL yang punya `?table=`.
 *
 * Pelanggan yang pesan dari meja perlu tahu dia sedang di meja berapa.
 * Yang lebih berguna lagi, kasir yang menerima pesanan bisa langsung tahu
 * pesanan itu dari meja mana tanpa perlu bertanya.
 *
 * Mengembalikan string KOSONG kalau tidak ada `?table=`, supaya pemanggil
 * bisa jatuh ke judul umum dengan satu operasi OR.
 *
 * Nilai yang dikembalikan di sini belum ikut TITLE_TEMPLATE, jadi hasil
 * akhirnya "Our Menu Meja No 02 - BD Cafe".
 */
export function tableTitle(table?: string | null): string {
  const trimmed = (table ?? "").trim();
  return trimmed ? `Our Menu Meja No ${trimmed}` : "";
}