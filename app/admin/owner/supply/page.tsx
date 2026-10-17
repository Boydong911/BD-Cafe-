import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = {
  title: "Stok Bahan Baku",
};

export default function OwnerSupplyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Supply
        </h1>
        <p className="text-sm text-muted-foreground">
          Pantau stok bahan baku.
        </p>
      </div>
      <ComingSoon
        title="Belum ada rancangan"
        description="Halaman ini nanti dipakai buat kelola stok bahan baku — desain & fiturnya masih nyusul, gak buru-buru."
      />
    </div>
  );
}