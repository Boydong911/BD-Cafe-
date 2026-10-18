"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
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
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Loader2, Store, XCircle } from "lucide-react";
import { confirmQrisPayment, expireOrder } from "../actions";
import { PAYMENT_WINDOW_MINUTES } from "@/lib/payment";
import { menuHref } from "@/lib/menu-href";
import { isFromKasir } from "@/components/customer/order-source";

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

  /*
   * Penanda "pesanan ini dari board kasir", bukan "ada sesi staff".
   *
   * Di tablet counter yang dipakai bersama, pelanggan yang sedang memesan
   * punya sesi staff yang sama. Kalau penentunya sesi, dia ikut melihat
   * "Batal Pembayaran" yang mengarah ke board staff. sessionStorage hanya
   * dibaca di browser, jadi harus lewat useEffect.
   */
  const [fromKasir, setFromKasir] = useState(false);

  useEffect(() => {
    setFromKasir(isFromKasir());
  }, []);

  /*
   * Dihitung sekali di sini lalu dipakai sub-komponen, supaya tidak ada
   * tempat yang lupa menempelkan nomor meja.
   *
   * Pelanggan batal bayar -> balik ke /menu?table=XX (kalau pesanan dari meja).
   * Kasir batal bayar    -> balik ke board antrean.
   */
  const backToMenu = menuHref(tableNumber);
  const cancelHref = fromKasir ? "/admin/kasir" : backToMenu;

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Total yang harus dibayar
        </p>
        <p className="mt-1 font-serif text-4xl font-bold">{rupiah(total)}</p>
      </div>

      {expired ? (
        <ExpiredBox
          backHref={cancelHref}
          backLabel={fromKasir ? "Kembali ke Kasir" : "Kembali ke Menu"}
        />
      ) : isCash ? (
        <CashBox orderId={orderId} backToMenu={backToMenu} staff={fromKasir} />
      ) : (
        <QrisBox
          orderId={orderId}
          total={total}
          customerName={customerName}
          tableNumber={tableNumber}
          orderType={orderType}
          createdAt={createdAt}
          cancelHref={cancelHref}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TUNAI DI KASIR                                                      */
/* ------------------------------------------------------------------ */

function CashBox({
  orderId,
  backToMenu,
  staff,
}: {
  orderId: string;
  backToMenu: string;
  staff: boolean;
}) {
  const router = useRouter();

  // Tunggu kasir mengonfirmasi -> otomatis masuk ke halaman antrean
  useRealtimePayment(orderId, () => router.replace(`/order/${orderId}`));

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

      <div className="space-y-2">
        {staff ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push("/admin/kasir")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali ke Kasir
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push(`/order/${orderId}`)}
            >
              Lihat Detail Pesanan
            </Button>

            {/*
              Pelanggan sering mau lihat-lihat menu lagi sambil antre di kasir.
              Pergi ke /menu tidak membatalkan pesanan -- statusnya tetap
              "menunggu bayar" dan kasir masih melihatnya di board.

              Catatan: begitu pindah halaman, polling di useRealtimePayment ikut
              berhenti. Pelanggan yang kembali nanti harus buka lagi halaman
              status lewat link yang diberikan kasir.
            */}
            <Button asChild variant="ghost" className="w-full text-muted-foreground">
              <Link href={backToMenu}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali ke Menu
              </Link>
            </Button>
          </>
        )}
      </div>
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
  cancelHref,
}: {
  orderId: string;
  total: number;
  customerName: string;
  tableNumber: string | null;
  orderType: string;
  createdAt: string;
  /** Tujuan setelah pembatalan succeeds: menu untuk pelanggan, board untuk kasir. */
  cancelHref: string;
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

  /*
   * Batal pembayaran.
   *
   * Sama untuk pelanggan dan kasir: membatalkan berarti membatalkan
   * sungguhan lewat RPC cancel_unpaid_order, bukan cuma berpindah halaman.
   * Kalau ternyata sudah dibayar, errornya ditampilkan -- bukan diam-diam
   * kembali ke menu sambil pesanan tetap jalan.
   *
   * Hanya jadi berbeda di tujuan akhirnya:
   *   pelanggan -> kembali ke /menu?table=XX
   *   kasir     -> kembali ke board antrean
   */
  function handleCancelPayment() {
    setError(null);
    startTransition(async () => {
      const result = await expireOrder(orderId);

      if (!("success" in result) || result.success === false) {
        setError(
          "success" in result
            ? result.error
            : "Pesanan sudah dibayar atau sudah dibatalkan."
        );
        return;
      }

      router.push(cancelHref);
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

      <div className="space-y-2 border-t pt-4">
        {/*
          Satu tombol untuk pelanggan DAN kasir: "Batalkan Pembayaran".

          Sebelumnya pelanggan hanya dapat "Kembali ke Menu" yang cuma
          berpindah halaman tanpa menyentuh pesanan -- jadi pesanan unpaid
          menggantung di board kasir sampai timer habis, dan pelanggan yang
          salah tekan mengira pesanannya hilang. Sekarang membatalkan berarti
          membatalkan sungguhan, untuk keduanya.

          Yang berbeda cuma tujuan akhir (cancelHref): pelanggan balik ke
          /menu?table=XX, kasir balik ke board antrean.

          Pembatalan tidak bisa dibatalkan, jadi lewat modal konfirmasi dulu.
          AlertDialog yang sama sudah dipakai kartu pesanan di board kasir,
          jadi tidak ada komponen baru di sini.
        */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              disabled={isPending}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Batalkan Pembayaran
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Batalkan pembayaran?</AlertDialogTitle>
              <AlertDialogDescription>
                Pesanan atas nama <strong>{customerName}</strong> akan
                dibatalkan dan tidak bisa dilanjutkan. Kalau masih mau pesan,
                tekan <strong>Tidak Jadi</strong> dulu. Pesanan ini tetap
                menunggu pembayaran selama {PAYMENT_WINDOW_MINUTES} menit.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Tidak Jadi</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={handleCancelPayment}
              >
                Ya, Batalkan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <p className="text-center text-[11px] text-muted-foreground">
          Pesanan ini akan dibatalkan, bukan disimpan.
        </p>

        {/*
          Punya timer 15 menit yang tetap berjalan meski pelanggan pindah
          halaman. Beri tahu supaya dia tahu tidak WAJIB membatalkan sekarang
          -- kalau tidak, pesanan dibatalkan diam-diam dan pelanggan mengira
          pesanannya hilang.
        */}
        <p className="text-center text-[11px] text-muted-foreground">
          Pergi dulu boleh — pesanan ini tetap menunggu pembayaran sampai{" "}
          {PAYMENT_WINDOW_MINUTES} menit lagi.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KADU BATAS WAKTU                                                     */
/* ------------------------------------------------------------------ */

function ExpiredBox({
  backHref,
  backLabel,
}: {
  backHref: string;
  /** Label tombol ikut tujuan: pelanggan ke menu, kasir ke board. */
  backLabel: string;
}) {
  return (
    <div className="space-y-4 rounded-xl border-2 border-destructive/30 bg-destructive/5 p-6 text-center">
      <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
      <h1 className="font-serif text-xl font-bold">Waktu Pembayaran Habis</h1>
      <p className="text-sm text-muted-foreground">
        Batas waktu 15 menit untuk pembayaran sudah lewat, jadi pesanan ini otomatis dibatalkan.
      </p>
      <Button asChild variant="outline" className="w-full">
        <Link href={backHref}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {backLabel}
        </Link>
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

/** Berapa ms antar pengecekan status pembayaran. */
const POLL_MS = 4000;

/**
 * Pantau status pembayaran supaya halaman ikut ter-update begitu kasir
 * mengonfirmasi (jalur Tunai).
 *
 * SEBELUMNYA memakai Realtime `postgres_changes`. Sekarang polling, karena
 * Realtime tunduk pada RLS yang sama dengan select biasa: policy select untuk
 * anon sudah dihapus di `supabase/migrations/20261017-lock-down-orders-rls.sql`,
 * jadi halaman pembayaran customer (belum login) tidak lagi menerima event.
 *
 * Polling lewat RPC `get_order_payment_state()` yang mengembalikan satu baris.
 * Perubahan status terbaca paling lama 4 detik — untuk halaman bayar masih
 * masih diterima. Dashboard kasir tetap Realtime karena kasir itu staff.
 */
function useRealtimePayment(orderId: string, onPaid: () => void) {
  const router = useRouter();
  const cb = useRef(onPaid);
  cb.current = onPaid;

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();

        const { data, error } = await supabase.rpc("get_order_payment_state", {
          p_order_id: orderId,
        });

        if (cancelled || error || !data?.length) return;

        const row = data[0] as { status?: string; payment_status?: string };

        // Sudah bayar atau dibatalkan -> pindah ke halaman antrean.
        if (row.payment_status === "paid" || row.status === "cancelled") {
          cb.current();
          router.refresh();
        }
      } catch {
        // Gagal cek — coba lagi di tick berikutnya, halaman tetap menampilkan
        // state terakhir yang diketahui.
      }
    }

    const timer = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [orderId, router]);
}
