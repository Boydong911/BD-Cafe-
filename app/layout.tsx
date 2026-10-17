import type { Metadata } from "next";
import { Lora, Plus_Jakarta_Sans } from "next/font/google";
import "@/app/globals.css";
import { CartProvider } from "@/lib/cart/cart-context";

const fontHeading = Lora({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const fontBody = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  /*
   * `template` dipakai supaya tiap halaman cukup menulis judul singkatnya
   * saja (`export const metadata = { title: "Kasir" }`) dan hasilnya
   * otomatis menjadi "Kasir-BD Cafe".
   *
   * Tanpa template ini, tiap halaman harus menulis ulang nama cafe
   * sendiri -- dan tadi semua tab browser cuma menampilkan "BD Coffee".
   */
  title: {
    default: "BD Cafe",
    template: "%s-BD Cafe",
  },
  description: "Cafe premium — kopi, kenyamanan, cita rasa.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${fontHeading.variable} ${fontBody.variable}`}>
      <body className="font-sans antialiased">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}