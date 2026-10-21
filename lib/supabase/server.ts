import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import type { Database } from "@/types/database.types";
import type { Seat } from "@/lib/supabase/seats";
import { seatAuthOptions } from "@/lib/supabase/seats";

/**
 * Dipakai di Server Component, Server Action, dan Route Handler.
 * Wajib dipanggil ulang di setiap request (bukan singleton) karena
 * bergantung pada cookies() request yang sedang berjalan.
 *
 * `seat` memilih cookie mana yang dipakai (lihat lib/supabase/seats.ts):
 *   "owner" (default) -> dashboard owner, login owner, halaman publik
 *   "kasir"           -> dashboard kasir, login kasir, /daftar
 *
 * Dua seat = dua cookie = dua sesi berjalan di satu peramban. Halaman
 * kasir yang dikunjungi wajib pakai seat kasir, kalau tidak data-nya akan
 * terbaca dari sesi owner (atau kosong) dan board kasir kacau.
 */
export async function createClient(seat: Seat = "owner") {
  const cookieStore = await cookies();

  /*
   * Seat kasir kini PER OUTLET: outlet dibaca dari header internal
   * `x-bd-outlet` yang disuntik middleware untuk semua jalur ber-outlet.
   * Header kosong (jalur tanpa outlet) -> nama key global pola lama.
   */
  let outletSlug: string | null = null;
  if (seat === "kasir") {
    try {
      outletSlug = (await headers()).get("x-bd-outlet");
    } catch {
      // Di luar konteks request (mis. saat build) — pakai key global.
      outletSlug = null;
    }
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as CookieOptions)
            );
          } catch {
            // Bisa diabaikan jika dipanggil dari Server Component (read-only).
            // Middleware yang akan meng-handle refresh session di kasus ini.
          }
        },
      },
      ...seatAuthOptions(seat, outletSlug),
    }
  );
}

/**
 * True kalau request ini datang dari sesi staff yang sedang login, di seat
 * mana pun (owner atau kasir).
 *
 * ⚠️ INI BUKAN GERBANG KEAMANAN. Fungsinya hanya memilih tombol mana yang
 * ditampilkan, misalnya "Cetak Struk" atau "Batal Pembayaran" di halaman
 * pesanan. Yang menentukan boleh-tidaknya adalah RLS dan RPC, bukan ini --
 * meski UI-nya dimanipulasi, aksi tetap ditolak di server.
 *
 * Pakai `getSession()` yang membaca cookie, bukan `getUser()` yang memvalidasi
 * JWT ke server auth. Untuk keputusan tampilan itu cukup, dan tidak menambah
 * satu round-trip ke setiap halaman pesanan.
 *
 * Kedua seat dicek karena flow ini dipakai dua jenis pengunjung: kasir yang
 * memesan dari dashboard (sesinya di seat kasir) dan owner yang mencoba
 * alur pelanggan dari dashboard owner (sesinya di seat owner).
 */
export async function hasStaffSession(): Promise<boolean> {
  const owner = await createClient("owner");
  const { data: ownerSession } = await owner.auth.getSession();
  if (ownerSession.session !== null) return true;

  const kasir = await createClient("kasir");
  const { data: kasirSession } = await kasir.auth.getSession();
  return kasirSession.session !== null;
}

/**
 * Client untuk aksi yang berlaku "di luar dashboard": membuat pesanan dari
 * halaman/checkout pelanggan. Seat-nya dinilai dari sesi yang AKTIF:
 *
 *   - Sesi owner ada -> seat owner (owner mencoba alur pelanggan dari
 *     dashboard, jadi insert/RPC berjalan dengan JWT owner-nya, sama seperti
 *     perilaku sebelum seat dipisah).
 *   - Sesi kasir ada -> seat kasir (kasir memesan lewat tab "Pesan Menu").
 *   - Tidak ada sesi -> seat kasir, yang diambil sebagai ANON; policy RLS
 *     insert untuk orders/order_items memang terbuka (`with check (true)`),
 *     jadi pelanggan biasa tetap bisa memesan.
 *
 * Fungsi ini TIDAK pernah dipakai untuk aksi yang butuh role tertentu —
 * yang semacam itu selalu lewat RPC SECURITY DEFINER yang mengecek
 * is_staff() dari JWT sesi yang dipakai.
 */
export async function createActiveStaffClient() {
  const owner = await createClient("owner");
  const { data: ownerSession } = await owner.auth.getSession();
  if (ownerSession.session !== null) return owner;

  return await createClient("kasir");
}
