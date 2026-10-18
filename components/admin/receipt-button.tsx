"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReceiptPrint } from "@/components/admin/receipt-print";
import type { KasirOrder } from "@/types/order";

/**
 * Tombol "Cetak Struk" untuk halaman nomor antrean.
 *
 * `ReceiptPrint` butuh state untuk memicu pencetakan, sedangkan halaman
 * pesanan adalah Server Component. Komponen ini jadi jembatan keduanya dan
 * memakai struk yang sama persis dengan yang dipakai board kasir, jadi
 * hasil cetaknya identik.
 */
export function ReceiptButton({
  order,
  className,
}: {
  order: KasirOrder;
  className?: string;
}) {
  const [printing, setPrinting] = useState<KasirOrder | null>(null);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={className}
        onClick={() => setPrinting(order)}
      >
        <Printer className="mr-2 h-4 w-4" />
        Cetak Struk
      </Button>

      <ReceiptPrint order={printing} onPrinted={() => setPrinting(null)} />
    </>
  );
}