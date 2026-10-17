"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { confirmPayment, updateOrderStatus } from "@/app/admin/kasir/actions";
import type { KasirOrder, OrderStatus } from "@/types/order";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Baru",
  confirmed: "Diterima",
  preparing: "Dibuat",
  ready: "Siap",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

const STATUS_CLASS: Record<OrderStatus, string> = {
  pending: "border-amber-300 bg-amber-100 text-amber-900",
  confirmed: "border-sky-300 bg-sky-100 text-sky-900",
  preparing: "border-orange-300 bg-orange-100 text-orange-900",
  ready: "border-emerald-300 bg-emerald-100 text-emerald-900",
  completed: "border-border bg-muted text-muted-foreground",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

/*
 * Alur tombol setelah penyederhanaan (permintaan owner):
 *
 *   pending / confirmed / preparing  ->  [Konfirmasi Bayar]  ->  ready  (+ struk)
 *   ready                            ->  [Selesaikan]       ->  completed
 *
 * Tombol "Terima Pesanan" dan "Mulai Dibuat" sudah dihapus, jadi tidak ada
 * lagi tabel transisi NEXT_STEP. Jumlah tombolnya tinggal bergantung pada status:
 *   - belum ready   -> "Konfirmasi Bayar" (tunai / QRIS), lalu struk
 *   - sudah ready   -> "Selesaikan"
 *
 * PENTING soal tombol "Konfirmasi Bayar":
 *   Tombol ini sengaja TIDAK disembunyikan hanya karena sudah lunas. Untuk
 *   QRIS, customer menekan "Sudah Bayar" di halamannya sendiri, jadi pesanan
 *   sudah `paid` SEBELUM kasir menyentuhnya. Kalau tombolnya disembunyikan
 *   saat sudah lunas, kasir tidak punya cara lagi untuk mencetak struk.
 *   Yang menentukan adalah statusnya sudah `ready` atau `completed` — bukan
 *   status pembayarannya.
 */

const CAN_CANCEL: OrderStatus[] = ["pending", "confirmed", "preparing"];

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });

// Formatter defensif: struktur JSON selected_customizations bisa berbeda-beda
function formatCustomizations(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object") {
        const e = entry as Record<string, unknown>;
        const label = e.option_label ?? e.option ?? e.label ?? e.name ?? e.value;
        const group = e.group_name ?? e.group;
        if (label) return group ? `${group}: ${label}` : String(label);
      }
      return "";
    })
    .filter(Boolean);
}

export function OrderCard({
  order,
  onConfirmPayment,
}: {
  order: KasirOrder;
  /** Dipanggil setelah bayar lunas, supaya kasir-board bisa mencetak struk. */
  onConfirmPayment?: (order: KasirOrder) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isPaid = order.payment_status === "paid";
  const isCancelled = order.status === "cancelled";
  const isDone = order.status === "completed";

  // Sudah masuk status ready: tombol konfirmasi bayar tidak relevan lagi.
  const isReadyToServe = order.status === "ready";

  /*
   * Tombol konfirmasi bayar tetap muncul walau sudah lunas, karena untuk
   * QRIS pesanan sudah `paid` sebelum kasir menyentuhinya dan kasir tetap
   * perlu tombol ini untuk mencetak struk.
   */
  const canConfirmPayment =
    !isCancelled && !isDone && !isReadyToServe;

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.success) setError(res.error ?? "Terjadi kesalahan.");
    });
  }

  /**
   * Konfirmasi bayar (tunai ATAU QRIS) lalu langsung cetak struk.
   *
   * Struk dicetak otomatis sesuai permintaan owner, jadi kasir tidak perlu
   * klik tombol cetak terpisah. Status "ready" sudah ikut diuruskan di
   * server action confirmPayment().
   *
   * Metode pembayaran ikut dikirim supaya server bisa memilih jalur yang
   * benar. Server tetap membacanya ulang dari database, jadi nilai di sini
   * bukan sumber kebenaran -- hanya petunjuk.
   */
  function handleConfirmPayment() {
    setError(null);
    startTransition(async () => {
      const res = await confirmPayment(order.id, order.payment_method);

      // Pakai operator `in` alih-alih `!res.success`: project ini `strict: false`
      // dan tanpa strictNullChecks TypeScript tidak memerncetkan union ini.
      if (!("success" in res && res.success)) {
        setError(("error" in res && res.error) || "Gagal konfirmasi pembayaran.");
        return;
      }
      // Struk dicetak dengan data pesanan yang sudah ada di memory — tidak
      // perlu fetch ulang, dan tetap benar walau `status` belum ter-refresh.
      onConfirmPayment?.({
        ...order,
        payment_status: "paid",
        status: "ready",
      });
    });
  }

  function handleCancel() {
    if (!window.confirm(`Batalkan pesanan ${order.order_number}?`)) return;
    run(() => updateOrderStatus(order.id, "cancelled"));
  }

  return (
    <article
      className={`flex flex-col rounded-xl border bg-background shadow-sm ${
        order.status === "pending" ? "ring-2 ring-accent" : ""
      }`}
    >
      <header className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0">
          <p className="truncate font-sans text-sm font-bold">
            {order.order_number}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {order.customer_name} · {formatTime(order.created_at)}
          </p>
        </div>
        <Badge
          variant="outline"
          className={`shrink-0 ${STATUS_CLASS[order.status]} ${
            order.status === "pending" ? "animate-pulse" : ""
          }`}
        >
          {STATUS_LABEL[order.status]}
        </Badge>
      </header>

      <div className="flex flex-wrap gap-2 px-4 pt-3">
        <Badge variant="secondary">
          {order.order_type === "dine_in"
            ? `Dine In${order.table_number ? ` · Meja ${order.table_number}` : ""}`
            : "Takeaway"}
        </Badge>
        <Badge variant="secondary">
          {order.payment_method === "qris" ? "QRIS" : "Tunai"}
        </Badge>
        <Badge
          variant="outline"
          className={
            isPaid
              ? "border-emerald-300 bg-emerald-100 text-emerald-900"
              : "border-amber-300 bg-amber-100 text-amber-900"
          }
        >
          {isPaid ? "Lunas" : "Belum Bayar"}
        </Badge>
      </div>

      <ul className="flex-1 space-y-2 p-4">
        {order.order_items.map((item) => {
          const customs = formatCustomizations(item.selected_customizations);
          return (
            <li key={item.id} className="flex justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  {item.quantity}× {item.menu_name}
                </p>
                {customs.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {customs.join(" · ")}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-muted-foreground">
                {rupiah(item.subtotal)}
              </span>
            </li>
          );
        })}
        {order.notes && (
          <li className="rounded-md bg-muted p-2 text-xs">
            <span className="font-semibold">Catatan:</span> {order.notes}
          </li>
        )}
      </ul>

      <footer className="space-y-3 border-t p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="text-base font-bold">{rupiah(order.total)}</span>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {/*
            Tombol "Konfirmasi Bayar" muncul selama pesanan belum masuk status
            `ready` — bukan selama belum lunas.

            Untuk QRIS, customer sudah menekan "Sudah Bayar" di halamannya,
            jadi pesanan tiba di kasir dalam keadaan `paid`. Kalau tombol ini
            disembunyikan saat sudah lunas, kasir kehilangan satu-satunya cara
            untuk mencetak struk.
          */}
          {canConfirmPayment && (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="flex-1"
              disabled={isPending}
              onClick={handleConfirmPayment}
            >
              {isPending
                ? "Memproses..."
                : order.payment_method === "qris"
                  ? "Konfirmasi Bayar QRIS"
                  : "Konfirmasi Bayar"}
            </Button>
          )}

          {/* Sudah siap Disajikan: tombol terakhir. */}
          {isReadyToServe && (
            <Button
              type="button"
              size="sm"
              className="flex-1"
              disabled={isPending}
              onClick={() => run(() => updateOrderStatus(order.id, "completed"))}
            >
              {isPending ? "Memproses..." : "Selesaikan"}
            </Button>
          )}

          {CAN_CANCEL.includes(order.status) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={isPending}
              onClick={handleCancel}
            >
              Batalkan
            </Button>
          )}
        </div>
      </footer>
    </article>
  );
}