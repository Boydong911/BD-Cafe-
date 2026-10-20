// File: lib/outlets.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Satu baris di tabel `outlets`. Slug dibuat sekali lalu dibekukan
 * (tercetak di QR), nama & tanggal bangun boleh diedit.
 */
export type OutletRow = {
  id: string;
  slug: string;
  nama: string;
  tanggal_bangun: string | null; // format YYYY-MM-DD
  menu_mode: "salinan" | "sendiri";
  is_pusat: boolean;
  is_active: boolean;
  created_at: string;
};

const SLUG_LETTERS = "bcdefghijklmnopqrstuvwxyz";

/** Baca semua outlet (pusat paling dulu, lalu urut dibuat). */
export async function fetchOutlets(): Promise<OutletRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("outlets")
    .select("*")
    .order("is_pusat", { ascending: false })
    .order("created_at", { ascending: true });

  return (data ?? []) as unknown as OutletRow[];
}

/**
 * Tentukan outlet yang sedang dilihat dari query param `?outlet=<slug>`.
 * Param kosong / slug tak dikenal -> jatuh ke outlet pusat, jadi URL lama
 * tanpa tanda outlet tetap bermakna.
 *
 * `null` berarti tabel outlets belum ada isinya (migrasi belum dijalankan).
 */
export function pickOutlet(
  outlets: OutletRow[],
  slugParam?: string | null
): OutletRow | null {
  const requested = slugParam ? slugParam.toLowerCase() : null;

  if (requested) {
    const match = outlets.find((o) => o.slug === requested);
    if (match) return match;
  }

  return (
    outlets.find((o) => o.is_pusat) ??
    outlets.find((o) => o.is_active) ??
    outlets[0] ??
    null
  );
}

/**
 * Slug outlet berikutnya: `outlet-b`, `outlet-c`, ... (`outlet-a` milik
 * pusat). Kalau semua huruf terpakai, lanjut angka: `outlet-1`, dst.
 *
 * Slug ini DIBEKUKAN: setelah outlet jalan, tidak ada jalur menggantinya
 * karena QR meja tanam slug ini di dalam URL-nya.
 */
export async function generateOutletSlug(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("outlets").select("slug");
  const used = new Set((data ?? []).map((r) => r.slug));

  for (const letter of SLUG_LETTERS) {
    const candidate = `outlet-${letter}`;
    if (!used.has(candidate)) return candidate;
  }

  let n = 1;
  while (used.has(`outlet-${n}`)) n += 1;
  return `outlet-${n}`;
}

/**
 * Lingkup laporan untuk halaman Penjualan, dari query param `?outlet=`.
 * Nilai `semua` (atau param kosong) = tidak difilter outlet apa pun.
 * Slug tak dikenal ikut dianggap "semua" — halaman tidak pernah 404 gara-gara
 * salah link outlet.
 */
export function resolveOutletScope(
  outlets: OutletRow[],
  slugParam?: string | string[] | null
): { outlet_id: string | null; slug: string; nama: string } {
  const raw = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  const slug = raw ? raw.toLowerCase() : "semua";

  if (slug !== "semua") {
    const match = outlets.find((o) => o.slug === slug);
    if (match) {
      return { outlet_id: match.id, slug: match.slug, nama: match.nama };
    }
  }

  return { outlet_id: null, slug: "semua", nama: "Semua Outlet" };
}
