"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CategoryFilterGroup = {
  id: string;
  name: string;
  children: { id: string; name: string }[];
};

export type TopFilterValue = string; // "all" | "out" | grup id

/** Tombol "Stok Habis" bernilai khusus supaya tidak bentrok dengan id grup. */
export const OUT_OF_STOCK = "__out_of_stock__";
export const ALL = "__all__";

/**
 * Filter kategori dua tingkat.
 *
 * Baris pertama: Semua · tiap grup (Minuman / Makanan) · Stok Habis.
 * Baris kedua: sub-kategori — HANYA muncul kalau baris pertama sedang
 * menyorot salah satu grup.
 *
 * Sifatnya:
 *   - Baris pertama saling meniadakan (klik "Makanan" otomatis membatalkan
 *     "Minuman").
 *   - Sub-kategori hanya satu aktif. Klik lagi tombol yang sama untuk
 *     membatalkannya dan kembali ke semua isi grup.
 */
export function CategoryFilter({
  groups,
  activeGroup,
  activeChild,
  onGroupChange,
  onChildChange,
  outOfStockCount,
  showOutOfStock = true,
  className,
}: {
  groups: CategoryFilterGroup[];
  activeGroup: string;
  activeChild: string | null;
  onGroupChange: (value: string) => void;
  onChildChange: (value: string | null) => void;
  outOfStockCount?: number;
  showOutOfStock?: boolean;
  /** Ditambahkan ke elemen terluar. Dipakai /menu untuk meratakan label. */
  className?: string;
}) {
  const activeGroupData = groups.find((g) => g.id === activeGroup);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Button
          size="sm"
          variant={activeGroup === ALL ? "default" : "outline"}
          onClick={() => {
            onGroupChange(ALL);
            onChildChange(null);
          }}
          className="shrink-0"
        >
          Semua
        </Button>

        {groups.map((group) => (
          <Button
            key={group.id}
            size="sm"
            variant={activeGroup === group.id ? "default" : "outline"}
            onClick={() => {
              // Klik grup yang sama -> balik ke "Semua".
              if (activeGroup === group.id) {
                onGroupChange(ALL);
                onChildChange(null);
                return;
              }
              onGroupChange(group.id);
              onChildChange(null);
            }}
            className="shrink-0"
          >
            {group.name}
          </Button>
        ))}

        {showOutOfStock && (
          <Button
            size="sm"
            variant={activeGroup === OUT_OF_STOCK ? "default" : "outline"}
            onClick={() => {
              // "Stok Habis" menyingkirkan filter grup sepenuhnya.
              if (activeGroup === OUT_OF_STOCK) {
                onGroupChange(ALL);
              } else {
                onGroupChange(OUT_OF_STOCK);
              }
              onChildChange(null);
            }}
            className={cn("shrink-0")}
          >
            Stok Habis
            {typeof outOfStockCount === "number" && outOfStockCount > 0 && (
              <span className="ml-1.5 rounded-full bg-destructive/15 px-1.5 text-xs tabular-nums text-destructive">
                {outOfStockCount}
              </span>
            )}
          </Button>
        )}
      </div>

      {/*
        Baris kedua hanya muncul saat salah satu grup disorot. Diberi
        `aria-live` supaya screen reader ikut mengumumkan kemunculannya.
      */}
      <div aria-live="polite">
        {activeGroupData && activeGroupData.children.length > 0 && (
          <div className="flex gap-2 overflow-x-auto border-l-2 border-border pb-1 pl-3">
            {activeGroupData.children.map((child) => {
              const isActive = activeChild === child.id;

              return (
                <Button
                  key={child.id}
                  size="xs"
                  // Selalu `ghost`, karena variant `secondary` tidak punya state
                  // aktif yang mencolok. Bedakan aktif vs hover lewat class.
                  variant="ghost"
                  onClick={() =>
                    // Klik lagi tombol aktif -> batal, kembali ke semua isi grup.
                    onChildChange(isActive ? null : child.id)
                  }
                  aria-pressed={isActive}
                  className={cn(
                    "shrink-0 transition-colors",
                    isActive
                      ? "border border-accent bg-accent/15 font-semibold text-accent-foreground hover:bg-accent/25"
                      : "text-muted-foreground hover:border-border hover:bg-accent/10 hover:text-accent-foreground"
                  )}
                >
                  {child.name}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
