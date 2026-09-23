"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/cart/cart-context";

export function TableSessionSync() {
  const searchParams = useSearchParams();
  const { applyScannedTable } = useCart();
  const table = searchParams.get("table");

  useEffect(() => {
    if (table) {
      applyScannedTable(table);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyScannedTable stabil dari context
  }, [table]);

  return null;
}