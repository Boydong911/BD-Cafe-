"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check, ImageOff, Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart, type SelectedCustomization } from "@/lib/cart/cart-context";
import type { CustomizationGroup } from "@/types/menu";

type DetailItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  category_name: string | null;
};

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export function MenuDetail({
  item,
  groups,
  backHref,
}: {
  item: DetailItem;
  groups: CustomizationGroup[];
  backHref: string;
}) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  // selected[namaGrup] = label pilihan (atau null kalau tidak memilih).
  // Pilihan pertama otomatis terpilih HANYA kalau harganya Rp 0 (mis. "Normal").
  const [selected, setSelected] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    for (const g of groups) {
      const first = g.options[0];
      initial[g.name] = first && first.price_delta === 0 ? first.label : null;
    }
    return initial;
  });

  const customizations: SelectedCustomization[] = useMemo(() => {
    const result: SelectedCustomization[] = [];
    for (const g of groups) {
      const label = selected[g.name];
      const opt = g.options.find((o) => o.label === label);
      if (opt) {
        result.push({ name: g.name, label: opt.label, price_delta: opt.price_delta });
      }
    }
    return result;
  }, [groups, selected]);

  const unitPrice =
    item.price + customizations.reduce((sum, c) => sum + c.price_delta, 0);

  // Satu pilihan per grup; klik ulang pilihan yang sama = batalkan
  const togglePick = (groupName: string, label: string) => {
    setSelected((prev) => ({
      ...prev,
      [groupName]: prev[groupName] === label ? null : label,
    }));
  };

  const handleAdd = () => {
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
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke menu
      </Link>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
          {item.image_url ? (
            <Image
              src={item.image_url}
              alt={item.name}
              fill
              priority
              sizes="(max-width: 640px) 100vw, 50vw"
              className={`object-cover ${item.is_available ? "" : "grayscale"}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageOff className="h-10 w-10" />
            </div>
          )}
          {!item.is_available && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Badge variant="destructive">Stok Habis</Badge>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            {item.category_name && (
              <Badge variant="secondary">{item.category_name}</Badge>
            )}
            <h1 className="text-2xl font-bold leading-tight">{item.name}</h1>
            <p className="text-xl font-semibold">{rupiah(item.price)}</p>
            {item.description && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            )}
          </div>

          {groups.map((group) => (
            <fieldset key={group.name} className="space-y-2">
              <legend className="font-sans text-sm font-semibold">
                {group.name}
              </legend>
              <div className="flex flex-wrap gap-2">
                {group.options.map((opt) => {
                  const active = selected[group.name] === opt.label;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      disabled={!item.is_available}
                      onClick={() => togglePick(group.name, opt.label)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      {opt.label}
                      {opt.price_delta > 0 && (
                        <span className="ml-1.5 text-xs opacity-80">
                          +{rupiah(opt.price_delta)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </div>

      {/* Bar aksi menempel di bawah layar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 p-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9"
              disabled={!item.is_available}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-6 text-center font-medium">{qty}</span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9"
              disabled={!item.is_available}
              onClick={() => setQty((q) => q + 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <Button
            type="button"
            size="lg"
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={!item.is_available}
            onClick={handleAdd}
          >
            {!item.is_available ? (
              "Stok habis"
            ) : added ? (
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4" /> Ditambahkan
              </span>
            ) : (
              `Tambah · ${rupiah(unitPrice * qty)}`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}