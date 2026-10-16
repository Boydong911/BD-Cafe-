"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageOff, Minus, Plus, ShoppingBag } from "lucide-react";
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
  /** Grup kustomisasi yang sudah dibersihkan dari server (Gula / Suhu) */
  customization_groups: CustomizationGroup[];
};

export function MenuCard({
  item,
  tableParam,
}: {
  item: MenuCardItem;
  tableParam: string | null;
}) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);

  const groups = item.customization_groups;

  // Pilihan awal = opsi pertama tiap grup (mis. "Non Gula" + "Ice")
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

  const href = tableParam ? `/menu/${item.id}?table=${tableParam}` : `/menu/${item.id}`;

  const handleAddToCart = () => {
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
  };

  return (
    <Card className="overflow-hidden py-0 transition-shadow hover:shadow-md">
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

          {item.category_name && (
            <Badge variant="secondary" className="absolute left-2 top-2 shadow-sm">
              {item.category_name}
            </Badge>
          )}
        </div>

        <CardContent className="space-y-0.5 p-2.5 pb-1.5">
          <h3 className="line-clamp-1 text-sm font-bold leading-tight">{item.name}</h3>
          {item.description && (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {item.description}
            </p>
          )}
        </CardContent>
      </Link>

      <div className="space-y-2 p-2.5 pt-0">
        <p className="text-sm font-semibold">Rp {item.price.toLocaleString("id-ID")}</p>

        {/* Pilihan cepat: tiap grup = 1 kolom, 2 tombol ditumpuk vertikal.
            Klik sekali langsung masuk keranjang tanpa buka halaman detail. */}
        {groups.length > 0 && (
          <div className="flex gap-1.5">
            {groups.map((g) => (
              <div key={g.name} className="flex min-w-0 flex-1 flex-col gap-1">
                {g.options.slice(0, 2).map((opt) => {
                  const active = picked[g.name] === opt.label;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      disabled={!item.is_available}
                      onClick={() =>
                        setPicked((prev) => ({ ...prev, [g.name]: opt.label }))
                      }
                      className={`w-full truncate rounded-md border px-1 py-1 text-[11px] font-medium leading-tight transition-colors disabled:opacity-50 ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      }`}
                      title={opt.label}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1">
          {!item.is_available ? (
            <span className="text-xs text-muted-foreground">Habis</span>
          ) : (
            <>
              <Button
                size="icon"
                variant="outline"
                className="h-6 w-6"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-3 text-center text-xs font-medium">{qty}</span>
              <Button
                size="icon"
                variant="outline"
                className="h-6 w-6"
                onClick={() => setQty((q) => q + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                className="ml-auto h-6 w-6 bg-accent text-accent-foreground hover:bg-accent/90"
                aria-label={`Tambah ${item.name} ke keranjang`}
                onClick={handleAddToCart}
              >
                <ShoppingBag className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
