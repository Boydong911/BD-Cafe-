import { ComingSoon } from "@/components/admin/coming-soon";

export default function OwnerOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Ringkasan
        </h1>
        <p className="text-sm text-muted-foreground">
          Gambaran performa BD Coffee hari ini.
        </p>
      </div>
      <ComingSoon
        title="Statistik segera hadir"
        description="Kartu omzet, order masuk, dan grafik penjualan bakal muncul di sini begitu data transaksi mulai masuk lewat Checkout."
      />
    </div>
  );
}