"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCart, type SelectedCustomization } from "@/lib/cart/cart-context";
import type { CustomizationGroup } from "@/types/menu";

export type MenuCardItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  /** Id kategori untuk filter dua tingkat (Minuman / Makanan -> sub-kategori). */
  category_id: string | null;
  category_name: string | null;
  /**
   * Grup kustomisasi dari server. Menu MINUMAN punya Gula + Suhu; menu
   * MAKANAN kosong, jadi tidak ada tombol di kartunya.
   */
  customization_groups: CustomizationGroup[];
};

const WRAP =
  "flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md";

/**
 * Kartu katalog. Bentuknya ditentukan oleh ada-tidaknya `?table=`.
 *
 *  - Tanpa `?table=` (mis. /menu): hanya gambar + nama. Ini halaman
 *    "lihat-lihat", belum ada meja yang dituju, jadi tombol pesan
 *    tidak muncul.
 *  - Dengan `?table=` (mis. /menu?table=02): pelanggan sedang duduk di
 *    meja itu, jadi kustomisasi, jumlah, dan tombol keranjang muncul
 *    supaya pesan bisa langsung dari kartu.
 *
 * Tidak ada prop baru untuk ini -- `tableParam` sudah ada.
 */
export function MenuCard({
  item,
  tableParam,
}: {
  item: MenuCardItem;
  tableParam: string | null;
}) {
  const href = tableParam ? `/menu/${item.id}?table=${tableParam}` : `/menu/${item.id}`;

  return (
    <div className={WRAP}>
      <MenuCardTop item={item} href={href} />
      {tableParam && <MenuCardControls item={item} />}
    </div>
  );
}

/** Blok atas kartu: gambar + nama. Dipakai di kedua bentuk kartu. */
function MenuCardTop({ item, href }: { item: MenuCardItem; href: string }) {
  return (
    <Link href={href} className="group block">
      <div className="relative aspect-square w-full bg-muted">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={`object-cover transition-transform group-hover:scale-105 ${
              item.is_available ? "" : "grayscale"
            }`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageOff className="h-8 w-8" />
          </div>
        )}

        {!item.is_available && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Badge variant="destructive">Stok Habis</Badge>
          </div>
        )}
      </div>

      <p className="p-3 text-center text-sm font-semibold leading-snug">
        {item.name}
      </p>
    </Link>
  );
}

/**
 * Kustomisasi + jumlah + tombol keranjang. Hanya muncul kalau kartu dibuka
 * lewat `?table=`.
 *
 * Drink  : Gula (Non Sugar / Less Sugar / Sugar) dan Suhu (Ice / Hot)
 * Makanan: tidak ada tombol kustomisasi, cuma jumlah dan keranjang.
 *
 * Semua opsi ditampilkan, bukan dipotong, supaya tiga pilihan gula muat.
 */
function MenuCardControls({ item }: { item: MenuCardItem }) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);

  const groups = item.customization_groups;
  const disabled = !item.is_available;

  // Pilihan awal = opsi pertama tiap grup (mis. "Non Sugar" + "Ice").
  const [picked, setPicked] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const g of groups) {
      if (g.options[0]) initial[g.name] = g.options[0].label;
    }
    return initial;
  });

  const customizations: SelectedCustomization[] = useMemo(
    () =>
      groups.flatMap((g) => {
        const opt = g.options.find((o) => o.label === picked[g.name]);
        return opt
          ? [{ name: g.name, label: opt.label, price_delta: opt.price_delta }]
          : [];
      }),
    [groups, picked]
  );

  const unitPrice =
    item.price + customizations.reduce((sum, c) => sum + c.price_delta, 0);

  function handleAddToCart() {
    addItem(
      {
        id: item.id,
        name: item.name,
        description: item.description,
        price: unitPrice,
        imageUrl: item.image_url,
        customizations,
      },
      qty
    );
    setQty(1);
  }

  return (
    <>
      {groups.length > 0 && (
        <div className="space-y-1.5 px-3 pb-1">
          {groups.map((g) => (
            <div key={g.name} className="flex flex-wrap gap-1">
              {g.options.map((opt) => {
                const active = picked[g.name] === opt.label;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    disabled={disabled}
                    onClick={() => setPicked((prev) => ({ ...prev, [g.name]: opt.label }))}
                    className={`flex-1 truncate rounded-md border px-1 py-1.5 text-[11px] font-medium leading-tight transition-colors disabled:opacity-50 ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center gap-2 p-3 pt-2">
        <div className="flex items-center gap-1 rounded-md border">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={disabled || qty <= 1}
            aria-label="Kurangi jumlah"
            className="p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-5 text-center text-sm font-medium tabular-nums">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            disabled={disabled}
            aria-label="Tambah jumlah"
            className="p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={disabled}
          aria-label={`Tambah ${item.name} ke keranjang`}
          className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          <ShoppingBag className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}