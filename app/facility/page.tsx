import type { Metadata } from "next";
import { Wifi, Plug, Snowflake, Users, Music, Car } from "lucide-react";
import { PageShell } from "@/components/customer/page-shell";

export const metadata: Metadata = {
  title: "Facility",
  description:
    "Fasilitas BD Cafe: WiFi kencang, colokan nyaring, indoor ber-AC, ruang meeting, dan parkir luas.",
};

/*
 * Daftar fasilitas. Jam live acoustic & soal parkir ini masih dugaan —
 * tinggal dikoreksi kalau kenyataannya berbeda.
 */
const FACILITIES = [
  {
    icon: Wifi,
    title: "WiFi kencang",
    desc: "Koneksi stabil di seluruh area — aman buat meeting online, unduhan besar, atau maraton series.",
  },
  {
    icon: Plug,
    title: "Colokan nyaring",
    desc: "Hampir tiap meja punya colokan, jadi tidak ada laptop yang menyerah di tengah deadline.",
  },
  {
    icon: Snowflake,
    title: "Indoor ber-AC & outdoor",
    desc: "Mau dingin yang aman atau hangat sambil menikmati angin? Dua-duanya tersedia.",
  },
  {
    icon: Users,
    title: "Ruang meeting & komunitas",
    desc: "Meja panjang yang lega buat rapat kecil, kelas, atau kumpulan komunitas.",
  },
  {
    icon: Music,
    title: "Live acoustic akhir pekan",
    desc: "Sabtu & Minggu malam ada musik hidup yang menemani ngopi — santai didengar, ngobrol tetap nyaman.",
  },
  {
    icon: Car,
    title: "Parkir luas",
    desc: "Motor dan mobil lega dan aman, tidak perlu muter-muter nyari tempat.",
  },
];

export default function FacilityPage() {
  return (
    <PageShell
      eyebrow="Nyaman Di Sini"
      title="Facility"
      subtitle="Bukan cuma soal kopi — suasananya juga dibuat supaya betah tinggal lama."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FACILITIES.map((facility) => (
          <div
            key={facility.title}
            className="rounded-2xl border bg-card p-6"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
              <facility.icon className="h-5 w-5" />
            </span>
            <p className="mt-4 font-serif text-lg font-semibold">
              {facility.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {facility.desc}
            </p>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
