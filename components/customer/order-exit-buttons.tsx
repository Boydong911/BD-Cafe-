"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ReceiptButton } from "@/components/admin/receipt-button";
import { isFromKasir } from "@/components/customer/order-source";
import { outletMenuHref } from "@/lib/outlet-routes";
import type { KasirOrder } from "@/types/order";

/**
 * Tombol keluar di halaman nomor antrean.
 *
 * Penentuannya `isFromKasir()`, bukan "ada sesi staff". Di perangkat
 * counter yang dipakai bersama, pelanggan yang sedang membuat pesanan punya
 * sesi staff yang sama -- kalau pakai sesi, dia ikut melihat tombol kasir
 * dan "Kembali ke Kasir" bisa mendaratkannya di board staff. Itu bug yang
 * pernah terjadi.
 *
 *   kasir   -> Cetak Struk + Kembali ke Kasir
 *   pelanggan -> Kembali ke Menu (ke /menu?table=XX kalau pesanan dari meja)
 *
 * `useEffect` dipakai karena penandanya ada di sessionStorage yang hanya
 * bisa dibaca di browser. Tanpa itu Server Component akan selalu merender
 * cabang pelanggan dan tombol kasir tidak pernah muncul.
 */
export function OrderExitButtons({
  order,
  outletSlug,
}: {
  order: KasirOrder;
  /** Slug outlet tempat pesanan dibuat — kembali ke menu/board outlet yang sama. */
  outletSlug: string;
}) {
  const [fromKasir, setFromKasir] = useState(false);

  useEffect(() => {
    setFromKasir(isFromKasir());
  }, []);

  if (fromKasir) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <ReceiptButton order={order} className="flex-1" />

        <Button asChild className="flex-1">
          <Link href={`/${outletSlug}/admin/kasir`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali ke Kasir
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t pt-4">
      <Button asChild variant="outline" className="w-full">
        <Link href={outletMenuHref(outletSlug, order.table_number)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Menu
        </Link>
      </Button>
    </div>
  );
}