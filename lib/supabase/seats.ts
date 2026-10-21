// File: lib/supabase/seats.ts

/**
 * Seat sesi yang terpisah di satu peramban.
 *
 * SEBELUMNYA semua dashboard memakai cookie Supabase yang sama
 * (nama default: `sb-<project-ref>-auth-token`). Satu cookie = satu sesi,
 * jadi login owner di dashboard otomatis membuat tab halaman kasir ikut
 * login, dan logout di halaman kasir ikut melogout dashboard owner.
 *
 * SEKARANG tiap seat punya nama cookie sendiri:
 *
 *   seat owner -> `sb-<ref>-auth-token`            (nama default, tidak berubah,
 *                                                  sesi owner yang lama tetap sah)
 *   seat kasir -> `sb-<ref>-auth-token-kasir`      (pola lama, global — hanya
 *                                                  untuk dibersihkan, lihat
 *                                                  legacyKasirStorageKey())
 *   seat kasir PER OUTLET -> `sb-<ref>-auth-token-kasir-<slug>`
 *
 * Jadi di satu peramban bisa hidup BANYAK sesi sekaligus:
 *
 *   - Login owner di dashboard TIDAK mengubah tab halaman kasir.
 *   - Logout di board outlet A TIDAK melogout board outlet B di tab lain —
 *     tiap outlet menyimpan sesi kasirnya sendiri (cookie berbeda nama).
 *   - Owner boleh juga login di halaman kasir (akunnya dipakai di seat
 *     kasir outlet itu) tanpa menyentuh sesi dashboard miliknya.
 *
 * Server menentukan outlet dari header internal `x-bd-outlet` yang disuntik
 * middleware (lihat middleware.ts); Client Component mengoper slug-nya
 * eksplisit karena tidak bisa membaca header.
 *
 * Pemetaan seat -> jalur (lihat middleware.ts):
 *   /admin/owner/*, /login                 -> owner
 *   {slug}/admin/kasir, {slug}/login/kasir,
 *   {slug}/daftar, /login/kasir, /daftar   -> kasir
 *   halaman publik/pelanggan               -> owner (default, cookie hanya
 *                                             dibaca, tidak diubah)
 */
export type Seat = "owner" | "kasir";

/**
 * Nama storage cookie untuk seat kasir.
 *
 * '@supabase/ssr' menamai cookie sesinya `sb-<project-ref>-auth-token`,
 * `project-ref` = label pertama dari hostname Supabase URL.
 *
 * Tanpa slug: nama pola lama (global, satu untuk semua outlet). Dengan slug:
 * nama khusus outlet itu — inilah yang membuat board outlet A dan outlet B
 * bisa menyimpan dua sesi berbeda di satu peramban.
 */
export function kasirStorageKey(outletSlug?: string | null): string {
  const ref =
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").hostname.split(".")[0];
  return outletSlug
    ? `sb-${ref}-auth-token-kasir-${outletSlug}`
    : `sb-${ref}-auth-token-kasir`;
}

/**
 * Nama cookie seat kasir POLA LAMA (global). Cookie ini tidak dibaca lagi —
 * middleware hanya membersihkannya kalau masih nyangkut di peramban.
 */
export function legacyKasirStorageKey(): string {
  return kasirStorageKey();
}

/** Opsi auth untuk seat tertentu; seat owner memakai default ssr. */
export function seatAuthOptions(
  seat: Seat,
  outletSlug?: string | null
): { auth: { storageKey: string } } | undefined {
  return seat === "kasir"
    ? { auth: { storageKey: kasirStorageKey(outletSlug) } }
    : undefined;
}
