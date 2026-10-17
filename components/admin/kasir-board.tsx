"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { OrderCard } from "@/components/admin/order-card";
import { ReceiptPrint } from "@/components/admin/receipt-print";
import type { KasirOrder, OrderStatus } from "@/types/order";

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

export function KasirBoard({ orders }: { orders: KasirOrder[] }) {
  const router = useRouter();
  const [filterKey, setFilterKey] = useState("aktif");
  // Pesanan yang struknya sedang dicetak.
  const [printing, setPrinting] = useState<KasirOrder | null>(null);

  // Realtime: setiap ada perubahan di orders/order_items, refetch data server
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
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
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router]);

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
            />
          ))}
        </div>
      )}

      {/*
        Struk otomatis tercetak begitu kasir menekan "Konfirmasi Bayar".
        Elemennya tersembunyi di layar dan baru terlihat saat window.print()
        dipanggil (lihat aturan @media print di app/globals.css).
      */}
      <ReceiptPrint order={printing} onPrinted={() => setPrinting(null)} />
    </div>
  );
}