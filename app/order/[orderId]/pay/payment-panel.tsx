"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Clock, Loader2, Store } from "lucide-react";
import { confirmQrisPayment, expireOrder } from "../actions";
import { PAYMENT_WINDOW_MINUTES } from "@/lib/payment";

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

type Props =
  | { orderId: string; state: "redirect" }
  | {
      orderId: string;
      state: "waiting" | "expired";
      method: "qris" | "cash";
      total: number;
      customerName: string;
      tableNumber: string | null;
      orderType: string;
      createdAt: string;
    };

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PaymentPanel(props: Props) {
  const router = useRouter();

  // Mode "redirect": pesanan sudah dibayar/dibatalkan -> ke halaman antrean
  useEffect(() => {
    if (props.state === "redirect") router.replace(`/order/${props.orderId}`);
  }, [props.state, props.orderId, router]);

  if (props.state === "redirect") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { orderId, state, method, total, customerName, tableNumber, orderType, createdAt } = props;
  const expired = state === "expired";
  const isCash = method === "cash";

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Total yang harus dibayar
        </p>
        <p className="mt-1 font-serif text-4xl font-bold">{rupiah(total)}</p>
      </div>

      {expired ? (
        <ExpiredBox />
      ) : isCash ? (
        <CashBox orderId={orderId} />
      ) : (
        <QrisBox
          orderId={orderId}
          total={total}
          customerName={customerName}
          tableNumber={tableNumber}
          orderType={orderType}
          createdAt={createdAt}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TUNAI DI KASIR                                                      */
/* ------------------------------------------------------------------ */

function CashBox({ orderId }: { orderId: string }) {
  const router = useRouter();

  // Tunggu kasir mengonfirmasi -> otomatis masuk ke halaman antrean
  useRealtimePayment(() => router.replace(`/order/${orderId}`));

  return (
    <div className="space-y-5">
      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 text-center">
        <Store className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 font-serif text-xl font-bold">
          Silahkan Langsung Bayar Di Kasir
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Untuk Mendapatkan Antrian Pemesanan :)
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-dashed p-4 text-sm">
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">
          Menunggu kasir mengonfirmasi pembayaranmu. Nomor antrean{" "}
          <span className="font-medium text-foreground">akan muncul otomatis</span> di halaman ini
          setelah kasir selesai memverifikasi.
        </p>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => router.push(`/order/${orderId}`)}
      >
        Lihat Detail Pesanan
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* QRIS                                                                */
/* ------------------------------------------------------------------ */

function QrisBox({
  orderId,
  total,
  customerName,
  tableNumber,
  orderType,
  createdAt,
}: {
  orderId: string;
  total: number;
  customerName: string;
  tableNumber: string | null;
  orderType: string;
  createdAt: string;
}) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(() => secondsLeft(createdAt));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fired = useRef(false);

  // Timer hitung mundur 15 menit
  useEffect(() => {
    const timer = setInterval(() => setRemaining(secondsLeft(createdAt)), 1000);
    return () => clearInterval(timer);
  }, [createdAt]);

  // Saat habis -> batalkan pesanan (sekali saja)
  useEffect(() => {
    if (remaining > 0 || fired.current) return;
    fired.current = true;
    startTransition(async () => {
      await expireOrder(orderId);
      router.replace(`/order/${orderId}`);
    });
  }, [remaining, orderId, router]);

  // Sisa waktu dipakai sebagai penanda tambahan di payload QR
  const qrPayload = useMemo(
    () =>
      [
        "BDCOFFEE-DUMMY-QRIS",
        `NOMINAL=${total}`,
        `ORDER=${orderId}`,
        `NAMA=${encodeURIComponent(customerName)}`,
        `MEJA=${tableNumber ?? "-"}`,
        `TIPE=${orderType}`,
      ].join("\n"),
    [total, orderId, customerName, tableNumber, orderType]
  );

  function handlePaid() {
    setError(null);
    startTransition(async () => {
      const result = await confirmQrisPayment(orderId);
      if (result.success === false) {
        setError(result.error);
        return;
      }
      router.replace(`/order/${orderId}`);
    });
  }

  const almostOut = remaining > 0 && remaining <= 120;

  return (
    <div className="space-y-5">
      <div className="space-y-1 text-center">
        <h1 className="font-serif text-xl font-bold">Silahkan Bayar Langsung yaa... :)</h1>
        <p className="text-sm text-muted-foreground">
          Scan QR di bawah pakai aplikasi apa pun — nominal sudah disesuaikan otomatis.
        </p>
      </div>

      <div className="mx-auto w-fit rounded-2xl border bg-white p-4">
        <QRCodeSVG value={qrPayload} size={220} />
        <p className="mt-2 text-center text-[11px] font-medium text-black/50">
          QRIS DUMMY — belum terhubung ke payment gateway
        </p>
      </div>

      <div className="space-y-3 rounded-xl border p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Pesanan atas nama</span>
          <span className="font-medium">{customerName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {orderType === "dine_in" ? "Meja" : "Tipe"}
          </span>
          <span className="font-medium">
            {orderType === "dine_in" ? (tableNumber ?? "-") : "Takeaway"}
          </span>
        </div>
        <div className="flex items-center justify-between border-t pt-3 text-base font-semibold">
          <span>Total</span>
          <span>{rupiah(total)}</span>
        </div>
      </div>

      <div
        className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium ${
          almostOut ? "border-destructive/40 bg-destructive/10 text-destructive" : ""
        }`}
      >
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Sisa waktu bayar
        </span>
        <span className="font-mono text-base tabular-nums">
          {remaining > 0 ? formatCountdown(remaining) : "0:00"}
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button
        size="lg"
        className="w-full"
        disabled={isPending || remaining <= 0}
        onClick={handlePaid}
      >
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="mr-2 h-4 w-4" />
        )}
        Sudah Bayar
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Sudah transfer? Klik tombol di atas untuk langsung dapat nomor antrean.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KADU BATAS WAKTU                                                     */
/* ------------------------------------------------------------------ */

function ExpiredBox() {
  return (
    <div className="space-y-4 rounded-xl border-2 border-destructive/30 bg-destructive/5 p-6 text-center">
      <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
      <h1 className="font-serif text-xl font-bold">Waktu Pembayaran Habis</h1>
      <p className="text-sm text-muted-foreground">
        Batas waktu 15 menit untuk pembayaran sudah lewat, jadi pesanan ini otomatis dibatalkan.
      </p>
      <Button asChild variant="outline" className="w-full">
        <a href="/menu">Kembali ke Menu</a>
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */

function secondsLeft(createdAt: string) {
  const deadline =
    new Date(createdAt).getTime() + PAYMENT_WINDOW_MINUTES * 60 * 1000;
  return Math.max(0, Math.floor((deadline - Date.now()) / 1000));
}

/**
 * Subscribe perubahan `orders` sehingga halaman payment ikut ter-update
 * begitu kasir mengonfirmasi pembayaran (jalur Tunai).
 */
function useRealtimePayment(onPaid: () => void) {
  const router = useRouter();
  const cb = useRef(onPaid);
  cb.current = onPaid;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const channel = supabase
        .channel(`order-pay-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders" },
          () => {
            if (!cancelled) {
              cb.current();
              router.refresh();
            }
          }
        )
        .subscribe();

      return () => {
        cancelled = true;
        supabase.removeChannel(channel);
      };
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);
}
