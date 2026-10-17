"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { QrCode, ShoppingBag, Loader2 } from "lucide-react";
import { useCart } from "@/lib/cart/cart-context";
import { createOrder, type CheckoutInput } from "@/app/checkout/actions";
import { ConfirmOrderDialog } from "@/components/customer/confirm-order-dialog";
import { menuHref } from "@/lib/menu-href";

type PaymentMethod = "qris" | "cash";

export function CheckoutForm() {
  const { items, totalPrice, clearCart, addItem, session, setManualSession, setCustomerName } =
    useCart();

  // Nama pemesan diisi di keranjang (kolom "Pesanan Atas Nama") lalu ikut ke sini
  const customerName = session.customerName;

  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Modal konfirmasi sebelum pesanan benar-benar dikirim ke kasir.
  const [confirmOpen, setConfirmOpen] = useState(false);

  /*
   * Halaman ini berbeda dari halaman pesanan: nomor meja HANYA ikut
   * kalau berasal dari scan QR.
   *
   * Alasannya `?table=` bukan sekadar penanda tampilan. TableSessionSync
   * membaca parameter itu dan memanggil applyScannedTable(), yang
   * mengosongkan keranjang kalau mejaknya berbeda dari sesi aktif.
   *
   * Kalau pelanggan memilih meja 02 secara manual lalu menekan "Batal",
   * menempelkan `?table=02` akan menghapus isi keranjangnya -- persis
   * kebalikan dari yang diinginkan.
   *
   * Di halaman pesanan dan pembayaran, keranjang sudah kosong karena
   * pesanan sudah dibuat, jadi aman memakai nomor meja apa adanya.
   */
  const scannedTableHref = menuHref(session.isScanned ? session.tableNumber : null);

  if (items.length === 0) {
    return (
      <div className="space-y-4 rounded-lg border border-dashed p-10 text-center">
        <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Keranjang kamu masih kosong. Yuk pilih menu dulu.
        </p>
        <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href={scannedTableHref}>Lihat Menu</Link>
        </Button>
      </div>
    );
  }

  /**
   * Tombol "Buat Pesanan" DITEKAN dulu -> validasi -> buka modal konfirmasi.
   * Pesanan yang benar-benar terkirim baru setelah tombol "Ya, Buat Pesanan"
   * di modal ditekan.
   */
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError("Nama pemesan wajib diisi.");
      return;
    }
    if (session.orderType === "dine_in" && !session.tableNumber?.trim()) {
      setError("Nomor meja wajib diisi untuk dine-in.");
      return;
    }

    setConfirmOpen(true);
  }

  /** Dijalankan dari tombol "Ya, Buat Pesanan" di modal. */
  function handleConfirmed() {
    const snapshot = items;
    const payload: CheckoutInput = {
      customer_name: customerName.trim(),
      order_type: session.orderType,
      table_number:
        session.orderType === "dine_in" ? session.tableNumber!.trim() : undefined,
      notes: notes.trim() || undefined,
      payment_method: paymentMethod,
      items: items.map((i) => ({
        menu_item_id: i.id,
        quantity: i.quantity,
        // Harga kustomisasi tetap dihitung ulang di server — ini hanya pilihan customer
        selected_customizations: i.customizations.map((c) => ({
          name: c.name,
          label: c.label,
          price_delta: c.price_delta,
        })),
      })),
    };

    startTransition(async () => {
      clearCart(); // optimistic — dibalikin lagi di bawah kalau ternyata gagal
      const result = await createOrder(payload);
      if (result?.error) {
        setError(result.error);
        setConfirmOpen(false);
        snapshot.forEach((item) => addItem(item, item.quantity));
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Checkout</h1>
        <p className="text-sm text-muted-foreground">Selesaikan pesananmu di BD Coffee.</p>
      </div>

      <div className="space-y-2 rounded-lg border p-4">
        <p className="text-sm font-semibold">Ringkasan Pesanan</p>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.lineId} className="flex justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="text-muted-foreground">
                  {item.quantity}x {item.name}
                </p>
                {item.customizations.length > 0 && (
                  <p className="text-xs text-muted-foreground/80">
                    {item.customizations.map((c) => c.label).join(" · ")}
                  </p>
                )}
              </div>
              <span className="shrink-0">
                Rp {(item.price * item.quantity).toLocaleString("id-ID")}
              </span>
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t pt-2 text-sm font-semibold">
          <span>Total</span>
          <span>Rp {totalPrice.toLocaleString("id-ID")}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="customer_name">Pesanan Atas Nama</Label>
          <Input
            id="customer_name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nama yang mau dipanggil, mis. Budi"
          />
          <p className="text-xs text-muted-foreground">
            Nama ini akan kami panggil saat pesananmu siap.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Tipe Pesanan</Label>
          {session.isScanned ? (
            <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium">
              🪑 Dine In — Meja {session.tableNumber}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setManualSession({ orderType: "dine_in", tableNumber: session.tableNumber })
                  }
                  className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                    session.orderType === "dine_in"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input hover:bg-accent"
                  }`}
                >
                  Dine In
                </button>
                <button
                  type="button"
                  onClick={() => setManualSession({ orderType: "takeaway", tableNumber: null })}
                  className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                    session.orderType === "takeaway"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input hover:bg-accent"
                  }`}
                >
                  Takeaway
                </button>
              </div>
              {session.orderType === "dine_in" && (
                <Input
                  value={session.tableNumber ?? ""}
                  onChange={(e) =>
                    setManualSession({ orderType: "dine_in", tableNumber: e.target.value })
                  }
                  placeholder="Contoh: 05"
                />
              )}
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Catatan (opsional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contoh: gak pake es, sedotan terpisah, dll"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Metode Pembayaran</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod("qris")}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                paymentMethod === "qris"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input hover:bg-accent"
              }`}
            >
              QRIS
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("cash")}
              className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                paymentMethod === "cash"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input hover:bg-accent"
              }`}
            >
              Tunai di Kasir
            </button>
          </div>

          {paymentMethod === "qris" && (
            <div className="flex items-center gap-3 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              <QrCode className="h-8 w-8 shrink-0" />
              <span>
                QR Code pembayaran masih placeholder — generator otomatis menyusul. Untuk
                sekarang, konfirmasi bayar QRIS langsung ke kasir setelah pesan dibuat.
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:flex-1"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Buat Pesanan — Rp {totalPrice.toLocaleString("id-ID")}
          </Button>

          <Button asChild variant="outline" className="w-full sm:flex-1">
            <Link href={scannedTableHref}>Batal</Link>
          </Button>
        </div>
      </form>

      <ConfirmOrderDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleConfirmed}
        items={items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          customizations: item.customizations.map((c) => c.label),
        }))}
        totalPrice={totalPrice}
        customerName={customerName.trim() || "—"}
        orderType={session.orderType}
        tableNumber={session.tableNumber}
        paymentMethod={paymentMethod}
        notes={notes.trim()}
        isPending={isPending}
      />
    </div>
  );
}
