"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageOff, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart/cart-context";

export type MenuCardItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  category_name: string | null;
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

  const href = tableParam
    ? `/menu/${item.id}?table=${tableParam}`
    : `/menu/${item.id}`;

  const handleAddToCart = () => {
    addItem(
      {
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.image_url,
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

      <div className="flex items-center justify-between gap-1.5 p-2.5 pt-0">
        <p className="text-sm font-semibold">Rp {item.price.toLocaleString("id-ID")}</p>

        {item.is_available ? (
          <div className="flex items-center gap-1">
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
              className="h-6 w-6 bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handleAddToCart}
            >
              <ShoppingBag className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Habis</span>
        )}
      </div>
    </Card>
  );
}