import type { Metadata } from "next";
import { Send } from "lucide-react";
import { PageShell } from "@/components/customer/page-shell";
import { SITE_WA } from "@/lib/site-links";

export const metadata: Metadata = { title: "Proposal - BD Cafe" };

/** WhatsApp dengan pesan awal yang sudah terisi, biar nggak kosong. */
const waProposalHref = `${SITE_WA.url}?text=${encodeURIComponent(
  "Hai BD Cafe, aku mau mengajukan proposal kerja sama."
)}`;

const STEPS = [
  {
    title: "Sapa dulu lewat WhatsApp",
    desc: "Ceritakan singkat siapa kamu dan bentuk kerja sama apa yang kamu bayangkan.",
  },
  {
    title: "Kirim proposal lengkap",
    desc: "Sertakan rencana acara atau pesanan, tanggal, estimasi jumlah orang, dan kebutuhan khusus — boleh PDF atau dokumen apa pun yang gampang dibuka.",
  },
  {
    title: "Diskusi & kesepakatan",
    desc: "Tim kami balas di jam operasional untuk menyamakan harga, jadwal, dan pembagian tugas.",
  },
  {
    title: "Hari-H, kita jalankan bareng",
    desc: "Datang dan jalankan rencananya bersama kami. Setelah acara, masukanmu selalu ditunggu untuk acara berikutnya.",
  },
];

export default function ProposalPage() {
  return (
    <PageShell
      eyebrow="Ajukan"
      title="Proposal"
      subtitle="Punya ide kerja sama yang sudah matang? Ikuti alur pengajuan berikut."
    >
      {/* Alur pengajuan */}
      <ol className="max-w-3xl space-y-4">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="flex gap-4 rounded-2xl border bg-card p-5 sm:p-6"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 font-serif text-sm font-bold text-accent">
              {index + 1}
            </span>
            <div>
              <p className="font-serif text-lg font-semibold">{step.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {step.desc}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* Batu loncatan ke WhatsApp (pesan awal sudah terisi) */}
      <div className="mt-10 rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8">
        <h2 className="font-serif text-xl font-bold sm:text-2xl">
          Siap mengajukan?
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-primary-foreground/70">
          Klik tombol di bawah — pesan awalnya sudah terisi, tinggal tambahkan
          ceritamu dan lampirkan dokumennya.
        </p>
        <a
          href={waProposalHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-accent/60 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Send className="h-4 w-4" />
          Ajukan lewat WhatsApp
        </a>
      </div>
    </PageShell>
  );
}
