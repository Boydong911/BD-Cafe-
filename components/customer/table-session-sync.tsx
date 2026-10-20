"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/cart/cart-context";
import { PUSAT_SLUG } from "@/lib/outlet-routes";

/**
 * Sinkronkan keranjang dengan konteks halaman:
 *   - `?table=` ada  -> kunci ke meja itu (dan slug outlet-nya)
 *   - `?table=` tidak ada -> bersihkan sisa sesi hasil scan, tapi SELALU
 *     simpan slug outlet halaman ini supaya tombol "Lanjut ke Checkout"
 *     mendarat di checkout outlet yang sama.
 */
export function TableSessionSync({ outletSlug = PUSAT_SLUG }: { outletSlug?: string }) {
  const searchParams = useSearchParams();
  const { applyScannedTable, clearScannedTable, hydrated } = useCart();
  const table = searchParams.get("table");

  useEffect(() => {
    if (!hydrated) return;

    if (table) {
      // Masuk lewat QR meja -> kunci ke meja itu + outletnya
      applyScannedTable(table, outletSlug);
    } else {
      // Masuk tanpa QR (mis. tombol "Lihat Menu" di landing page)
      // -> bersihkan sisa meja hasil scan sebelumnya; outlet tetap dicatat
      clearScannedTable(outletSlug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cukup jalan saat meja/outlet berubah / hydrate selesai
  }, [table, outletSlug, hydrated]);

  return null;
}
