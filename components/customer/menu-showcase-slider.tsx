"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export type ShowcaseMenuItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  tag: string;
  imageUrl: string | null;
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);

export function MenuShowcaseSlider({ items }: { items: ShowcaseMenuItem[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, 3200);
    return () => clearInterval(timer);
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="flex aspect-[3/4] w-full max-w-[280px] items-center justify-center rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5">
        <p className="font-serif italic text-primary-foreground/50">
          Menu segera hadir...
        </p>
      </div>
    );
  }

  const current = items[index];

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="relative aspect-[3/4] w-full max-w-[280px] overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-[#2a170d] to-[#160c06] shadow-2xl shadow-black/30">
        {current.imageUrl ? (
          <Image
            src={current.imageUrl}
            alt={current.name}
            fill
            className="object-cover"
          />
        ) : null}

        {/* Overlay gelap — biar teks tetap terbaca di atas foto asli nanti */}
        <div className="absolute inset-0 bg-black/35" />

        <div
          key={current.id}
          className="absolute inset-0 flex animate-in flex-col items-center justify-center gap-3 px-6 text-center duration-500 fade-in"
        >
          <span className="rounded-full border border-accent/50 bg-accent/15 px-3 py-1 text-white text-[10px] font-semibold uppercase tracking-[0.2em] text-accent backdrop-blur-sm">
            {current.tag}
          </span>
          <h3 className="font-serif text-2xl italic text-white sm:text-3xl">
            {current.name}
          </h3>
          <p className="text-[11px] uppercase tracking-[0.15em] text-white/60">
            {current.category}
          </p>
            <p className="text-lg font-bold text-white">
            {formatPrice(current.price)}
          </p>
        </div>
      </div>

      <div className="flex gap-1.5">
        {items.map((item, i) => (
          <span
            key={item.id}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === index ? "w-6 bg-accent" : "w-1.5 bg-primary-foreground/20"
            )}
          />
        ))}
      </div>
    </div>
  );
}