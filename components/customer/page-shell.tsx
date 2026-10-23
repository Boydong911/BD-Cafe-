import type { ReactNode } from "react";
import { SiteNav } from "@/components/customer/site-nav";
import { SiteFooter } from "@/components/customer/site-footer";

/**
 * Kerangka seragam untuk halaman-halaman utama BD Cafe (About Us, Facility,
 * Partnership, dst.): navbar di atas, spanduk judul gelap senada hero
 * halaman depan, area isi terang, lalu footer di kaki halaman.
 *
 * Navbar & footer di sini memakai outlet pusat — halaman-halaman ini tidak
 * punya konteks outlet di URL, sama seperti perilaku halaman depan.
 */
export function PageShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  /** Kata kecil di atas judul, mis. "Cerita Kami". */
  eyebrow?: string;
  title: string;
  /** Kalimat pembuka di bawah judul. */
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteNav />

      {/* Spanduk judul gelap — senada sisi kiri hero halaman depan */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-6 py-12 sm:px-10 lg:px-16">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-primary-foreground/70 sm:text-base">
              {subtitle}
            </p>
          )}
        </div>
      </section>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10 sm:px-10 sm:py-14 lg:px-16">
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}
