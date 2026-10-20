import type { Metadata } from "next";
import Link from "next/link";
import {
  Wallet,
  Receipt,
  PiggyBank,
  ShoppingBag,
  Clock,
  CheckCircle2,
  History,
} from "lucide-react";
import { SalesChart } from "@/components/admin/sales-chart-lazy";
import { SalesFilter } from "@/components/admin/sales-filter";
import { StatCard } from "@/components/admin/stat-card";
import { TopMenuList } from "@/components/admin/top-menu-list";
import { OrderListTable } from "@/components/admin/order-list-table";
import { OutletPicker } from "@/components/admin/outlet-picker";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PERIOD,
  PERIOD_LABELS,
  parsePeriod,
  parsePreset,
  resolveRange,
  rupiah,
} from "@/lib/format";
import {
  averageOrderValue,
  fetchSalesReport,
  fetchTopMenu,
  summarize,
} from "@/lib/sales";
import { fetchOrderList, splitByCompletion, totalsOf } from "@/lib/order-list";
import { fetchOutlets, resolveOutletScope } from "@/lib/outlets";

export const metadata: Metadata = {
  title: "Penjualan",
};

// Laporan ikut berubah saat kasir memperbarui status pesanan.
export const dynamic = "force-dynamic";

const DEFAULT_PRESET = "30d" as const;

export default async function OwnerSalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const preset = parsePreset(params.range, DEFAULT_PRESET);
  const period = parsePeriod(params.period, DEFAULT_PERIOD[preset]);
  const range = resolveRange(preset);

  const outlets = await fetchOutlets();
  const scope = resolveOutletScope(outlets, params.outlet);

  const [rows, topMenu, orderList] = await Promise.all([
    fetchSalesReport(period, range.start, range.end, scope.outlet_id),
    fetchTopMenu(range.start, range.end, 5, scope.outlet_id),
    fetchOrderList(range.start, range.end, scope.outlet_id),
  ]);

  const total = summarize(rows);
  const avgOrder = averageOrderValue(total);
  const hasData = rows.length > 0;

  // Pisahkan yang masih berjalan dari yang sudah final, supaya owner langsung
  // melihat uang mana yang belum masuk.
  const { pending, settled } = splitByCompletion(orderList);
  const pendingTotals = totalsOf(pending);
  const settledTotals = totalsOf(settled);

  // `min-w-0` mencegah grid melebar melewati layar HP
  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-bold text-foreground">
            Penjualan
          </h1>
          <p className="text-sm text-muted-foreground">
            Laporan omzet, HPP, dan profit — {range.label},{" "}
            {PERIOD_LABELS[period].toLowerCase()} · {scope.nama}.
          </p>
        </div>
        <OutletPicker
          allowSemua
          outlets={outlets}
          currentSlug={scope.slug}
        />
      </div>

      <SalesFilter preset={preset} period={period} />

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Omzet"
          value={rupiah(total.omzet)}
          hint={`${total.orders} pesanan`}
          icon={Wallet}
        />
        <StatCard
          label="Total HPP"
          value={rupiah(total.cost)}
          hint={hasData ? `${marginPercent(total)} margin` : undefined}
          icon={Receipt}
          tone="muted"
        />
        <StatCard
          label="Profit Bersih"
          value={rupiah(total.netProfit)}
          hint={hasData ? `${marginPercent(total)} margin` : undefined}
          icon={PiggyBank}
          tone={total.netProfit >= 0 ? "positive" : "warning"}
        />
        <StatCard
          label="Rata-rata / Pesanan"
          value={rupiah(avgOrder)}
          icon={ShoppingBag}
        />
      </div>

      {/* `p-4 sm:p-5` + `overflow-hidden` supaya grafik tidak keluar dari kartu di HP */}
      <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="font-serif text-lg font-semibold text-foreground">
          Tren Omzet
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Batang = omzet & HPP, garis = profit.
        </p>
        <SalesChart rows={rows} period={period} />
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 font-serif text-lg font-semibold text-foreground">
          5 Menu Terlaris
        </h2>
        <TopMenuList items={topMenu} />
      </div>

      {/*
        Pesanan yang belum final dipisah dari yang sudah final. Angka di kartu
        "Sedang Berjalan" sengaja TIDAK ikut masuk ke omzet di atas, supaya
        owner tidak salah kira uang yang belum masuk sudah terjual.
      */}
      <div className="space-y-4">
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground">
            Pesanan Sedang Berjalan
          </h2>
          <p className="text-sm text-muted-foreground">
            Belum lunas atau belum diselesaikan kasir. Belum termasuk omzet di
            atas.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Jumlah Pesanan Berjalan"
            value={`${pendingTotals.count} pesanan`}
            hint={
              pendingTotals.count === 0
                ? "Semua pesanan sudah final"
                : "Masih menunggu pembayaran atau penyelesaian"
            }
            icon={Clock}
            tone={pendingTotals.count > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Nilai Belum Masuk"
            value={rupiah(pendingTotals.total)}
            hint={`Dari ${settledTotals.count} pesanan sudah selesai: ${rupiah(settledTotals.total)}`}
            icon={CheckCircle2}
            tone={pendingTotals.count > 0 ? "warning" : "positive"}
          />
        </div>

        <OrderListTable rows={pending} />
      </div>

      {/*
        Riwayat panjang dipindah ke halaman tersendiri supaya halaman laporan
        tetap ringan; scope outlet mengikuti pilihan di atas.
      */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="min-w-0">
          <h2 className="font-serif text-lg font-semibold text-foreground">
            Riwayat Pesanan
          </h2>
          <p className="text-sm text-muted-foreground">
            Daftar lengkap per pesanan {scope.slug === "semua" ? "dari semua outlet" : scope.nama} — bentang seluruh
            waktu.
          </p>
        </div>
        <Button asChild>
          <Link href={`/admin/owner/penjualan/riwayat-transaksi/${scope.slug}`}>
            <History className="h-4 w-4" />
            Lihat Riwayat Transaksi
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** Persentase margin = profit / omzet. Aman dari divide-by-zero. */
function marginPercent(total: { omzet: number; netProfit: number }): string {
  if (total.omzet <= 0) return "0%";
  return `${((total.netProfit / total.omzet) * 100).toFixed(1)}%`;
}
