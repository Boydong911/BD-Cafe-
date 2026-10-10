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

const NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> =
  {
    pending: { to: "confirmed", label: "Terima Pesanan" },
    confirmed: { to: "preparing", label: "Mulai Dibuat" },
    preparing: { to: "ready", label: "Siap Disajikan" },
    ready: { to: "completed", label: "Selesaikan" },
  };

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

export function OrderCard({ order }: { order: KasirOrder }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const next = NEXT_STEP[order.status];
  const isPaid = order.payment_status === "paid";
  const needsPaymentFirst = order.status === "ready" && !isPaid;

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.success) setError(res.error ?? "Terjadi kesalahan.");
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
        {needsPaymentFirst && (
          <p className="text-xs text-amber-800">
            Konfirmasi pembayaran dulu sebelum menyelesaikan pesanan.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!isPaid && order.status !== "cancelled" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => run(() => confirmPayment(order.id))}
            >
              Konfirmasi Bayar
            </Button>
          )}

          {next && (
            <Button
              type="button"
              size="sm"
              className="flex-1"
              disabled={isPending || needsPaymentFirst}
              onClick={() => run(() => updateOrderStatus(order.id, next.to))}
            >
              {isPending ? "Memproses..." : next.label}
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