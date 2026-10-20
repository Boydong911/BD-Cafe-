import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PUSAT_SLUG } from "@/lib/outlet-routes";

/*
 * 404 global.
 *
 * Kebanyakan kasus 404 kini: slug outlet di URL tidak dikenal — biasanya
 * QR yang salah ketik atau outlet yang telah diarsipkan (slug lama mereka
 * tetap tidak tersedia). Karena itu pesannya menunjuk dua pintu yang jelas:
 * halaman muka dan menu outlet pusat.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <Image
        src="/LOGO.png"
        alt="BD Cafe"
        width={96}
        height={96}
        priority
        className="h-20 w-20 object-contain sm:h-24 sm:w-24"
      />
      <h1 className="font-serif text-2xl font-bold">
        Halaman tidak dikenal &mdash; 404
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Alamat atau outlet yang kamu buka tidak ditemukan. Coba scan ulang QR
        meja, atau langsung ke menu outlet pusat di bawah.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/">Kembali ke Beranda</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/${PUSAT_SLUG}/menu`}>Menu Outlet A (Pusat)</Link>
        </Button>
      </div>
    </div>
  );
}
