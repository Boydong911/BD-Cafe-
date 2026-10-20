import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KasirBoard } from "@/components/admin/kasir-board";
import { addDays } from "@/lib/format";
import { fetchMenuCatalog } from "@/lib/categories";
import { fetchOutletBySlug } from "@/lib/outlets";
import type { KasirOrder, OrderStatus } from "@/types/order";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kasir",
};

/*
 * Board kasir ber-outlet: /outlet-a/admin/kasir, /outlet-b/admin/kasir, dst.
 *
 * URL menentukan outlet mana yang dikelola, dan URL itu divalidasi lagi ke
 * tabel outlets (slug tak dikenal -> 404). Dinding "penugasan" ditagih di
 * bawah: kasir yang dibukakan outlet lain hanya bisa MELIHAT board
 * outletnya sendiri.
 */
export default async function OutletKasirPage({
  params,
}: {
  params: Promise<{ outlet: string }>;
}) {
  const { outlet: slug } = await params;
  const outlet = await fetchOutletBySlug((slug ?? "").toLowerCase());
  if (!outlet) notFound();

  /*
   * Seat kasir, bukan seat owner.
   *
   * Halaman ini membaca sesi seat "kasir" (cookie terpisah dari dashboard
   * owner). Kalau memakai cookie default, sesi yang terbaca milik dashboard
   * owner (atau tidak ada) dan data board jadi salah.
   */
  const supabase = await createClient("kasir");

  const now = new Date();

  /*
   * Siapa yang sedang di depan layar, dan apakah dia ditugaskan di outlet ini.
   *
   * Hanya satu baris profil milik orang yang sedang login. RLS
   * "profiles_select_self_or_owner" sudah mengizinkan itu untuk staf
   * (`id = auth.uid()`), jadi tidak perlu loosening policy apa pun.
   *
   * Sengaja tidak dibikin wajib: kalau gagal diambil, board tetap harus
   * jalan. Kasir yang sedang login tidak boleh kehilangan board hanya
   * karena nama gagal dimuat.
   */
  const staff = await fetchCurrentStaff(supabase);

  /*
   * DINDING PENUGASAN.
   *
   * Kasir outlet B yang membuka URL board A sebenarnya tidak akan melihat
   * data pesanan A -- RLS di tabel orders sudah menahan. Tapi board "kosong
   * semua" itu membingungkan; lebih jelas tampilkan papan
   * "kamu ditugaskan di outlet lain" dengan pintu ke board yang benar.
   */
  if (staff?.isRoleKasir && staff.assignedOutletSlug && staff.assignedOutletSlug !== outlet.slug) {
    const assigned = await fetchOutletBySlug(staff.assignedOutletSlug);
    return (
      <div className="mx-auto max-w-md py-10">
        <div className="rounded-xl border border-amber-600/30 bg-amber-600/10 p-6 text-center">
          <h1 className="font-serif text-xl font-bold">Board ini untuk {outlet.nama}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Akun <span className="font-medium text-foreground">{staff.nama ?? "kamu"}</span> ditugaskan
            sebagai kasir di{" "}
            <span className="font-medium text-foreground">{assigned?.nama ?? staff.assignedOutletSlug}</span>.
            Bolehkan kami pandu ke pintu yang benar:
          </p>
          <Link
            href={`/${staff.assignedOutletSlug}/admin/kasir`}
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Buka board outlet saya
          </Link>
        </div>
      </div>
    );
  }

  const { items: menuItems, groups: categoryGroups } = await fetchMenuCatalog(
    outlet.id
  );

  // Garis waktu untuk order SELESAI/BATAL: 24 jam ke belakang, bukan cuma
  // hari kalender. Jadi order yang dibuat kemarin sore lalu diselesaikan
  // pagi ini tetap terlihat di kasir -- inilah yang bikin kategori "Selesai"
  // terlihat kosong padahal barusan ada yang diselesaikan.
  const recentFinishedFrom = addDays(now, -1).toISOString();

  const ACTIVE_STATUSES: OrderStatus[] = ["pending", "confirmed", "preparing", "ready"];

  /*
   * Filter outlet secara EKSPLISIT, bukan mengandalkan RLS saja.
   *
   * Untuk seat kasir, RLS memang sudah membatasi ke outletnya sendiri --
   * tapi seat OWNER bisa membuka URL ini juga (owner sering memeriksa
   * tampilan kasir), dan dulu owner melihat pesanan SEMUA outlet. Di sini
   * URL sudah menyebut nama outlet: "board outlet X" menampilkan hanya
   * outlet X, siapa pun yang membukanya.
   */
  const [active, recentlyFinished] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, order_type, table_number, payment_method, payment_status, status, notes, total, created_at, order_items(id, quantity, menu_name, subtotal, selected_customizations)"
      )
      .eq("outlet_id", outlet.id)
      .in("status", ACTIVE_STATUSES)
      .or("payment_status.eq.paid,payment_method.eq.cash")
      .order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, order_type, table_number, payment_method, payment_status, status, notes, total, created_at, order_items(id, quantity, menu_name, subtotal, selected_customizations)"
      )
      .eq("outlet_id", outlet.id)
      .in("status", ["completed", "cancelled"])
      .gte("created_at", recentFinishedFrom)
      .order("created_at", { ascending: false }),
  ]);

  const error = active.error ?? recentlyFinished.error;

  // Pesanan yang selesai dalam 24 jam terakhir tetap ditampilkan di kasir;
  // yang lebih lama sudah tidak relevan untuk kasir dan hanya ada di
  // dashboard owner.
  const byId = new Map<string, KasirOrder>();

  for (const row of (active.data ?? []) as unknown as KasirOrder[]) {
    byId.set(row.id, row);
  }
  for (const row of (recentlyFinished.data ?? []) as unknown as KasirOrder[]) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }

  // Urutkan: yang aktif lebih dulu (paling lama di atas), selesai/batal di
  // akhir supaya kasir tidak perlu menggulir untuk mencari antrean baru.
  const orders = [...byId.values()].sort((a, b) => {
    const aActive = ACTIVE_STATUSES.includes(a.status) ? 0 : 1;
    const bActive = ACTIVE_STATUSES.includes(b.status) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  if (error) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Gagal memuat pesanan. Coba muat ulang halaman.
      </p>
    );
  }

  return (
    <KasirBoard
      orders={orders}
      menuItems={menuItems}
      categoryGroups={categoryGroups}
      kasirName={staff?.nama ?? null}
      outletSlug={outlet.slug}
    />
  );
}

type StaffInfo = {
  /** Nama tampilan di board. */
  nama: string | null;
  /** Slug outlet tempat kasir ditugaskan. null = bukan kasir (owner) / gagal. */
  assignedOutletSlug: string | null;
  /** True kalau yang login role-nya kasir. */
  isRoleKasir: boolean;
};

/**
 * Baca profil pelanggan staf yang sedang login (nama + outlet penugasan).
 *
 * Gagal membaca profil TIDAK membuat halaman error: papan antrean harus
 * tetap bisa dipakai. Yang hilang cuma nama dan dinding penugasan -- dan
 * untuk data, RLS di tabel orders tetap menjadi pagar terakhir.
 */
async function fetchCurrentStaff(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<StaffInfo | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data } = await supabase
      .from("profiles")
      .select("full_name, username, role, outlet_id")
      .eq("id", user.id)
      .maybeSingle();

    const name = data?.full_name?.trim();
    const nama = name ? name : (data?.username?.trim() ?? null);

    let assignedOutletSlug: string | null = null;
    if (data?.role === "kasir" && data.outlet_id) {
      const anon = await createClient();
      const { data: assigned } = await anon
        .from("outlets")
        .select("slug")
        .eq("id", data.outlet_id)
        .maybeSingle();
      assignedOutletSlug = assigned?.slug ?? null;
    }

    return {
      nama,
      assignedOutletSlug,
      isRoleKasir: data?.role === "kasir",
    };
  } catch {
    return null;
  }
}
