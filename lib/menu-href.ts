/**
 * Bangun URL menu yang mempertahankan nomor meja.
 *
 * Kenapa perlu: pelanggan yang scan QR di meja 02 harus balik ke
 * `/menu?table=02`, bukan `/menu` biasa. Kalau mejaknya hilang,
 * TableSessionSync menjalankan clearScannedTable() dan sesi meja ikut
 * terhapus -- pelanggan diminta memilih ulang.
 *
 * Nomor meja boleh null (takeaway, atau belum ada meja). Hasilnya tetap
 * `/menu` supaya pemanggil tidak perlu memeriksa dulu.
 *
 * encodeURIComponent dipakai supaya nomor meja yang mengandung spasi atau
 * tanda baca tidak merusak URL.
 */
export function menuHref(tableNumber?: string | null): string {
  const table = (tableNumber ?? "").trim();
  if (!table) return "/menu";
  return `/menu?table=${encodeURIComponent(table)}`;
}