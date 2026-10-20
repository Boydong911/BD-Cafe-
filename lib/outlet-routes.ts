// File: lib/outlet-routes.ts
//
// Helper URL multi-outlet. PENTING: file ini TIDAK boleh "server-only" karena
// dipakai juga oleh komponen client (SiteNav, menu-card, payment-panel) dan
// middleware. Karena itu isinya cuma konstanta dan pembangun string URL.

/**
 * Slug outlet pusat. DIBEKUKAN oleh seed fondasi multi-outlet (verifikasi 12a)
 * dan aturan pemakaian: pusat tidak bisa diarsipkan, slug tidak pernah diganti.
 * Redirect semua URL lama menyesar ke slug ini.
 */
export const PUSAT_SLUG = "outlet-a";

/** True kalau string boleh dipakai sebagai segmen slug outlet di URL. */
export function isOutletSlug(value: string | undefined | null): boolean {
  return !!value && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/**
 * Bangun URL menu yang mempertahankan nomor meja, sekarang per outlet.
 *
 * Kenapa perlu: pelanggan yang scan QR di meja 02 outlet A harus balik ke
 * `/outlet-a/menu?table=02`, bukan menu outlet lain. Sisipan slug sukar
 * ditangani satu per satu di tempat pemanggil, maka dibungkus di sini.
 *
 * Nomor meja boleh null (takeaway, atau belum ada meja). Hasil tetap
 * `/outlet-a/menu` supaya pemanggil tidak perlu memeriksa dulu.
 *
 * encodeURIComponent dipakai supaya nomor meja yang mengandung spasi atau
 * tanda baca tidak merusak URL.
 */
export function outletMenuHref(
  outletSlug: string,
  tableNumber?: string | null
): string {
  const table = (tableNumber ?? "").trim();
  if (!table) return `/${outletSlug}/menu`;
  return `/${outletSlug}/menu?table=${encodeURIComponent(table)}`;
}

/** URL halaman detail menu per outlet (nomor meja dibawa kalau ada). */
export function outletMenuDetailHref(
  outletSlug: string,
  menuItemId: string,
  tableNumber?: string | null
): string {
  const table = (tableNumber ?? "").trim();
  if (!table) return `/${outletSlug}/menu/${menuItemId}`;
  return `/${outletSlug}/menu/${menuItemId}?table=${encodeURIComponent(table)}`;
}
