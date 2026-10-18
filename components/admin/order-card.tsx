"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  completeOrder,
  updateOrderStatus,
} from "@/app/admin/kasir/actions";
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
 *   pending / confirmed / preparing / ready  ->  [Selesaikan]  ->  completed
 *
 * Dulu ada dua tombol: "Konfirmasi Bayar" lebih dulu, baru "Selesaikan".
 * Owner meminta langkah pertama dihapus untuk TUNAI maupun QRIS, jadi
 * kasir menekan sekali saja.
 *
 * Tombol "Terima Pesanan" dan "Mulai Dibuat" juga sudah dihapus dulu
 * sebelumnya, jadi tidak ada lagi tabel transisi NEXT_STEP di sini.
 *
 * Yang tetap tidak boleh dihapus: "Batalkan" untuk status yang masih bisa
 * dibatalkan, karena itu satu-satunya jalan keluar kalau pesanan salah input.
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
  isFresh = false,
}: {
  order: KasirOrder;
  /** Dipanggil setelah bayar lunas, supaya kasir-board bisa mencetak struk. */
  onConfirmPayment?: (order: KasirOrder) => void;
  /** Pesanan baru saja masuk — diberi sorotan supaya kasir tidak melewatinya. */
  isFresh?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isPaid = order.payment_status === "paid";
  const isCancelled = order.status === "cancelled";
  const isDone = order.status === "completed";

  /*
   * Satu tombol "Selesaikan" untuk TUNAI maupun QRIS, muncul selama pesanan
   * belum selesai atau dibatalkan. Dulu ada "Konfirmasi Bayar" lebih dulu --
   * owner meminta langkah itu dihapus.
   */
  const canComplete = !isCancelled && !isDone;

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.success) setError(res.error ?? "Terjadi kesalahan.");
    });
  }

  /*
   * Selesaikan: catat pembayaran kalau perlu, lalu selesaikan pesanan.
   *
   * Struk ikut tercetak otomatis, seperti dulu saat tombolnya bernama
   * "Konfirmasi Bayar". Dipakai data pesanan yang sudah ada di memory --
   * tidak perlu fetch ulang, dan tetap benar walau `status` belum
   * ter-refresh.
   */
  function handleComplete() {
    setError(null);
    startTransition(async () => {
      const res = await completeOrder(order.id);

      // Pakai operator `in` alih-alih `!res.success`: project ini `strict: false`
      // dan tanpa strictNullChecks TypeScript tidak mengenali union ini.
      if (!("success" in res && res.success)) {
        setError(("error" in res && res.error) || "Gagal menyelesaikan pesanan.");
        return;
      }

      onConfirmPayment?.({
        ...order,
        payment_status: "paid",
        status: "completed",
      });
    });
  }

  function handleCancel() {
    run(() => updateOrderStatus(order.id, "cancelled"));
  }

  return (
    <article
      className={`relative flex flex-col rounded-xl border bg-background shadow-sm transition-shadow ${
        order.status === "pending" ? "ring-2 ring-accent" : ""
      } ${
        // Pesanan baru: sorotan accent + sedikit terangkat supaya mata kasir
        // langsung tertuju ke-antrean, bukan ke bawah daftar.
        isFresh ? "ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20" : ""
      }`}
    >
      {isFresh && (
        <span className="absolute -top-2 left-3 z-10 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
          Baru
        </span>
      )}
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
            Satu tombol untuk kedua metode.

            Dulu ada "Konfirmasi Bayar" dulu, baru "Selesaikan" setelahnya.
            Owner minta langkah pertama dihapus: kasir menekan "Selesaikan"
            sekali, dan itu sudah mencatat pembayaran (untuk tunai) sekaligus
            menyelesaikan pesanan.
          */}
          {canComplete && (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="flex-1"
              disabled={isPending}
              onClick={handleComplete}
            >
              {isPending ? "Memproses..." : "Selesaikan"}
            </Button>
          )}

          {CAN_CANCEL.includes(order.status) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={isPending}
                >
                  Batalkan
                </Button>
              </AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Batalkan pesanan {order.order_number ?? "ini"}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Pesanan <strong>{order.customer_name}</strong> akan dibatalkan
                    dan hilang dari antrean. Nomor antrean{" "}
                    {order.order_number ?? "-"} tidak dipakai lagi.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Tidak Jadi</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={handleCancel}
                  >
                    Ya, Batalkan
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </footer>
    </article>
  );
}