import Image from "next/image";
import Link from "next/link";
import { Clock, MapPin, MessageCircle } from "lucide-react";
import { PUSAT_SLUG } from "@/lib/outlet-routes";
import {
  sitePageLinks,
  SITE_ADDRESS,
  SITE_HOURS,
  SITE_WA,
} from "@/lib/site-links";

/**
 * Footer halaman depan BD Cafe.
 *
 * Isinya hanya tautan HALAMAN UTAMA yang sama dengan navbar (satu sumber di
 * lib/site-links.ts). Tautan sistem (kasir, dashboard owner, halaman order)
 * sengaja tidak ada di sini — footer ini area pelanggan, bukan staf.
 *
 * Halaman yang belum dibangun tampil sebagai teks kusam, senada dengan
 * perilaku navbar. Nanti begitu halamannya jadi, cukup isi `href`-nya di
 * lib/site-links.ts dan footer ini otomatis ikut jadi link.
 *
 * Tema visual: gelap senada hero (`bg-primary`), aksen emas, judul serif —
 * sama bahasanya dengan navbar dan sisi kiri hero.
 */
export function SiteFooter() {
  const links = sitePageLinks(PUSAT_SLUG);
  const year = new Date().getFullYear();

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 sm:px-10 lg:grid-cols-4 lg:px-16">
        {/* 1) Merek + slogon + tombol WhatsApp (menggantikan kolom ringkas) */}
        <div className="sm:col-span-2">
          <Image
            src="/logo-hero-white.png"
            alt="BD Cafe"
            width={200}
            height={80}
            className="h-14 w-auto object-contain"
          />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-primary-foreground/70">
            Kopi, <span className="italic text-accent">Kenyamanan</span>, Cita
            Rasa. Racikan kopi pilihan, suasana hangat, dan pelayanan yang
            bikin betah — <span className="italic">dine-in</span> atau bawa
            pulang, sama nikmatnya.
          </p>
          <a
            href={SITE_WA.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center rounded-full border border-accent/60 px-4 py-2 text-sm text-white transition-colors duration-200 hover:bg-accent hover:text-accent-foreground"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            {SITE_WA.display}
          </a>
        </div>

        {/* 2) Jelajahi — delapan halaman utama, dua kolom sempit */}
        <nav aria-label="Tautan footer">
          <p className="font-serif text-lg font-semibold text-white">
            Jelajahi
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5">
            {links.map((link) => (
              <li key={link.label}>
                {link.href ? (
                  <Link
                    href={link.href}
                    className="text-sm text-primary-foreground/70 transition-colors hover:text-accent"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <span
                    className="text-sm text-primary-foreground/40"
                    title="Halaman menyusul"
                  >
                    {link.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* 3) Jam & Kontak — info fisik kedai */}
        <div>
          <p className="font-serif text-lg font-semibold text-white">
            Jam &amp; Kontak
          </p>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-primary-foreground/70">
            <li className="flex gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent/70" />
              {SITE_HOURS}
            </li>
            <li className="flex gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent/70" />
              {SITE_ADDRESS}
            </li>
          </ul>
        </div>
      </div>

      {/* Batang bawah: hak cipta */}
      <div className="border-t border-white/10 bg-black/20">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-1 px-6 py-5 text-xs text-primary-foreground/50 sm:flex-row sm:px-10 lg:px-16">
          <p>
            © {year} BD Cafe — Kopi, Kenyamanan, Cita Rasa.
          </p>
          <p>Batam, Indonesia</p>
        </div>
      </div>
    </footer>
  );
}
