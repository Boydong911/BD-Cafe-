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

export function LandingNav() {
  const [open, setOpen] = useState(false);

  const itemClass = (active: boolean) =>
    cn(
      "text-sm font-medium transition-colors",
      active ? "text-accent" : "text-white/85 hover:text-white"
    );

  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-4 lg:flex lg:justify-between lg:px-12">
        {/* Desktop: logo di kiri */}
        <Link href="/" className="hidden shrink-0 lg:block">
          <Image
            src="/logo-hero-white.png"
            alt="BD Coffee"
            width={120}
            height={48}
            className="h-10 w-auto object-contain"
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
              alt="BD Coffee"
              width={120}
              height={48}
              className="h-9 w-auto object-contain"
            />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Tutup menu" : "Buka menu"}
            aria-expanded={open}
            className="justify-self-end rounded-md p-2 text-white transition-colors hover:bg-white/10"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-white/10 bg-black/80 px-5 py-3 backdrop-blur lg:hidden">
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