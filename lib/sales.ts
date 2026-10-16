import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ReportPeriod } from "@/lib/format";
import type { SalesRow, SalesSummary, TopMenuRow } from "@/types/sales";

/**
 * Ambil laporan penjualan dari function `get_sales_report()`.
 *
 * `SECURITY DEFINER` dengan grant ke `authenticated`, jadi owner yang sudah
 * login bisa memanggilnya. Kalau RPC gagal, halaman tidak ikut mati — kembalikan
 * array kosong supaya dashboard tetap tampil dengan pesan "belum ada data".
 */
export async function fetchSalesReport(
  period: ReportPeriod,
  start: Date,
  end: Date
): Promise<SalesRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_sales_report", {
    p_period: period,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });

  if (error) {
    console.error("[sales] get_sales_report gagal:", error.message);
    return [];
  }

  return data ?? [];
}

export async function fetchTopMenu(
  start: Date,
  end: Date,
  limit = 5
): Promise<TopMenuRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_top_menu", {
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_limit: limit,
  });

  if (error) {
    console.error("[sales] get_top_menu gagal:", error.message);
    return [];
  }

  return data ?? [];
}

/**
 * Jumlahkan seluruh bucket jadi satu ringkasan.
 *
 * Aman dijumlahkan: `get_sales_report()` mengelompokkan dengan `date_trunc`,
 * jadi satu pesanan hanya masuk ke satu bucket — tidak ada yang terhitung dua kali.
 */
export function summarize(rows: SalesRow[]): SalesSummary {
  return rows.reduce<SalesSummary>(
    (acc, row) => ({
      omzet: acc.omzet + Number(row.omzet),
      cost: acc.cost + Number(row.cost),
      netProfit: acc.netProfit + Number(row.net_profit),
      orders: acc.orders + Number(row.total_orders),
    }),
    { omzet: 0, cost: 0, netProfit: 0, orders: 0 }
  );
}

/** Rata-rata nilai satu pesanan. 0 kalau belum ada pesanan (avoid divide-by-zero). */
export function averageOrderValue(summary: SalesSummary): number {
  return summary.orders > 0 ? summary.omzet / summary.orders : 0;
}

/** Status pesanan yang masih "jalan" — dipakai kartu ringkasan. */
export type ActiveOrderCount = {
  active: number;
  awaitingPayment: number;
};

export async function fetchActiveOrderCount(): Promise<ActiveOrderCount> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "confirmed", "preparing", "ready"])
    .neq("status", "cancelled");

  if (error) {
    console.error("[sales] hitung pesanan aktif gagal:", error.message);
    return { active: 0, awaitingPayment: 0 };
  }

  const { count: unpaid } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("payment_status", "pending")
    .neq("status", "cancelled");

  return { active: count ?? 0, awaitingPayment: unpaid ?? 0 };
}
