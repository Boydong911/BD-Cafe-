"use client";

import { useEffect } from "react";
import type { KasirOrder } from "@/types/order";

/**
 * Struk yang dicetak kasir.
 *
 * Elemennya selalu ada di DOM tapi disembunyikan (`display: none` lewat
 * `.print-area`), lalu saat `window.print()` dipanggil seluruh halaman lain
 * disembunyikan dan struk ini yang tampil. Alasan memakai teknik ini
 * daripada `window.open()`: popup sering diblokir browser, dan struk hilang
 * begitu kasir menutup tab.
 */
export function ReceiptPrint({
  order,
  onPrinted,
}: {
  order: KasirOrder | null;
  onPrinted: () => void;
}) {
  // Panggil pencetakan setelah struk sempat dirender satu frame, supaya
  // isinya tidak tercetak kosong.
  useEffect(() => {
    if (!order) return;

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        window.print();
        onPrinted();
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [order, onPrinted]);

  if (!order) return null;

  const items = order.order_items ?? [];
  const dineIn = order.order_type === "dine_in";

  const waktu = new Date(order.created_at).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });

  return (
    <div className="print-area font-mono text-[11px] leading-snug">
      <div className="text-center">
        <p className="font-serif text-base font-bold">BD COFFEE</p>
        <p>Jl. Contoh No. 1, BD Coffee</p>
        <p>{waktu}</p>
      </div>

      <div className="my-2 border-t border-dashed" />

      <div className="flex justify-between">
        <span>No. Order</span>
        <span className="font-semibold">{order.order_number ?? "-"}</span>
      </div>
      <div className="flex justify-between">
        <span>Pemesan</span>
        <span className="text-right">{order.customer_name}</span>
      </div>
      <div className="flex justify-between">
        <span>Tipe</span>
        <span>{dineIn ? `Dine In - Meja ${order.table_number ?? "-"}` : "Take Away"}</span>
      </div>
      <div className="flex justify-between">
        <span>Bayar</span>
        <span>{order.payment_method === "qris" ? "QRIS" : "Tunai"}</span>
      </div>

      <div className="my-2 border-t border-dashed" />

      <table className="w-full">
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="align-top">
              <td className="py-0.5 pr-2">
                <div>
                  {item.quantity}x {item.menu_name}
                </div>
                {formatCustomizations(item.selected_customizations) && (
                  <div className="text-[10px]">
                    {formatCustomizations(item.selected_customizations)}
                  </div>
                )}
              </td>
              <td className="whitespace-nowrap text-right align-top">
                {Number(item.subtotal).toLocaleString("id-ID")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-2 border-t border-dashed" />

      <div className="flex justify-between text-sm font-bold">
        <span>TOTAL</span>
        <span>Rp {Number(order.total).toLocaleString("id-ID")}</span>
      </div>

      <p className="mt-1 text-[10px]">
        {order.payment_status === "paid"
          ? "Status: LUNAS"
          : "Status: BELUM BAYAR"}
      </p>

      <div className="my-2 border-t border-dashed" />

      <p className="text-center text-[10px]">
        Terima kasih sudah minum kopi kami
        <br />
        @{order.customer_name.replace(/\s+/g, "").toLowerCase()}
      </p>
    </div>
  );
}

/** Ringkas pilihan kustomisasi jadi satu baris, mis. "Gula, Suhu: Ice". */
function formatCustomizations(value: unknown): string {
  if (!Array.isArray(value)) return "";

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
    .filter(Boolean)
    .join(", ");
}
