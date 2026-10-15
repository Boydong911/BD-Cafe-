"use client";

import Link from "next/link";
import { ShoppingCart, Minus, Plus, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/lib/cart/cart-context";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);

export function CartSheet() {
  const { items, updateQuantity, removeItem, totalItems, totalPrice, session, setManualSession, setCustomerName } =
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

        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <p className="text-center text-sm text-primary-foreground/60">
              Keranjang masih kosong, yuk pilih menu dulu!
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
            {items.map((item) => (
              <div
                key={item.lineId}
                className="flex items-start justify-between gap-3 border-b border-white/10 pb-3"
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold">{item.name}</p>
                  {item.customizations.length > 0 ? (
                    <p className="text-xs text-primary-foreground/70">
                      {item.customizations.map((c) => c.label).join(" · ")}
                    </p>
                  ) : (
                    item.description && (
                      <p className="line-clamp-1 text-xs text-primary-foreground/50">
                        {item.description}
                      </p>
                    )
                  )}
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-xs text-primary-foreground/70">
                      {formatPrice(item.price)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-5 w-5 border-white/30 bg-transparent text-primary-foreground hover:bg-white/10"
                        onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                      >
                        <Minus className="h-2.5 w-2.5" />
                      </Button>
                      <span className="w-4 text-center text-xs font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-5 w-5 border-white/30 bg-transparent text-primary-foreground hover:bg-white/10"
                        onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                      >
                        <Plus className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <p className="text-sm font-semibold">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                  <button
                    onClick={() => removeItem(item.lineId)}
                    className="text-primary-foreground/50 transition-colors hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}