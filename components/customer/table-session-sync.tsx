"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/cart/cart-context";

export function TableSessionSync() {
  const searchParams = useSearchParams();
  const { applyScannedTable, hydrated } = useCart();
  const table = searchParams.get("table");

  useEffect(() => {
    if (!hydrated || !table) return;
    applyScannedTable(table);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cukup jalan saat meja berubah / hydrate selesai
  }, [table, hydrated]);

  return null;
}