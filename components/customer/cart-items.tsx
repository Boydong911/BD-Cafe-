"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/cart-context";

export const formatPrice = (price: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);

/**
 * Daftar isi keranjang.
 *
 * Dipakai dua tempat: di dalam sheet (/menu, checkout) dan sebagai panel 25%
 * di tab "Pesan Menu" kasir. Warna teksnya geared ke panel gelap
 * (`bg-primary text-primary-foreground`), jadi jangan dipakai di atas
 * background putih tanpa membungkus pemanggilnya.
 */
export function CartItemList({ className }: { className?: string }) {
  const { items, updateQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <p className={className ?? "py-8 text-center text-sm"}>
        Keranjang masih kosong, yuk pilih menu dulu!
      </p>
    );
  }

  return (
    <div className={className ?? "space-y-3"}>
      {items.map((item) => (
        <div
          key={item.lineId}
          className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 last:border-0"
        >
          <div className="flex-1">
            <p className="text-sm font-semibold">{item.name}</p>
            {item.customizations.length > 0 ? (
              <p className="text-xs text-primary-foreground/70">
                {item.customizations.map((c) => c.label).join(" · ")}
              </p>
            ) : (
              item.description && (
                <p className="line-clamp-1 text-xs text-primary-foreground/50">
                  {item.description}
                </p>
              )
            )}
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-primary-foreground/70">
                {formatPrice(item.price)}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-5 w-5 border-white/30 bg-transparent text-primary-foreground hover:bg-white/10"
                  onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                >
                  <Minus className="h-2.5 w-2.5" />
                </Button>
                <span className="w-4 text-center text-xs font-medium">
                  {item.quantity}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-5 w-5 border-white/30 bg-transparent text-primary-foreground hover:bg-white/10"
                  onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                >
                  <Plus className="h-2.5 w-2.5" />
                </Button>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <p className="text-sm font-semibold">
              {formatPrice(item.price * item.quantity)}
            </p>
            <button
              onClick={() => removeItem(item.lineId)}
              aria-label={`Hapus ${item.name}`}
              className="text-primary-foreground/50 transition-colors hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}