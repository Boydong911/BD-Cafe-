import { kasirLogoutAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { fetchOutletBySlug } from "@/lib/outlets";

export default async function KasirLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ outlet: string }>;
}) {
  // Nama outlet ditampilkan di header supaya kasir selalu tahu dia berdiri
  // di board outlet mana — penting saat owner buka beberapa outlet sekaligus.
  const { outlet: slug } = await params;
  const outlet = await fetchOutletBySlug((slug ?? "").toLowerCase());

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <p className="font-serif text-lg font-semibold leading-tight">
              BD Cafe{outlet ? ` · ${outlet.nama}` : ""}
            </p>
            <p className="text-xs opacity-80">Dashboard Kasir</p>
          </div>
          {/*
            kasirLogoutAction, bukan logoutAction yang biasa dipakai sidebar
            owner: halaman ini untuk kasir, jadi keluar dari sini harus balik
            ke login kasir -- apa pun role akun yang sedang dipakai.
          */}
          <form action={kasirLogoutAction}>
            {/*
              Warna ditulis eksplisit, bukan mengandalkan variant `secondary`.

              Variant `secondary` punya `text-secondary-foreground` (cokelat
              gelap) yang cocok untuk kartu terang. Di header yang gelap
              (bg-primary) teksnya ikut jadi hampir tidak terlihat, terutama
              saat hover. Jadi warna netral + arahkan text ke warna terang
              supaya selalu kontras dengan header gelap.
            */}
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="font-sans text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            >
              Keluar
            </Button>
          </form>
        </div>
      </header>
      {/* `pb-24` memberi ruang untuk iPhone home bar di bagian bawah */}
      <main className="mx-auto max-w-7xl px-4 py-5 pb-24 sm:pb-5">{children}</main>
    </div>
  );
}
