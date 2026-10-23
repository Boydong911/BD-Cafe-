import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Kerangka visual semua pintu staf: login owner (/login), login kasir
 * ({slug}/login/kasir), dan pendaftaran ({slug}/daftar).
 *
 * Latar foto kedai yang digelapkan — resep sama dengan hero halaman depan —
 * logo putih di atas kartu form, plus tautan kecil kembali ke kedai.
 * Isi form tidak diubah di sini: komponen ini HANYA kulitnya.
 */
export function LoginShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-primary px-4 py-10">
      {/* Latar foto kedai + gelapkan, sama resepnya dengan hero */}
      <div className="absolute inset-0 bg-[url('/hero-bg.jpg')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-black/60" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        <Image
          src="/logo-hero-white.png"
          alt="BD Cafe"
          width={200}
          height={80}
          className="mb-8 h-16 w-auto object-contain"
          priority
        />
        {children}
        <Link
          href="/"
          className="mt-8 text-xs text-white/50 transition-colors hover:text-white"
        >
          ← Kembali ke kedai
        </Link>
      </div>
    </div>
  );
}
