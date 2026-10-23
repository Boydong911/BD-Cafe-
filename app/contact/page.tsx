import type { Metadata } from "next";
import { MapPin, Clock, MessageCircle, ExternalLink } from "lucide-react";
import { PageShell } from "@/components/customer/page-shell";
import { SITE_ADDRESS, SITE_HOURS, SITE_WA } from "@/lib/site-links";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Hubungi BD Cafe: alamat, jam buka, dan WhatsApp untuk bertanya sebelum mampir.",
};

/** Link pencarian Google Maps memakai alamat yang sama dengan sumber sentral. */
const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `BD Cafe ${SITE_ADDRESS}`
)}`;

export default function ContactPage() {
  return (
    <PageShell
      eyebrow="Kabari Kami"
      title="Contact"
      subtitle="Ada yang mau ditanyakan sebelum mampir? WhatsApp dibuka lebih dulu."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Daftar kontak */}
        <ul className="space-y-6 rounded-2xl border bg-card p-6 sm:p-8">
          <li className="flex gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <MapPin className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Alamat</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {SITE_ADDRESS}
              </p>
            </div>
          </li>

          <li className="flex gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Clock className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Jam Buka</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {SITE_HOURS}
              </p>
            </div>
          </li>

          <li className="flex gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">WhatsApp</p>
              <a
                href={SITE_WA.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-sm text-muted-foreground underline decoration-dotted underline-offset-4 transition hover:text-foreground"
              >
                {SITE_WA.display}
              </a>
            </div>
          </li>
        </ul>

        {/* Kartu Google Maps */}
        <div className="flex flex-col justify-between rounded-2xl border bg-card p-6 sm:p-8">
          <div>
            <h2 className="font-serif text-xl font-bold">Mampir langsung?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Lokasi kami sudah terdaftar di Google Maps. Cari{" "}
              <span className="font-medium text-foreground">&quot;BD Cafe&quot;</span>{" "}
              atau buka langsung lewat tombol di bawah.
            </p>
          </div>
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Buka di Google Maps
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </PageShell>
  );
}
