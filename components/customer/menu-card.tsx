"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ImageOff } from "lucide-react";

export type MenuCardItem = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  is_available: boolean;
  /** Id kategori untuk filter dua tingkat (Minuman / Makanan -> sub-kategori). */
  category_id: string | null;
  category_name: string | null;
};

/**
 * Kartu katalog: gambar + nama saja.
 *
 * Tidak ada harga, tombol jumlah, atau pilihan cepat di sini. Semua itu ada
 * di halaman detail `/menu/[id]`, yang jadi satu-satunya jalan untuk menambah
 * ke keranjang. Katalog ini untuk melihat-lihat, bukan untuk memilih.
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
    <Link
      href={href}
      className="group block overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
    >
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