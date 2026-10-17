"use client";

import { AlertTriangle, Loader2, QrCode, Store } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ConfirmOrderItem = {
  name: string;
  quantity: number;
  price: number;
  customizations: string[];
};

/**
 * Konfirmasi sebelum pesanan benar-benar dibuat.
 *
 * Kenapa perlu: di halaman sebelumnya, menekan "Buat Pesanan" langsung
 * mengirim pesanan ke kasir. Salah sentuh berarti pelanggan punya pesanan di
 * sistem yang tidak pernah dia pesan, dan kasir mulai memproses sesuatu yang
 * tidak jelas asalnya.
 *
 * Modal ini jadi titik berhenti terakhir: pesanan baru benar-benar terkirim
 * setelah pelanggan menekan "Ya, Buat Pesanan" di sini.
 */
export function ConfirmOrderDialog({
  open,
  onOpenChange,
  onConfirm,
  items,
  totalPrice,
  customerName,
  orderType,
  tableNumber,
  paymentMethod,
  notes,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  items: ConfirmOrderItem[];
  totalPrice: number;
  customerName: string;
  orderType: "dine_in" | "takeaway";
  tableNumber: string | null;
  paymentMethod: "qris" | "cash";
  notes: string;
  isPending: boolean;
}) {
  const dineIn = orderType === "dine_in";
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Cek Dulu Pesananmu
          </DialogTitle>
          <DialogDescription>
            Pesanan akan langsung terkirim ke kasir setelah kamu konfirmasi.
            Pastikan sudah benar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <dl className="space-y-1.5 rounded-lg border bg-muted/40 p-3">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Nama Pemesan</dt>
              <dd className="text-right font-medium">{customerName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Tipe</dt>
              <dd className="text-right font-medium">
                {dineIn ? `Dine In · Meja ${tableNumber || "?"}` : "Take Away"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Pembayaran</dt>
              <dd className="flex items-center justify-end gap-1.5 text-right font-medium">
                {paymentMethod === "qris" ? (
                  <>
                    <QrCode className="h-3.5 w-3.5" /> QRIS
                  </>
                ) : (
                  <>
                    <Store className="h-3.5 w-3.5" /> Tunai di Kasir
                  </>
                )}
              </dd>
            </div>
          </dl>

          <div>
            <p className="mb-2 font-medium">
              Pesanan ({totalItems} item)
            </p>
            <ul className="space-y-2 rounded-lg border p-3">
              {items.map((item, index) => (
                <li key={index} className="space-y-0.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{item.quantity}x</span>{" "}
                      <span>{item.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      Rp {(item.price * item.quantity).toLocaleString("id-ID")}
                    </span>
                  </div>
                  {item.customizations.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {item.customizations.join(" · ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {notes && (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Catatan</p>
              <p className="mt-0.5">{notes}</p>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2.5">
            <span className="font-medium">Total</span>
            <span className="font-serif text-lg font-bold tabular-nums">
              Rp {totalPrice.toLocaleString("id-ID")}
            </span>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="sm:flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Belum, Kembali
          </Button>
          <Button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary/90 sm:flex-1"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mengirim...
              </>
            ) : (
              "Ya, Buat Pesanan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
