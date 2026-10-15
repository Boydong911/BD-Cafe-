"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/cart/cart-context";

export function TableSessionSync() {
  const searchParams = useSearchParams();
  const { applyScannedTable, clearScannedTable, hydrated } = useCart();
  const table = searchParams.get("table");

  useEffect(() => {
    if (!hydrated) return;

    if (table) {
      // Masuk lewat QR meja -> kunci ke meja itu
      applyScannedTable(table);
    } else {
      // Masuk tanpa QR (mis. tombol "Lihat Menu" di landing page)
      // -> bersihkan sisa meja hasil scan sebelumnya
      clearScannedTable();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cukup jalan saat meja berubah / hydrate selesai
  }, [table, hydrated]);

  return null;
}