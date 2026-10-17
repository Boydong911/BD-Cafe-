"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Item nav. `href` kosong berarti belum ada tujuan -- sengaja tidak dibuat
 * halaman kosong untuk masing-masing, karena itu hanya menambah file tanpa
 * isi. Isi `href` begitu halaman untuk item tersebut dibuat.
 */
const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "" },
  { label: "Our Menu", href: "/menu" },
  { label: "Our Outlet", href: "" },
  { label: "Facility", href: "" },
  { label: "Partnership", href: "" },
  { label: "Proposal", href: "" },
  { label: "Contact", href: "" },
];

/**
 * Navbar BD Cafe.
 *
 * `overlay` dipakai di halaman depan: menumpuk di atas foto hero yang gelap,
 * jadi teksnya putih dan posisinya absolute. Tanpa `overlay` (dipakai di
 * /menu) navbar jadi bar biasa di atas konten, dengan teks gelap dan garis
 * bawah.
 */
export function SiteNav({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);

  const itemClass = (active: boolean) =>
    cn(
      "text-sm font-medium transition-colors",
      overlay
        ? active
          ? "text-accent"
          : "text-white/85 hover:text-white"
        : active
          ? "text-primary"
          : "text-foreground/70 hover:text-foreground",
      "whitespace-nowrap"
    );

  return (
    <header
      className={cn(
        "z-20",
        overlay ? "absolute inset-x-0 top-0" : "sticky top-0 border-b bg-background/95 backdrop-blur"
      )}
    >
      <div
        className={cn(
          "grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 lg:flex lg:justify-between lg:px-12",
          overlay ? "py-4" : "py-3"
        )}
      >
        {/* Desktop: logo di kiri */}
        <Link href="/" className="hidden shrink-0 lg:block">
          <Image
            src="/logo-hero-white.png"
            alt="BD Cafe"
            width={200}
            height={80}
            className={cn("w-auto object-contain", overlay ? "h-14" : "h-12 brightness-0 invert")}
            priority
          />
        </Link>

        {/* Desktop: nav di kanan */}
        <nav className="hidden items-center gap-6 lg:flex">
          {NAV_ITEMS.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className={itemClass(item.href === "/menu")}
              >
                {item.label}
              </Link>
            ) : (
              <span key={item.label} className={cn(itemClass(false), "cursor-default")}>
                {item.label}
              </span>
            )
          )}
        </nav>

        {/* Mobile: logo di tengah, hamburger di kanan */}
        <div className="contents lg:hidden">
          <span />
          <Link href="/" className="justify-self-center">
            <Image
              src="/logo-hero-white.png"
              alt="BD Cafe"
              width={200}
              height={80}
              className={cn("w-auto object-contain", overlay ? "h-11" : "h-10 brightness-0 invert")}
              priority
            />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Tutup menu" : "Buka menu"}
            aria-expanded={open}
            className={cn(
              "justify-self-end rounded-md p-2 transition-colors",
              overlay ? "text-white hover:bg-white/10" : "hover:bg-muted"
            )}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          className={cn(
            "border-t px-5 py-3 lg:hidden",
            overlay ? "border-white/10 bg-black/80 text-white backdrop-blur" : "bg-background"
          )}
        >
          {NAV_ITEMS.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(itemClass(item.href === "/menu"), "block py-2.5")}
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.label}
                className={cn(itemClass(false), "block cursor-default py-2.5")}
              >
                {item.label}
              </span>
            )
          )}
        </nav>
      )}
    </header>
  );
}