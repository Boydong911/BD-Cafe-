import { createClient } from "@/lib/supabase/server";
import { KasirBoard } from "@/components/admin/kasir-board";
import type { KasirOrder } from "@/types/order";

export const dynamic = "force-dynamic";

// Awal hari ini dalam WIB (UTC+7), dihitung manual karena server bisa jalan di UTC
function startOfTodayWIB(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  wib.setUTCHours(0, 0, 0, 0);
  return new Date(wib.getTime() - 7 * 60 * 60 * 1000).toISOString();
}

export default async function KasirPage() {
  const supabase = await createClient();

  // Semua pesanan aktif (walau dari hari kemarin) + semua pesanan hari ini
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .or(
      `status.in.(pending,confirmed,preparing,ready),created_at.gte.${startOfTodayWIB()}`
    )
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Gagal memuat pesanan. Coba muat ulang halaman.
      </p>
    );
  }

  const orders = (data ?? []) as unknown as KasirOrder[];

  return <KasirBoard orders={orders} />;
}