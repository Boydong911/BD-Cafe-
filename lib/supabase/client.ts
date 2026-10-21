import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import type { Seat } from "@/lib/supabase/seats";
import { seatAuthOptions } from "@/lib/supabase/seats";

/**
 * Dipakai di Client Component ('use client'), misalnya untuk
 * subscribe Realtime status pesanan.
 *
 * Seat harus senada dengan halamannya (dashboard kasir -> "kasir", dst),
 * kalau tidak JWT yang dipakai realtime/permintaan bukan milik sesi yang
 * benar. Bila sesi tidak disentuh sama sekali (halaman pelanggan), bisa
 * memakai default "owner".
 *
 * isSingleton FALSE wajib: tanpa itu semua pemanggilan mendapatkan instance
 * pertama yang pernah dibuat, tidak peduli seatnya apa — storageKey session
 * kedua tidak pernah kepakai. Tidak ada caching client antar seat; tiap
 * pemanggilan membuat instance baru (pemanggilannya sedikit, satu per efek).
 */
export function createClient(seat: Seat = "owner", outletSlug?: string | null) {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      isSingleton: false,
      ...seatAuthOptions(seat, outletSlug),
    }
  );
}
