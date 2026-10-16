"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBucketLabel, rupiah, rupiahShort, type ReportPeriod } from "@/lib/format";
import type { SalesRow } from "@/types/sales";

type ChartPoint = {
  label: string;
  omzet: number;
  cost: number;
  net_profit: number;
};

function toChartData(rows: SalesRow[], period: ReportPeriod): ChartPoint[] {
  return rows.map((row) => ({
    label: formatBucketLabel(row.bucket, period),
    omzet: Number(row.omzet),
    cost: Number(row.cost),
    net_profit: Number(row.net_profit),
  }));
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey?: string; value?: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const rows = [
    { key: "omzet", name: "Omzet", color: "hsl(var(--accent))" },
    { key: "cost", name: "HPP", color: "hsl(var(--muted-foreground))" },
    { key: "net_profit", name: "Profit", color: "hsl(var(--primary))" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-md">
      <p className="mb-1.5 text-xs font-semibold text-foreground">{label}</p>
      <div className="space-y-1">
        {rows.map((row) => {
          const value = payload.find((p) => p.dataKey === row.key)?.value ?? 0;
          return (
            <div key={row.key} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span className="text-muted-foreground">{row.name}</span>
              <span className="ml-auto font-medium tabular-nums text-foreground">
                {rupiah(value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Grafik omzet vs HPP vs profit.
 *
 * Omzet & HPP digambar sebagai batang bersebelahan, profit sebagai garis —
 * bentuknya linier sehingga trennya lebih mudah dibaca daripada batang ketiga.
 */
export function SalesChart({
  rows,
  period,
  height = 320,
}: {
  rows: SalesRow[];
  period: ReportPeriod;
  height?: number;
}) {
  const data = toChartData(rows, period);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground"
        style={{ height }}
      >
        Belum ada transaksi pada rentang ini.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={8}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={72}
          tickFormatter={(value: number) => rupiahShort(value)}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        <Bar dataKey="omzet" name="Omzet" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="cost" name="HPP" fill="hsl(var(--muted-foreground) / 0.45)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Line
          type="monotone"
          dataKey="net_profit"
          name="Profit"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
