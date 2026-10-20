"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PUSAT_SLUG } from "@/lib/outlet-routes";

/*
 * Item nav. `href` kosong berarti belum ada tujuan -- sengaja tidak dibuat
 * halaman kosong untuk masing-masing, karena itu hanya menambah file tanpa
 * isi. Isi `href` begitu halaman untuk item tersebut dibuat.
 *
 * "Our Menu" mengikuti outlet halaman yang sedang dibuka: di /outlet-b
 * menuju /outlet-b/menu. Halaman tanpa konteks outlet (landing) memakai
 * outlet pusat.
 */
function navItems(outletSlug: string) {
  return [
    { label: "Home", href: "/" },
    { label: "About Us", href: "" },
    { label: "Our Menu", href: `/${outletSlug}/menu` },
    { label: "Our Outlet", href: "" },
    { label: "Facility", href: "" },
    { label: "Partnership", href: "" },
    { label: "Proposal", href: "" },
    { label: "Contact", href: "" },
  ];
}

/**
 * Navbar BD Cafe.
 *
 * Latar selalu hitam 80% (`bg-black/80`) dan logo selalu putih, jadi navbar
 * di halaman depan yang gelap dan di menu outlet yang terang tetap terbaca
 * tanpa filter apa pun pada logo.
 *
 * `overlay` hanya mengatur posisi: `true` menumpuk di atas foto hero
 * (halaman depan), `false` jadi bar sticky di atas konten (menu outlet).
 *
 * `outletSlug` menentukan tujuan link "Our Menu". Sekarang menu per outlet,
 * jadi di /outlet-b navbar harus bawa pelanggan ke menu outlet yang sama.
 */
export function SiteNav({
  overlay = false,
  outletSlug = PUSAT_SLUG,
}: {
  overlay?: boolean;
  outletSlug?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const NAV_ITEMS = navItems(outletSlug);

  /*
   * Item aktif mengikuti halaman yang sedang dibuka, bukan ditulis manual.
   * "/" hanya aktif di beranda; "/menu" juga aktif di halaman detailnya
   * (/menu/<id>) supaya item itu tetap emas waktu pelanggan membuka detail menu.
   */
  const isActive = (href: string) => {
    if (!href) return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const itemClass = (active: boolean) =>
    cn(
      "whitespace-nowrap text-sm font-medium text-white/85 transition-colors hover:text-white",
      active && "text-accent"
    );

  return (
    <header
      className={cn(
        "z-20 bg-black/80 backdrop-blur-sm",
        overlay ? "absolute inset-x-0 top-0" : "sticky top-0"
      )}
    >
      <div
        className={cn(
          "grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-4 lg:flex lg:justify-between lg:px-12"
        )}
      >
        {/* Desktop: logo di kiri */}
        <Link href="/" className="hidden shrink-0 lg:block">
          <Image
            src="/logo-hero-white.png"
            alt="BD Cafe"
            width={200}
            height={80}
            className="h-14 w-auto object-contain"
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
                className={itemClass(isActive(item.href))}
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
              className="h-11 w-auto object-contain"
              priority
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
        <nav className="border-t border-white/10 bg-black/90 px-5 py-3 text-white backdrop-blur lg:hidden">
          {NAV_ITEMS.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(itemClass(isActive(item.href)), "block py-2.5")}
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
