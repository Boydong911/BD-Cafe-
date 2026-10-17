"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/lib/cart/cart-context";
import { CartItemList, formatPrice } from "@/components/customer/cart-items";

export function CartSheet() {
  const { items, totalItems, totalPrice, session, setManualSession, setCustomerName } =
    useCart();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-black/30 hover:bg-primary/90"
        >
          <ShoppingCart className="h-6 w-6" />
          {totalItems > 0 && (
            <span
              className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6
              items-center justify-center rounded-full border-2
              border-background bg-red-600 px-1 text-xs font-bold
              leading-none text-white"
            >
              {totalItems}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className="flex w-full flex-col gap-0 border-l border-primary/30 bg-primary/75 p-0 text-primary-foreground backdrop-blur-md sm:max-w-md">
        <SheetHeader className="space-y-0.5 border-b border-white/10 px-6 py-5">
          <SheetTitle className="font-serif text-xl text-primary-foreground">
            Keranjang Kamu
          </SheetTitle>
          <p className="text-xs text-primary-foreground/60">
            {totalItems > 0 ? `${totalItems} item dipilih` : "Belum ada item"}
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <CartItemList />
        </div>

        <div className="space-y-3 border-t border-white/10 px-6 py-4">
          {/* Pesanan Atas Nama — di atas blok meja */}
          <div className="space-y-1.5">
            <label
              htmlFor="cart-customer-name"
              className="text-xs font-medium text-primary-foreground/70"
            >
              Pesanan Atas Nama
            </label>
            <Input
              id="cart-customer-name"
              value={session.customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nama yang mau dipanggil, mis. Budi"
              className="border-white/30 bg-white/10 text-primary-foreground placeholder:text-primary-foreground/40"
            />
          </div>

          {session.isScanned ? (
            <p className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium">
              🪑 Meja Nomor <span className="font-bold">{session.tableNumber}</span>
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setManualSession({ orderType: "dine_in", tableNumber: session.tableNumber })
                  }
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                    session.orderType === "dine_in"
                      ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-white/20"
                      : "bg-accent/40 text-primary-foreground/70 hover:bg-accent/55"
                  }`}
                >
                  {session.orderType === "dine_in" ? "Dine In" : "Dine In?"}
                </button>
                <button
                  type="button"
                  onClick={() => setManualSession({ orderType: "takeaway", tableNumber: null })}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                    session.orderType === "takeaway"
                      ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-white/20"
                      : "bg-accent/40 text-primary-foreground/70 hover:bg-accent/55"
                  }`}
                >
                  {session.orderType === "takeaway" ? "Take Away" : "Take Away?"}
                </button>
              </div>
              {session.orderType === "dine_in" && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="cart-table-number"
                    className="text-xs font-medium text-primary-foreground/70"
                  >
                    Nomor Meja
                  </label>
                  <Input
                    id="cart-table-number"
                    placeholder="Contoh: 02 — atau scan QR meja di meja"
                    value={session.tableNumber ?? ""}
                    onChange={(e) =>
                      setManualSession({ orderType: "dine_in", tableNumber: e.target.value })
                    }
                    className="border-white/30 bg-white/10 text-primary-foreground placeholder:text-primary-foreground/40"
                  />
                </div>
              )}
            </>
          )}
        </div>

        <SheetFooter className="flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-col">
          <div className="flex items-center justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatPrice(totalPrice)}</span>
          </div>
          <Button
            asChild
            size="lg"
            disabled={items.length === 0}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Link href="/checkout">Lanjut ke Checkout</Link>
          </Button>

          {/*
            Tutup keranjang tanpa pindah halaman. Tetap berguna karena setelah
            memilih Dine In / Take Away atau mengisi nomor meja, kebanyakan orang masih
            ingin balik lihat-lihat menu dulu sebelum checkout.
          */}
          <SheetClose asChild>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full border-white/30 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
            >
              Tutup
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}