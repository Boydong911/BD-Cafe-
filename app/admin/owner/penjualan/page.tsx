import { Wallet, Receipt, PiggyBank, ShoppingBag } from "lucide-react";
import { SalesChart } from "@/components/admin/sales-chart";
import { SalesFilter } from "@/components/admin/sales-filter";
import { StatCard } from "@/components/admin/stat-card";
import { TopMenuList } from "@/components/admin/top-menu-list";
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

  const [rows, topMenu] = await Promise.all([
    fetchSalesReport(period, range.start, range.end),
    fetchTopMenu(range.start, range.end, 5),
  ]);

  const total = summarize(rows);
  const avgOrder = averageOrderValue(total);
  const hasData = rows.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Penjualan</h1>
        <p className="text-sm text-muted-foreground">
          Laporan omzet, HPP, dan profit — {range.label},{" "}
          {PERIOD_LABELS[period].toLowerCase()}.
        </p>
      </div>

      <SalesFilter preset={preset} period={period} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-serif text-lg font-semibold text-foreground">
          Tren Omzet
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Batang = omzet & HPP, garis = profit.
        </p>
        <SalesChart rows={rows} period={period} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 font-serif text-lg font-semibold text-foreground">
          5 Menu Terlaris
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
