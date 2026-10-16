"use client";

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
} from "lucide-react";
import { logoutAction } from "@/app/login/actions";

const navItems = [
  { href: "/admin/owner", label: "Ringkasan", icon: LayoutDashboard, exact: true },
  { href: "/admin/owner/penjualan", label: "Penjualan", icon: TrendingUp },
  { href: "/admin/owner/menu", label: "Menu & Produk", icon: Coffee },
  { href: "/admin/owner/kategori", label: "Kategori", icon: Tags },
  { href: "/admin/owner/supply", label: "Supply", icon: Package },
  { href: "/admin/owner/meja", label: "Meja", icon: Grid3x3 },
];

export function OwnerSidebar({ ownerName }: { ownerName?: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-dvh w-64 shrink-0 flex-col bg-primary text-primary-foreground">
      <div className="px-6 py-6">
        <span className="font-serif text-xl font-bold tracking-wide">
          BD Coffee
        </span>
        <p className="text-[11px] text-primary-foreground/50">
          Dashboard Owner
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
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
  );
}