import { ComingSoon } from "@/components/admin/coming-soon";

export default function OwnerSalesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Penjualan
        </h1>
        <p className="text-sm text-muted-foreground">
          Laporan omzet, HPP, dan profit — harian, mingguan, bulanan.
        </p>
      </div>
      <ComingSoon
        title="Laporan penjualan segera hadir"
        description="Bakal pakai get_sales_report() & get_top_menu() yang udah siap di database, tinggal disambungin ke grafik Recharts."
      />
    </div>
  );
}