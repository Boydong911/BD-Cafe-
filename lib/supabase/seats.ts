// File: lib/supabase/seats.ts

/**
 * Dua "seat" sesi yang terpisah di satu peramban.
 *
 * SEBELUMNYA semua dashboard memakai cookie Supabase yang sama
 * (nama default: `sb-<project-ref>-auth-token`). Satu cookie = satu sesi,
 * jadi login owner di dashboard otomatis membuat tab halaman kasir ikut
 * login, dan logout di halaman kasir ikut melogout dashboard owner.
 *
 * SEKARANG tiap seat punya nama cookie sendiri:
 *
 *   seat owner -> `sb-<ref>-auth-token`        (nama default, tidak berubah,
 *                                              sesi owner yang lama tetap sah)
 *   seat kasir -> `sb-<ref>-auth-token-kasir`
 *
 * Jadi di satu peramban bisa hidup DUA sesi sekaligus:
 *
 *   - Login owner di dashboard TIDAK mengubah tab halaman kasir. Tab itu
 *     tetap menampilkan halaman login dan siap dipakai karyawan lain.
 *   - Logout di halaman kasir TIDAK ikut melogout dashboard owner.
 *   - Owner boleh juga login di halaman kasir (akunnya dipakai di seat
 *     kasir) tanpa menyentuh sesi dashboard miliknya.
 *
 * Pemetaan seat -> jalur (lihat middleware.ts):
 *   /admin/owner/*, /login                 -> owner
 *   /admin/kasir/*, /login/kasir, /daftar  -> kasir
 *   halaman publik/pelanggan               -> owner (default, cekek read-only)
 */
export type Seat = "owner" | "kasir";

/**
 * Nama storage cookie untuk seat kasir.
 *
 * '@supabase/ssr' menamai cookie sesinya `sb-<project-ref>-auth-token`,
 * `project-ref` = label pertama dari hostname Supabase URL. Seat kasir
 * memakai nama yang sama diakhiri `-kasir`, supaya tidak mungkin bentrok.
 */
export function kasirStorageKey(): string {
  const ref =
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").hostname.split(".")[0];
  return `sb-${ref}-auth-token-kasir`;
}

/** Opsi auth untuk seat tertentu; seat owner memakai default ssr. */
export function seatAuthOptions(
  seat: Seat
): { auth: { storageKey: string } } | undefined {
  return seat === "kasir" ? { auth: { storageKey: kasirStorageKey() } } : undefined;
}
