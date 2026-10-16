import { Coffee } from "lucide-react";
import { rupiah } from "@/lib/format";
import type { TopMenuRow } from "@/types/sales";

/**
 * Daftar menu terlaris beserta porsi Contribution-nya.
 *
 * Porsi dihitung dari omzet menu itu dibanding total omzet seluruh menu di
 * daftar, jadi angkanya "bagian dari yang ditampilkan" — bukan dari omzet cafe
 * seluruhnya. Kalau daftarnya dipersingkat, barnya dinormalisasi ulang.
 */
export function TopMenuList({ items }: { items: TopMenuRow[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
        <Coffee className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Belum ada penjualan pada rentang ini.
        </p>
      </div>
    );
  }

  const totalQty = items.reduce((sum, item) => sum + Number(item.total_qty), 0);
  const maxQty = Math.max(...items.map((item) => Number(item.total_qty)), 1);

  return (
    <ol className="space-y-3">
      {items.map((item, index) => {
        const qty = Number(item.total_qty);
        const share = totalQty > 0 ? (qty / totalQty) * 100 : 0;

        return (
          <li key={item.menu_item_id} className="space-y-1.5">
            <div className="flex items-baseline gap-3">
              <span className="w-5 shrink-0 font-serif text-sm font-bold text-muted-foreground">
                {index + 1}.
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {item.menu_name}
              </span>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {qty} pcs
              </span>
              <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                {rupiah(item.total_omzet)}
              </span>
            </div>

            <div className="flex items-center gap-3 pl-8">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${(qty / maxQty) * 100}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {share.toFixed(0)}%
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
