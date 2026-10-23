import type { Metadata } from "next";
import { ShoppingBag, Calendar, Handshake, MessageCircle } from "lucide-react";
import { PageShell } from "@/components/customer/page-shell";
import { SITE_WA } from "@/lib/site-links";

export const metadata: Metadata = {
  title: "Partnership",
  description:
    "Kerja sama bersama BD Cafe: pesanan besar & katering, private event, sampai kolaborasi komunitas.",
};

/*
 * Tiga bentuk kerja sama yang paling sering diminta kedai kopi. Model lain
 * tetap boleh dicetuskan calon partner lewat WhatsApp.
 */
const MODES = [
  {
    icon: ShoppingBag,
    title: "Pesanan besar & katering",
    desc: "Izin bawa puluhan cup? Acara kantor, kampus, atau hajatan keluarga bisa kami siapkan jadi satu paket.",
  },
  {
    icon: Calendar,
    title: "Private event & reservasi area",
    desc: "Ulang tahun, arisan, atau launching produk — reservasi areanya, sisanya biar kami urus.",
  },
  {
    icon: Handshake,
    title: "Kolaborasi merek & komunitas",
    desc: "Kreator, komunitas ngopi, atau brand lokal: live acoustic, pop-up, sampai giveaway bareng.",
  },
];

export default function PartnershipPage() {
  return (
    <PageShell
      eyebrow="Sama-Sama"
      title="Partnership"
      subtitle="Kami senang diajak kerja sama — dari pesanan besar sampai acara yang seru."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODES.map((mode) => (
          <div key={mode.title} className="rounded-2xl border bg-card p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
              <mode.icon className="h-5 w-5" />
            </span>
            <p className="mt-4 font-serif text-lg font-semibold">{mode.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {mode.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Batu loncatan ke WhatsApp */}
      <div className="mt-10 rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8">
        <h2 className="font-serif text-xl font-bold sm:text-2xl">
          Mau mulai ngobrol?
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-primary-foreground/70">
          Ceritakan kebutuhanmu lewat WhatsApp — tim kami balas di jam
          operasional. Untuk pengajuan berdokumen, lanjut ke halaman Proposal.
        </p>
        <a
          href={SITE_WA.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-accent/60 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          {SITE_WA.display}
        </a>
      </div>
    </PageShell>
  );
}
