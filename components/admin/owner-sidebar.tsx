"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  TrendingUp,
  Coffee,
  Package,
  Grid3x3,
  Settings,
  LogOut,
  Tags,
  Users,
  Menu,
  X,
} from "lucide-react";
import { logoutAction } from "@/app/login/actions";

const navItems = [
  { href: "/admin/owner", label: "Ringkasan", icon: LayoutDashboard, exact: true },
  { href: "/admin/owner/penjualan", label: "Penjualan", icon: TrendingUp },
  { href: "/admin/owner/menu", label: "Menu & Produk", icon: Coffee },
  { href: "/admin/owner/kategori", label: "Kategori", icon: Tags },
  { href: "/admin/owner/supply", label: "Supply", icon: Package },
  { href: "/admin/owner/meja", label: "Meja", icon: Grid3x3 },
  { href: "/admin/owner/karyawan", label: "Karyawan", icon: Users },
];

/**
 * Sidebar dashboard owner.
 *
 * Di layar kecil sidebar jadi drawer (tombol hamburger di header), karena
 * `w-64` selalu akan memakan sebagian layar HP. Konten drawernya dipisah ke
 * komponen terpisah supaya tidak diduplikasi dua kali.
 */
export function OwnerSidebar({ ownerName }: { ownerName?: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Tutup drawer setiap kali pindah halaman — kalau tidak, drawer tetap
  // menutupi konten setelah owner menekan link.
  const isOpen = open && pathname.length > 0;

  return (
    <>
      {/* Tombol hamburger — hanya muncul di mobile */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buka menu navigasi"
        className="fixed left-3 top-3 z-40 rounded-lg bg-primary p-2 text-primary-foreground shadow-md lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay gelap saat drawer terbuka */}
      {isOpen && (
        <button
          type="button"
          aria-label="Tutup menu navigasi"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      {/* Drawer di mobile, sidebar tetap di desktop */}
      <aside
        className={cn(
          "flex shrink-0 flex-col bg-primary text-primary-foreground",
          // mobile: drawer yang muncul dari kiri
          "fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-start justify-between px-6 py-6">
          <div>
            <span className="font-serif text-xl font-bold tracking-wide">
              BD Coffee
            </span>
            <p className="text-[11px] text-primary-foreground/50">
              Dashboard Owner
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
            className="-mr-2 rounded-lg p-1.5 text-primary-foreground/70 hover:bg-white/10 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-primary-foreground/70 hover:bg-white/10 hover:text-primary-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-white/10 px-3 py-4">
          <Link
            href="/admin/owner/pengaturan"
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname.startsWith("/admin/owner/pengaturan")
                ? "bg-accent text-accent-foreground"
                : "text-primary-foreground/70 hover:bg-white/10 hover:text-primary-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
            Pengaturan
          </Link>

          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-primary-foreground/70 transition-colors hover:bg-white/10 hover:text-primary-foreground"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </form>

          {ownerName && (
            <p className="px-3 pt-3 text-xs text-primary-foreground/40">
              Masuk sebagai{" "}
              <span className="font-medium text-primary-foreground/60">
                {ownerName}
              </span>
            </p>
          )}
        </div>
      </aside>
    </>
  );
}