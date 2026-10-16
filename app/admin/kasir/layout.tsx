import { logoutAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

export default function KasirLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <p className="font-serif text-lg font-semibold leading-tight">
              BD Coffee
            </p>
            <p className="text-xs opacity-80">Dashboard Kasir</p>
          </div>
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              className="font-sans"
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