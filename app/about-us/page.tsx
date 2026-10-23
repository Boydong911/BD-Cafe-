import type { Metadata } from "next";
import { Coffee, Users, Wallet, HeartHandshake } from "lucide-react";
import { PageShell } from "@/components/customer/page-shell";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Cerita dan nilai yang kami pegang — kedai kopi yang serius soal rasa dan kenyamanan.",
};

/*
 * Empat nilai yang kami pegang. Isinya draf — silakan koreksi jika kalimatnya
 * kurang pas dengan kepribadian kedai.
 */
const VALUES = [
  {
    icon: Coffee,
    title: "Kopi yang diseriusin",
    desc: "Biji dipilih, takaran disetel, dan diseduh dengan cara yang sama setiap kali. Rasa yang konsisten itu wajib, bukan bonus.",
  },
  {
    icon: Users,
    title: "Ruang yang ramah",
    desc: "Ada meja panjang buat rombongan dan pojok tenang buat kerja. Semua orang punya tempat di sini.",
  },
  {
    icon: Wallet,
    title: "Harga yang jujur",
    desc: "Harga tertera di depan, tanpa biaya kejutan. Yang kamu bayar adalah rasa dan waktu yang nyaman.",
  },
  {
    icon: HeartHandshake,
    title: "Layanan yang hangat",
    desc: "Barista menyapa duluan dan hafal pesanan langganan. Kalau belum hafal, senyumnya tetap duluan.",
  },
];

export default function AboutUsPage() {
  return (
    <PageShell
      eyebrow="Cerita Kami"
      title="About Us"
      subtitle="Kenalan dulu — biar tiap tegukan terasa lebih dekat."
    >
      {/* Cerita singkat */}
      <section className="max-w-3xl space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
        <p>
          BD Cafe mulai dari satu kedai kecil dengan keyakinan sederhana:
          secangkir kopi enak itu bukan kemewahan — itu bagian dari hari yang
          layak didapat semua orang, dengan harga yang wajar.
        </p>
        <p>
          Kini kedai itu bertumbuh, outlet mulai bertambah, tapi prinsipnya
          tidak bergeser: racikan yang dirawat, ruang yang dijaga rapi, dan
          barista yang menyapa duluan. Datang sendiri, berdua, atau rombongan —
          semua kami tampung.
        </p>
      </section>

      {/* Nilai */}
      <section className="mt-12">
        <h2 className="font-serif text-2xl font-bold">Yang kami pegang</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((value) => (
            <div key={value.title} className="rounded-2xl border bg-card p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                <value.icon className="h-5 w-5" />
              </span>
              <p className="mt-4 font-serif text-lg font-semibold">
                {value.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {value.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
