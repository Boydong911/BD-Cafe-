import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { PageShell } from "@/components/customer/page-shell";
import { fetchOutlets, type OutletRow } from "@/lib/outlets";
import { outletMenuHref } from "@/lib/outlet-routes";
import { formatWibDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Our Outlet",
  description:
    "Daftar outlet BD Cafe — pilih outlet terdekat dan langsung lihat menunya.",
};
export const revalidate = 0; // daftar outlet selalu termutakhirkan

const MENU_MODE_LABEL: Record<OutletRow["menu_mode"], string> = {
  salinan: "Menu Salinan",
  sendiri: "Menu Sendiri",
};

export default async function OurOutletPage() {
  const outlets = await fetchOutlets();

  return (
    <PageShell
      eyebrow="Temukan Kami"
      title="Our Outlet"
      subtitle="Dari kedai pusat, jaringan kami tumbuh. Pilih outlet, langsung menuju menunya."
    >
      {outlets.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-serif text-lg font-semibold">
            Daftar outlet menyusul.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Belum ada outlet terdaftar — kartu akan muncul di sini begitu ada.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {outlets.map((outlet) => (
            <div
              key={outlet.id}
              className="flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-serif text-xl font-semibold">
                  {outlet.nama}
                </h2>
                {outlet.is_pusat && (
                  <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
                    Pusat
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border px-2.5 py-0.5">
                  {MENU_MODE_LABEL[outlet.menu_mode]}
                </span>
                {outlet.tanggal_bangun && (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5">
                    <CalendarDays className="h-3.5 w-3.5 text-accent/70" />
                    {formatWibDate(outlet.tanggal_bangun)}
                  </span>
                )}
              </div>

              <div className="mt-auto pt-5">
                {outlet.is_active ? (
                  <Link
                    href={outletMenuHref(outlet.slug)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                  >
                    Lihat Menu
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Sedang tutup — buka lagi nanti, ya.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
