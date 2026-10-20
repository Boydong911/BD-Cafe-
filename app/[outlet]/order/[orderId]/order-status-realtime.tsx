"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu Konfirmasi",
  confirmed: "Dikonfirmasi",
  preparing: "Sedang Dibuat",
  ready: "Siap Diambil/Diantar",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

/** Berapa ms antar pengecekan status. 5 detik masih terasa responsif. */
const POLL_MS = 5000;

/**
 * Status pesanan untuk halaman customer.
 *
 * SEBELUMNYA memakai Supabase Realtime (`postgres_changes`). Sekarang memakai
 * polling, karena Realtime tunduk pada RLS yang sama dengan select biasa:
 * policy select untuk anon sudah dihapus di
 * `supabase/migrations/20261017-lock-down-orders-rls.sql`, jadi halaman customer
 * (yang belum login) tidak lagi menerima event perubahan.
 *
 * Konsekuensinya: status paling lambat 5 detik baru berubah. Untuk layar
 * antrean pelanggan, itu masih sangat diterima. Dashboard kasir tetap
 * memakai Realtime karena kasir adalah staff dan policy-nya masih terbuka.
 *
 * Halaman ini tetap render dari `initialStatus` (dari server), jadi tidak ada
 * flash kosong saat hydration.
 */
export function OrderStatusRealtime({
  orderId,
  initialStatus,
}: {
  orderId: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);

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

        const next = (data[0] as { status?: string }).status;
        if (next) setStatus(next);
      } catch {
        // Gagal cek (jaringan putus, RPC belum ada) — coba lagi di tick berikutnya.
        // Halaman tetap menampilkan status terakhir yang diketahui.
      }
    }

    const timer = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [orderId]);

  return (
    <div className="flex items-center gap-2 rounded-lg border p-4">
      <span className="text-sm text-muted-foreground">Status:</span>
      <Badge variant={status === "cancelled" ? "destructive" : "default"}>
        {STATUS_LABEL[status] ?? status}
      </Badge>
    </div>
  );
}
