import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  MenuShowcaseSlider,
  type ShowcaseMenuItem,
} from "@/components/customer/menu-showcase-slider";

export function HeroSection({ menuItems }: { menuItems: ShowcaseMenuItem[] }) {
  return (
    <section className="relative flex min-h-dvh flex-col overflow-hidden bg-primary lg:h-screen lg:flex-row">
      {/* Background foto */}
      <div className="absolute inset-0 bg-[url('/hero-bg.jpg')] bg-cover bg-center" />
      {/* Overlay gelap — dipekatin biar teks putih tetap kebaca di background terang manapun */}
      {/* Overlay gelap — dipekatin biar teks putih tetap kebaca di background terang manapun */}
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />

      {/* KIRI — Logo, judul, deskripsi, info */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-6 py-16 sm:px-10 lg:px-16">
        <Image
          src="/logo-hero-white.png"
          alt="BD Coffee"
          width={200}
          height={80}
          className="mb-6 h-auto w-44 object-contain sm:w-52"
          priority
        />

        <h1 className="font-serif text-4xl leading-[1.1] text-white sm:text-5xl lg:text-6xl">
          Kopi, <span className="italic text-accent">Kenyamanan</span>,
          <br />
          <span className="font-bold">Cita Rasa.</span>
        </h1>

        <p className="mt-6 max-w-md text-base leading-relaxed text-white/75 sm:text-lg">
          Racikan kopi pilihan, suasana hangat, dan pelayanan yang bikin betah
          — <span className="italic">dine-in</span> atau bawa pulang, sama
          nikmatnya.
        </p>

        <div className="mt-10 space-y-3 text-sm text-white/70">
          <p>
            <span className="font-semibold uppercase tracking-wide text-white/90">
              Alamat —
            </span>{" "}
            Jl. Ngopi Dulu No. 7, Sebelah Toko yang Tutup, Batam
          </p>
          <p className="flex flex-wrap items-center gap-x-1">
            <span className="font-semibold uppercase tracking-wide text-white/90">
              WhatsApp —
            </span>
            
              <a href="https://wa.me/6289571153695"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-accent/60 px-2.5 py-0.5 text-white transition-colors duration-200 hover:bg-accent hover:text-accent-foreground"
            >
              0895-7115-3695
            </a>
          </p>
        </div>
      </div>

      {/* KANAN — Kartu foto menu (3:4) */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12 lg:px-16">
        <MenuShowcaseSlider items={menuItems} />

        <Button
          asChild
          size="lg"
          className="border-2 border-white bg-transparent text-white transition-colors duration-200 hover:bg-white hover:text-black"
        >
          <Link href="/menu">Lihat menunya disini yee! →</Link>
        </Button>
      </div>
    </section>
  );
}