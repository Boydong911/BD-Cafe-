import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OrderListTable } from "@/components/admin/order-list-table";
import { OutletPicker } from "@/components/admin/outlet-picker";
import { Button } from "@/components/ui/button";
import { fetchOutlets } from "@/lib/outlets";
import { fetchOrderList, totalsOf } from "@/lib/order-list";
import { rupiah } from "@/lib/format";

export const metadata: Metadata = {
  title: "Riwayat Transaksi",
};

// Riwayat ikut berubah saat kasir menyelesaikan pesanan.
export const dynamic = "force-dynamic";

/**
 * Riwayat pesanan per lingkup:
 *   [scope] = "semua"  -> semua outlet digabung
 *   [scope] = slug outlet -> hanya outlet itu (contoh: outlet-a)
 *
 * Daftar menampilkan SELURUH sejarah (tanpa batas tanggal), terbaru dulu —
 * bentang panjang inilah alasannya dipisah dari halaman laporan.
 */
export default async function RiwayatTransaksiPage({
  params,
}: {
  params: Promise<{ scope: string }>;
}) {
  const { scope } = await params;
  const slug = scope.toLowerCase();

  const outlets = await fetchOutlets();
  const outlet = slug === "semua" ? null : outlets.find((o) => o.slug === slug);

  // Slug tak dikenal -> bawa balik ke laporan, jangan tunjukkan error.
  if (!outlet && slug !== "semua") {
    redirect("/admin/owner/penjualan");
  }

  const rows = await fetchOrderList(null, null, outlet ? outlet.id : null);
  const totals = totalsOf(rows);

  const nama = outlet ? outlet.nama : null;

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-bold text-foreground">
            Riwayat Transaksi
          </h1>
          <p className="text-sm text-muted-foreground">
            {nama ? nama : "Semua Outlet"} · seluruh rentang waktu, terbaru
            dulu.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <OutletPicker
            allowSemua
            outlets={outlets}
            currentSlug={slug}
            hrefBase="/admin/owner/penjualan/riwayat-transaksi"
          />
          <Button variant="outline" asChild>
            <Link href={`/admin/owner/penjualan?outlet=${slug}`}>
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Penjualan
            </Link>
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {rows.length} pesanan · total {rupiah(totals.total)}
      </p>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="font-medium text-foreground">Belum ada pesanan.</p>
          <p className="text-sm text-muted-foreground">
            Riwayat akan terisi otomatis setelah ada pesanan masuk
            {outlet ? ` di ${outlet.nama}` : ""}.
          </p>
        </div>
      ) : (
        <OrderListTable rows={rows} />
      )}
    </div>
  );
}
