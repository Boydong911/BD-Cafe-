import Link from "next/link";
import type { Metadata } from "next";
import {
  Wallet,
  PiggyBank,
  Receipt,
  ShoppingBag,
  ArrowRight,
  Activity,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { SalesChart } from "@/components/admin/sales-chart";
import { StatCard } from "@/components/admin/stat-card";
import { TopMenuList } from "@/components/admin/top-menu-list";
import { RegistrationBanner } from "@/components/admin/registration-banner";
import {
  addDays,
  endOfWibDay,
  rupiah,
  startOfWibDay,
  wibDateKey,
} from "@/lib/format";
import {
  averageOrderValue,
  fetchActiveOrderCount,
  fetchSalesReport,
  fetchTopMenu,
  summarize,
} from "@/lib/sales";
import { fetchUnseenRegistrations } from "@/lib/registrations";
import { fetchOrderList, splitByCompletion, totalsOf } from "@/lib/order-list";

export const metadata: Metadata = {
  title: "Dashboard Owner",
};

// Ringkasan ikut berubah saat kasir memperbarui status pesanan.
export const dynamic = "force-dynamic";

export default async function OwnerOverviewPage() {
  const now = new Date();
  const todayStart = startOfWibDay(now);
  const todayKey = wibDateKey(now);

  // Satu pemanggilan untuk dua kebutuhan: baris "hari ini" dipakai kartu
  // metrik, seluruh 7 baris dipakai grafik tren.
  const weekStart = addDays(todayStart, -6);
  const weekEnd = endOfWibDay(now);

  const [rows, topMenu, active, registrations, todayOrders] = await Promise.all([
    fetchSalesReport("day", weekStart, weekEnd),
    fetchTopMenu(weekStart, weekEnd, 5),
    fetchActiveOrderCount(),
    fetchUnseenRegistrations(),
    fetchOrderList(todayStart, weekEnd),
  ]);

  const todayRows = rows.filter((row) => wibDateKey(new Date(row.bucket)) === todayKey);
  const today = summarize(todayRows);
  const week = summarize(rows);

  // Daftar pesanan hari ini dipisah dari grafik agregat, karena grafik
  // menghitung semua pesanan yang tidak dibatalkan (termasuk yang belum
  // dibayar). Owner butuh tahu mana yang uangnya benar-benar sudah masuk.
  const { pending: todayPending, settled: todaySettled } =
    splitByCompletion(todayOrders);
  const todayPendingTotals = totalsOf(todayPending);

  return (
    <div className="space-y-6">
      {/* Banner pendaftaran karyawan baru — paling atas, sebelum apa pun. */}
      <RegistrationBanner entries={registrations} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Ringkasan</h1>
          <p className="text-sm text-muted-foreground">
            Performa BD Coffee hari ini.
          </p>
        </div>
        <Link
          href="/admin/owner/penjualan"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Lihat laporan lengkap
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* `min-w-0` mencegah grid melebar melebihi layar HP saat isi kartu panjang */}
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Omzet Hari Ini"
          value={rupiah(today.omzet)}
          hint={`${today.orders} pesanan`}
          icon={Wallet}
        />
        <StatCard
          label="Profit Hari Ini"
          value={rupiah(today.netProfit)}
          hint={today.omzet > 0 ? `${marginPercent(today)} margin` : undefined}
          icon={PiggyBank}
          tone={today.netProfit >= 0 ? "positive" : "warning"}
        />
        <StatCard
          label="HPP Hari Ini"
          value={rupiah(today.cost)}
          icon={Receipt}
          tone="muted"
        />
        <StatCard
          label="Rata-rata / Pesanan"
          value={rupiah(averageOrderValue(today))}
          icon={ShoppingBag}
        />
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <StatCard
          label="Pesanan Berjalan"
          value={`${active.active} pesanan`}
          hint="Belum selesai & belum dibatalkan"
          icon={Activity}
        />
        <StatCard
          label="Menunggu Pembayaran"
          value={`${active.awaitingPayment} pesanan`}
          hint="QRIS belum dikonfirmasi / belum dibayar"
          icon={Clock}
          tone={active.awaitingPayment > 0 ? "warning" : "default"}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-lg font-semibold text-foreground">
            Tren 7 Hari
          </h2>
          <p className="text-sm text-muted-foreground">
            Total omzet {rupiah(week.omzet)} dari {week.orders} pesanan
          </p>
        </div>
        <SalesChart rows={rows} period="day" />
      </div>

      {/*
        Pemisahan "sudah final" vs "masih berjalan" untuk hari ini. Grafik di
        atas menghitung semua pesanan yang tidak dibatalkan, termasuk yang
        uangnya belum masuk — jadi kartu ini yang memperjelas agar owner tidak
        salah baca.
      */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Sudah Final Hari Ini"
          value={`${todaySettled.length} pesanan`}
          hint={`${rupiah(
            todaySettled.reduce((sum, row) => sum + row.total, 0)
          )} — lunas & selesai`}
          icon={CheckCircle2}
          tone="positive"
        />
        <StatCard
          label="Masih Berjalan Hari Ini"
          value={`${todayPendingTotals.count} pesanan`}
          hint={`${rupiah(todayPendingTotals.total)} belum masuk`}
          icon={Clock}
          tone={todayPendingTotals.count > 0 ? "warning" : "default"}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 font-serif text-lg font-semibold text-foreground">
          5 Menu Terlaris — 7 Hari Terakhir
        </h2>
        <TopMenuList items={topMenu} />
      </div>
    </div>
  );
}

/** Persentase margin = profit / omzet. Aman dari divide-by-zero. */
function marginPercent(total: { omzet: number; netProfit: number }): string {
  if (total.omzet <= 0) return "0%";
  return `${((total.netProfit / total.omzet) * 100).toFixed(1)}%`;
}
