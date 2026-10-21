import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { OrderListTable } from "@/components/admin/order-list-table";
import { OutletPicker } from "@/components/admin/outlet-picker";
import { Button } from "@/components/ui/button";
import { fetchOutlets } from "@/lib/outlets";
import { fetchOrderListGrandTotal, fetchOrderListPage } from "@/lib/order-list";
import { rupiah } from "@/lib/format";

export const metadata: Metadata = {
  title: "Riwayat Transaksi",
};

// Riwayat ikut berubah saat kasir menyelesaikan pesanan.
export const dynamic = "force-dynamic";

/** Jumlah baris per halaman riwayat (permintaan owner). */
const PER_PAGE = 25;

/**
 * Riwayat pesanan per lingkup:
 *   [scope] = "semua"  -> semua outlet digabung
 *   [scope] = slug outlet -> hanya outlet itu (contoh: outlet-a)
 *
 * Daftar menampilkan SELURUH sejarah (tanpa batas tanggal), terbaru dulu,
 * 25 pesanan per halaman. Halaman berikutnya lewat tombol di bawah tabel —
 * jalurnya `?page=N` supaya setiap halaman tetap server-rendered.
 */
export default async function RiwayatTransaksiPage({
  params,
  searchParams,
}: {
  params: Promise<{ scope: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ scope }, { page: pageParam }] = await Promise.all([params, searchParams]);
  const slug = scope.toLowerCase();

  // `?page=` aneh/absen -> halaman 1; tidak pernah 0 atau negatif.
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const outlets = await fetchOutlets();
  const outlet = slug === "semua" ? null : outlets.find((o) => o.slug === slug);

  // Slug tak dikenal -> bawa balik ke laporan, jangan tunjukkan error.
  if (!outlet && slug !== "semua") {
    redirect("/admin/owner/penjualan");
  }

  const outletId = outlet ? outlet.id : null;
  const [{ rows, total }, grand] = await Promise.all([
    fetchOrderListPage(null, null, outletId, page, PER_PAGE),
    fetchOrderListGrandTotal(null, null, outletId),
  ]);

  const nama = outlet ? outlet.nama : null;

  // "Menampilkan 26–50 dari 132 pesanan" — batas bawah/atas halaman ini.
  const first = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const last = Math.min(page * PER_PAGE, total);
  const hasMore = page * PER_PAGE < total;
  const basePath = `/admin/owner/penjualan/riwayat-transaksi/${slug}`;

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
        {total === 0
          ? "Belum ada pesanan."
          : `Menampilkan ${first}–${last} dari ${total} pesanan · total ${rupiah(grand.total)}`}
      </p>

      {rows.length === 0 ? (
        page > 1 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <p className="font-medium text-foreground">Halaman ini kosong.</p>
            <p className="text-sm text-muted-foreground">
              Riwayat berhenti di halaman {page - 1}.
            </p>
            <Button variant="outline" asChild className="mt-4">
              <Link href={basePath}>Kembali ke halaman 1</Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <p className="font-medium text-foreground">Belum ada pesanan.</p>
            <p className="text-sm text-muted-foreground">
              Riwayat akan terisi otomatis setelah ada pesanan masuk
              {outlet ? ` di ${outlet.nama}` : ""}.
            </p>
          </div>
        )
      ) : (
        <>
          <OrderListTable rows={rows} />

          {/* Navigasi halaman: hanya tampil kalau memang ada halanannya. */}
          {(page > 1 || hasMore) && (
            <div className="flex items-center justify-between gap-3">
              {page > 1 ? (
                <Button variant="outline" asChild>
                  <Link href={`${basePath}?page=${page - 1}`}>
                    <ArrowLeft className="h-4 w-4" />
                    Sebelumnya
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              {hasMore ? (
                <Button asChild>
                  <Link href={`${basePath}?page=${page + 1}`}>
                    Lihat {PER_PAGE} Transaksi Berikutnya
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <span />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
