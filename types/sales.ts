/**
 * Bentuk data laporan penjualan.
 *
 * Dipisah dari `lib/sales.ts` karena komponen Client (grafik Recharts)
 * ikut memakai tipe ini, sedangkan `lib/sales.ts` memakai `server-only`.
 * Kalau digabung, mengimpor tipe ke Client Component bisa menarik modul
 * `server-only` ke bundel browser.
 */

/** Baris yang dikembalikan function `get_sales_report()`. */
export type SalesRow = {
  bucket: string;
  omzet: number;
  cost: number;
  net_profit: number;
  total_orders: number;
};

/** Baris yang dikembalikan function `get_top_menu()`. */
export type TopMenuRow = {
  menu_item_id: string;
  menu_name: string;
  total_qty: number;
  total_omzet: number;
};

export type SalesSummary = {
  omzet: number;
  cost: number;
  netProfit: number;
  orders: number;
};
