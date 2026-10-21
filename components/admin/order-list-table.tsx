"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatWibDateTime, rupiah } from "@/lib/format";
import type { OrderListRow } from "@/lib/order-list";

/**
 * Tabel detail pesanan untuk halaman Penjualan & Riwayat Transaksi.
 *
 * Urutan kolom mengikuti keinginan owner: waktu & outlet dulu (konteks),
 * kode & pemesan, lalu total uang, baru detail isi pesanan dan status.
 */
export function OrderListTable({ rows }: { rows: OrderListRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
        Belum ada pesanan pada rentang ini.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Tanggal &amp; Jam</TableHead>
            <TableHead className="whitespace-nowrap">Outlet</TableHead>
            <TableHead className="whitespace-nowrap">Kode Order</TableHead>
            <TableHead className="whitespace-nowrap">Nama Pemesan</TableHead>
            <TableHead className="whitespace-nowrap text-right">Total</TableHead>
            <TableHead className="whitespace-nowrap">Tipe</TableHead>
            <TableHead>Menu Pesanan</TableHead>
            <TableHead className="whitespace-nowrap">Bayar</TableHead>
            <TableHead className="whitespace-nowrap">Status</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {formatWibDateTime(row.created_at)}
              </TableCell>

              <TableCell className="whitespace-nowrap text-sm">
                {row.outletName}
              </TableCell>

              <TableCell className="whitespace-nowrap font-mono text-xs">
                {row.order_number ?? "—"}
              </TableCell>

              <TableCell className="whitespace-nowrap font-medium">
                {row.customer_name}
              </TableCell>

              <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
                {rupiah(row.total)}
              </TableCell>

              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {row.order_type === "dine_in"
                  ? `Dine In · Meja ${row.table_number ?? "?"}`
                  : "Take Away"}
              </TableCell>

              <TableCell className="min-w-[16rem] max-w-sm">
                <p className="truncate text-sm" title={row.itemsSummary}>
                  {row.itemsSummary || "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.itemCount} item
                </p>
              </TableCell>

              <TableCell className="whitespace-nowrap">
                <Badge
                  variant="outline"
                  className={
                    row.payment_method === "qris"
                      ? "border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200"
                      : "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                  }
                >
                  {row.payment_method === "qris" ? "QRIS" : "Cash"}
                </Badge>
              </TableCell>

              <TableCell className="whitespace-nowrap">
                <StatusBadge row={row} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Status digabung dari dua sumber: pembayaran dan progres pesanan. */
function StatusBadge({ row }: { row: OrderListRow }) {
  if (row.payment_status !== "paid") {
    return (
      <Badge
        variant="outline"
        className="border-destructive/40 bg-destructive/10 text-destructive"
      >
        Belum bayar
      </Badge>
    );
  }

  if (row.status === "completed") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
      >
        Selesai
      </Badge>
    );
  }

  if (row.status === "cancelled") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Dibatalkan
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
    >
      Sudah bayar, diproses
    </Badge>
  );
}
