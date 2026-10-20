"use client";

import dynamic from "next/dynamic";

/**
 * Jembatan pemuatan dinamis untuk SalesChart.
 *
 * Recharts adalah pustaka grafik yang besar. Impor statis membuat SELURUH
 * recharts terunduh bersama JS halaman dashboard owner, padahal grafiknya
 * hanya satu bagian kecil dari halaman. Dengan `next/dynamic`, kartu-kartu
 * angka tetap tampil seketika (server-rendered), dan recharts hanya
 * terunduh bila grafiknya benar-benar hendak digambar di sisi browser.
 *
 * Dipakai: app/admin/owner/page.tsx dan app/admin/owner/penjualan/page.tsx.
 * Tampilan & perilaku SalesChart tidak berubah sama sekali.
 */
const SalesChart = dynamic(
  () => import("@/components/admin/sales-chart").then((m) => m.SalesChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground"
        style={{ height: 320 }}
      >
        Memuat grafik&hellip;
      </div>
    ),
  }
);

export { SalesChart };
