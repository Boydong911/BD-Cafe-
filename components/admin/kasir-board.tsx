"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { OrderCard } from "@/components/admin/order-card";
import { ReceiptPrint } from "@/components/admin/receipt-print";
import { MenuCatalog } from "@/components/customer/menu-catalog";
import { CartItemList, formatPrice } from "@/components/customer/cart-items";
import { CartSheet } from "@/components/customer/cart-sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/cart-context";
import type { CategoryFilterGroup } from "@/components/category-filter";
import type { MenuCardItem } from "@/components/customer/menu-card";
import type { KasirOrder, OrderStatus } from "@/types/order";

/** Tab utama kasir. Default-nya papan antrean, karena itu yang dipakai tiap hari. */
const TABS = [
  { key: "pesan", label: "Pesan Menu" },
  { key: "alur", label: "Alur Pesanan" },
] as const;

const ACTIVE: OrderStatus[] = ["pending", "confirmed", "preparing", "ready"];

const FILTERS: {
  key: string;
  label: string;
  match: (s: OrderStatus) => boolean;
}[] = [
  { key: "aktif", label: "Aktif", match: (s) => ACTIVE.includes(s) },
  { key: "pending", label: "Baru", match: (s) => s === "pending" },
  {
    key: "proses",
    label: "Diproses",
    match: (s) => s === "confirmed" || s === "preparing",
  },
  { key: "ready", label: "Siap", match: (s) => s === "ready" },
  { key: "completed", label: "Selesai", match: (s) => s === "completed" },
  { key: "cancelled", label: "Batal", match: (s) => s === "cancelled" },
];

/**
 * Seberapa sering data ditarik ulang sebagai jaring pengaman.
 *
 * Kasir menunggu pelanggan di depan meja, bukan sedang menghadap layar,
 * jadi pesanan baru harus terlihat dalam hitungan detik -- bukan lima
 * detik, karena itu terasa lama.
 *
 * Dipakai HANYA kalau Realtime sedang tidak terhubung. Kalau Realtime
 * hidup, pesanan baru sudah sampai lewat `router.refresh()` di channel,
 * jadi polling cepat hanya mengulang pekerjaan yang sama.
 */
const POLL_MS = 3000;

/**
 * Jeda polling saat Realtime terhubung.
 *
 * Fungsinya tetap jaring pengaman, jadi harus tetap ada -- hanya tidak
 * perlu sedekat itu. 30 detik cukup untuk kasus "Realtime diam-diam
 * putus tanpa memberi status", tanpa menarik ulang seluruh daftar
 * 20 kali per menit.
 *
 * Menghemat sekitar 90% permintaan refresh di kondisi normal.
 */
const POLL_MS_REALTIME_OK = 30000;

/** Berapa lama pesanan baru ditandai setelah muncul. */
const NEW_HIGHLIGHT_MS = 20000;

export function KasirBoard({
  orders,
  menuItems,
  categoryGroups,
}: {
  orders: KasirOrder[];
  /** Katalog untuk tab "Pesan Menu". Diambil server, bukan fetch dari browser. */
  menuItems: MenuCardItem[];
  categoryGroups: CategoryFilterGroup[];
}) {
  const router = useRouter();
  const { totalItems, totalPrice } = useCart();
  const [tabKey, setTabKey] = useState<"pesan" | "alur">("alur");
  const [filterKey, setFilterKey] = useState("aktif");
  // Pesanan yang struknya sedang dicetak.
  const [printing, setPrinting] = useState<KasirOrder | null>(null);
  // Status koneksi Realtime, ditampilkan sebagai titik kecil di header.
  const [realtimeStatus, setRealtimeStatus] = useState<string>("connecting");
  // Id pesanan yang baru saja muncul, supaya kasir bisa langsung tahu
  // mana yang baru tanpa harus membandingkan daftar sendiri.
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const knownIds = useRef<Set<string> | null>(null);
  // Status langganan Realtime untuk interval polling. Ref, bukan state,
  // supaya tidak memicu render ulang.
  const realtimeLive = useRef(false);

  /*
   * Dua lapis pembaruan, karena kasir TIDAK BOLEH menunggu refresh manual:
   *
   * 1) Realtime (postgres_changes) — cepat, dorongan dari server.
   *    Ini bisa gagal diam-diam kalau WebSocket terputus, RLS menolak
   *    langganan, atau Supabase sedang tidak bisa dihubungi.
   *
   * 2) Polling tiap POLL_MS — lambat (maksimal POLL_MS detik), tapi selalu
   *    jalan selama tab terbuka. Ini jaring pengaman, bukan pengganti.
   *
   * Tanpa polling, kasir bisa saja menunggu lama hanya karena satu koneksi
   * websocket putus -- dan pesanan yang tidak terlihat berarti pelanggan
   * menunggu di kasir tanpa kabar.
   */
  useEffect(() => {
    const supabase = createClient();
    let debounce: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => {
      clearTimeout(debounce);
      // Debounce 300ms: satu pembuatan pesanan memicu INSERT di `orders`
      // sekaligus beberapa INSERT di `order_items`. Tanpa debounce, satu
      // pesanan memicu beberapa refresh sia-sia.
      debounce = setTimeout(() => router.refresh(), 300);
    };

    const channel = supabase
      .channel("kasir-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_items" },
        refresh
      )
      .subscribe((status) => {
        setRealtimeStatus(status);
        realtimeLive.current = status === "SUBSCRIBED";
      });

    /*
     * Polling selalu jalan, tapi jeda-nya menyesuaikan kondisi:
     *   Realtime hidup  -> 30 detik (cukup sebagai jaring pengaman)
     *   Realtime mati   -> 3 detik (ini satu-satunya cara pesanan sampai)
     *
     * `realtimeLive` dibaca di dalam callback, bukan di dalam effect, supaya
     * interval tidak perlu dibuat ulang tiap kali status berubah.
     */
    const poller = setInterval(() => {
      if (document.hidden) return; // hemat request saat tab di belakang
      router.refresh();
    }, POLL_MS);

    const slowPoller = setInterval(() => {
      if (document.hidden || !realtimeLive.current) return;
      router.refresh();
    }, POLL_MS_REALTIME_OK);

    return () => {
      clearTimeout(debounce);
      clearInterval(poller);
      clearInterval(slowPoller);
      supabase.removeChannel(channel);
    };
  }, [router]);

  /*
   * Deteksi pesanan baru.
   *
   * `knownIds` diisi NULL di render pertama supaya pesanan yang sudah ada saat
   * halaman dibuka tidak sekaligus ditandai sebagai "baru" — hanya yang
   * benar-benar muncul SESUDAH halaman terbuka yang dihitung baru.
   */
  useEffect(() => {
    const incoming = new Set(orders.map((o) => o.id));

    if (knownIds.current === null) {
      knownIds.current = incoming;
      return;
    }

    const fresh = [...incoming].filter((id) => !knownIds.current!.has(id));

    if (fresh.length === 0) {
      // Tidak ada yang baru; cukup selaraskan id yang tersimpan.
      if (
        knownIds.current.size !== incoming.size ||
        [...knownIds.current].some((id) => !incoming.has(id))
      ) {
        knownIds.current = incoming;
      }
      return;
    }

    knownIds.current = incoming;
    setFreshIds(new Set(fresh));

    const timer = setTimeout(() => setFreshIds(new Set()), NEW_HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [orders]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const f of FILTERS) {
      result[f.key] = orders.filter((o) => f.match(o.status)).length;
    }
    return result;
  }, [orders]);

  const visible = useMemo(() => {
    const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
    const list = orders.filter((o) => filter.match(o.status));
    const newestFirst = filterKey === "completed" || filterKey === "cancelled";
    return [...list].sort((a, b) => {
      const diff =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return newestFirst ? -diff : diff; // antrean aktif: yang terlama di atas
    });
  }, [orders, filterKey]);

  return (
    <div className="space-y-5">
      {/*
        Dua tab utama kasir.

        "Pesan Menu" menampilkan katalog yang sama dengan /menu, supaya kasir
        bisa melihat dan memilih menu tanpa pindah halaman. Katalog, kartu,
        dan filter-nya semua dipakai ulang dari komponen customer -- tidak
        ada salinan untuk versi kasir.

        Data katalog dikirim dari server (lihat app/admin/kasir/page.tsx)
        supaya tidak perlu fetch kedua kali dari browser.
      */}
      <div className="flex gap-2">
        {TABS.map((tab) => {
          const active = tab.key === tabKey;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setTabKey(tab.key)}
              aria-pressed={active}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabKey === "pesan" ? (
        /*
         * 75 : 25 di layar lebar. Di bawah lg tidak ada kolom kanan --
         * keranjang jadi tombol mengambang yang membuka sheet, sama seperti
         * di /menu?table=02.
         */
        <>
        <div className="grid gap-4 lg:grid-cols-[3fr_1fr]">
          <MenuCatalog
            items={menuItems}
            groups={categoryGroups}
            tableParam={null}
            orderable
          />

          {/*
            Panel kanan menempel di layar (lg ke atas) supaya tombol
            "Lanjut ke Checkout" selalu terjangkau tanpa menggulir balik ke
            atas. Yang bergulir hanya daftar isinya.

            `top-20` karena header kasir di app/admin/kasir/layout.tsx juga
            sticky di atas dan setinggi sekitar 68px. Kalau top-nya lebih
            kecil, panel ini akan ketutup header.

            `hidden` di bawah lg karena di sana panel ini akan jadi kotak
            gelap besar tepat di bawah katalog -- cuma memakan layar. Yang
            dipakai kasir di HP adalah CartSheet di bawah.
          */}
          <aside className="hidden flex-col rounded-xl bg-primary p-4 text-primary-foreground lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:flex lg:self-start lg:overflow-hidden">
            <h2 className="font-serif text-lg">Keranjang</h2>
            <p className="mb-3 text-xs text-primary-foreground/60">
              {totalItems > 0 ? `${totalItems} item dipilih` : "Belum ada item"}
            </p>

            <CartItemList className="min-h-0 flex-1 space-y-3 overflow-y-auto" />

            <div className="mt-4 shrink-0 space-y-3 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Total</span>
                <span>{formatPrice(totalPrice)}</span>
              </div>
              <Button
                asChild
                size="lg"
                disabled={totalItems === 0}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Link href="/checkout">Lanjut ke Checkout</Link>
              </Button>
            </div>
          </aside>
        </div>

        {/*
          Keranjang untuk HP: komponen CartSheet yang PERSIS sama dengan
          yang dipakai /menu?table=02 -- tombol mengambang di kanan bawah
          yang membuka panel geser. Jadi isi, tombol jumlah, kolom nama,
          dan tombol checkout-nya identik dengan sisi pelanggan.

          Dibungkus `lg:hidden` karena di layar lebar keranjang sudah tampil
          sebagai panel kanan yang menempel.
        */}
        <div className="lg:hidden">
          <CartSheet />
        </div>
        </>
      ) : (
        <>
      {/*
        Indikator koneksi realtime. Kalau titik ini merah, berarti push dari
        server tidak jalan dan halaman hanya andalkan polling. Berguna sebagai
        petunjuk kalau nanti ada complaint "pesanan telat muncul" -- kita tahu
        langsung itu soal koneksi, bukan soal query.
      */}
      <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            realtimeStatus === "SUBSCRIBED"
              ? "bg-emerald-500"
              : realtimeStatus === "CHANNEL_ERROR" ||
                  realtimeStatus === "TIMED_OUT"
                ? "bg-destructive"
                : "bg-amber-500"
          }`}
          aria-hidden
        />
        <span>
          {realtimeStatus === "SUBSCRIBED"
            ? "Live"
            : realtimeStatus === "CHANNEL_ERROR" || realtimeStatus === "TIMED_OUT"
              ? `Koneksi terputus — menyegarkan tiap ${POLL_MS / 1000} detik`
              : "Menghubungkan…"}
        </span>
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-2">
          {FILTERS.map((f) => {
            const active = f.key === filterKey;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilterKey(f.key)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-foreground hover:bg-muted"
                }`}
              >
                {f.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    active ? "bg-primary-foreground/20" : "bg-muted"
                  }`}
                >
                  {counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-background py-16 text-center text-sm text-muted-foreground">
          Tidak ada pesanan di kategori ini.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onConfirmPayment={setPrinting}
              isFresh={freshIds.has(order.id)}
            />
          ))}
        </div>
      )}
        </>
      )}

      {/*
        Struk otomatis tercetak begitu kasir menekan "Konfirmasi Bayar".
        Elemennya tersembunyi di layar dan baru terlihat saat window.print()
        dipanggil (lihat aturan @media print di app/globals.css).

        Sengaja DI LUAR percabangan tab: kalau struk sedang dicetak lalu kasir
        pindah tab, struknya harus tetap tampil.
      */}
      <ReceiptPrint order={printing} onPrinted={() => setPrinting(null)} />
    </div>
  );
}
