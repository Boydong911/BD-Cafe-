import type { Metadata } from "next";
import { Lora, Plus_Jakarta_Sans } from "next/font/google";
import "@/app/globals.css";
import { CartProvider } from "@/lib/cart/cart-context";
import { SITE_NAME, TITLE_TEMPLATE } from "@/lib/page-title";

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
   * otomatis menjadi "Kasir - BD Cafe".
   *
   * Tanpa template ini, tiap halaman harus menulis ulang nama cafe
   * sendiri -- dan tadi semua tab browser cuma menampilkan "BD Cafe".
   */
  title: {
    default: SITE_NAME,
    template: TITLE_TEMPLATE,
  },
  description:
    "Kedai kopi BD Cafe di Batam — racikan kopi pilihan, suasana hangat, dan pelayanan yang bikin betah. Dine-in atau bawa pulang, sama nikmatnya.",
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