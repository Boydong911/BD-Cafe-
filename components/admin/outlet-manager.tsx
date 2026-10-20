// File: components/admin/outlet-manager.tsx
"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  Check,
  Loader2,
  LogIn,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  archiveOutlet,
  createOutlet,
  updateOutlet,
  type OutletActionState,
} from "@/app/admin/owner/outlet/actions";

export type OutletCardData = {
  id: string;
  slug: string;
  nama: string;
  tanggal_bangun: string | null;
  menu_mode: "salinan" | "sendiri";
  is_pusat: boolean;
  is_active: boolean;
  menuCount: number;
};

const INITIAL_CREATE_STATE: OutletActionState = { success: false };

export function OutletManager({ outlets }: { outlets: OutletCardData[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [menuMode, setMenuMode] = useState<"salinan" | "sendiri">("salinan");
  const [state, formAction, isCreating] = useActionState(
    createOutlet,
    INITIAL_CREATE_STATE
  );

  // Outlet baru jadi: tutup form-nya. Daftar ikut segar karena server action
  // sudah memanggil revalidatePath.
  useEffect(() => {
    if (state.success) setFormOpen(false);
  }, [state.success]);

  const earlyOutlet = outlets.some((o) => !o.is_pusat);

  return (
    <div className="space-y-6">
      <div>
        {!formOpen ? (
          <Button onClick={() => setFormOpen(true)} className="w-full sm:w-auto">
            <Plus className="mr-1.5 h-4 w-4" />
            Create Outlet Baru
          </Button>
        ) : (
          <form
            action={formAction}
            className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-lg font-semibold text-foreground">
                  Outlet Baru
                </h2>
                <p className="text-sm text-muted-foreground">
                  Slug dibuat otomatis (outlet-b, outlet-c, ...) lalu dibekukan
                  karena tercetak di QR.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setFormOpen(false)}
                aria-label="Tutup form outlet baru"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="outlet-nama">Nama outlet</Label>
                <Input
                  id="outlet-nama"
                  name="nama"
                  placeholder="Contoh: BD Coffee Kemang"
                  maxLength={60}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outlet-tanggal">Tanggal bangun (opsional)</Label>
                <Input id="outlet-tanggal" name="tanggal_bangun" type="date" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Menu outlet baru sejak hari buka</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <ModeOption
                  value="salinan"
                  title="Ikut menu yang sudah ada"
                  desc="Menu pusat difotokopi sekali jadi milik outlet ini. Seterusnya berdiri sendiri — mengubah menu pusat tidak menyentuh salinan."
                  checked={menuMode === "salinan"}
                  onSelect={() => setMenuMode("salinan")}
                />
                <ModeOption
                  value="sendiri"
                  title="Buat menu sendiri"
                  desc="Menu mulai dari nol. Halaman pesan pelanggan menampilkan: Maaf, menu belum ada."
                  checked={menuMode === "sendiri"}
                  onSelect={() => setMenuMode("sendiri")}
                />
              </div>
            </div>

            {state.error && (
              <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {state.error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={isCreating}>
                {isCreating ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 h-4 w-4" />
                )}
                Create Outlet Baru
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setFormOpen(false)}
              >
                Batalkan
              </Button>
            </div>
          </form>
        )}

        {state.success && state.message && (
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-400">
            <Check className="h-4 w-4 shrink-0" />
            {state.message}
          </p>
        )}
      </div>

      {earlyOutlet && (
        <p className="text-xs text-muted-foreground">
          Catatan: tiap outlet non-pusat kini aktif penuh — Meja 1 + QR otomatis,
          halaman menu &amp; kasir miliknya sendiri di /outlet-x/menu dan
          /outlet-x/admin/kasir. Menu &amp; karyawan tetap dikelola lewat halaman
          Menu dan Karyawan dengan pemilih outlet.
        </p>
      )}

      {/*
        Pintu masuk kasir per outlet. Tiap outlet punya URL login sendiri,
        jadi kasir outlet B tidak keharusan lewat pintu outlet A.
      */}
      {outlets.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <h2 className="font-serif text-lg font-semibold text-foreground">
            Login Kasir
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Setiap outlet punya pintu login sendiri. Setelah masuk, kasir
            otomatis mendarat di board outlet tempatnya bekerja dan yang
            terlihat otomatis dibatasi ke outlet itu.
          </p>
          <div className="flex flex-wrap gap-2">
            {outlets
              .filter((o) => o.is_active)
              .map((o) => (
                <Button key={o.id} variant="outline" size="sm" asChild>
                  <Link href={`/${o.slug}/login/kasir`}>
                    <LogIn className="mr-1.5 h-4 w-4" />
                    Login Kasir · {o.nama}
                  </Link>
                </Button>
              ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {outlets.map((outlet) => (
          <OutletCard key={outlet.id} outlet={outlet} onDone={() => router.refresh()} />
        ))}
      </div>

      {outlets.length === 0 && (
        <p className="rounded-xl border border-amber-600/30 bg-amber-600/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-400">
          Belum ada outlet. Jalankan dulu fondasi multi-outlet
          (supabase/migrations/20261020-01-fondasi-multi-outlet.sql) di
          Supabase SQL Editor.
        </p>
      )}
    </div>
  );
}

/** Pilihan mode menu outlet baru (radio bergaya kartu). */
function ModeOption({
  value,
  title,
  desc,
  checked,
  onSelect,
}: {
  value: "salinan" | "sendiri";
  title: string;
  desc: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors",
        checked ? "border-accent bg-accent/10" : "border-border hover:border-accent/40"
      )}
    >
      <input
        type="radio"
        name="menu_mode"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="mt-0.5"
      />
      <span className="space-y-0.5">
        <span className="block font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
    </label>
  );
}

function OutletCard({
  outlet,
  onDone,
}: {
  outlet: OutletCardData;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function toggleArchive() {
    startTransition(async () => {
      await archiveOutlet(outlet.id, !outlet.is_active);
      onDone();
    });
  }

  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm",
        !outlet.is_active && "opacity-70"
      )}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-lg font-semibold text-foreground">
            {outlet.nama}
          </h3>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {outlet.is_pusat ? <Badge>Pusat</Badge> : null}
            {!outlet.is_active ? <Badge variant="secondary">Arsip</Badge> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/80">
            /{outlet.slug}
          </code>
          <Badge variant="outline">
            {outlet.menu_mode === "salinan" ? "Menu salinan" : "Menu sendiri"}
          </Badge>
        </div>

        <dl className="space-y-1 text-sm text-muted-foreground">
          <div className="flex justify-between gap-2">
            <dt>Tanggal bangun</dt>
            <dd className="text-foreground">{outlet.tanggal_bangun ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Menu</dt>
            <dd className="text-foreground">{outlet.menuCount} menu</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <EditOutletDialog outlet={outlet} onDone={onDone} />

        {outlet.is_pusat ? (
          <span className="text-xs text-muted-foreground">
            Pusat tidak bisa diarsipkan
          </span>
        ) : outlet.is_active ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" size="sm" disabled={isPending}>
                <Archive className="mr-1.5 h-4 w-4" />
                Arsipkan
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Arsipkan {outlet.nama}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Outlet jadi tidak aktif dan hilang dari pemilih outlet, tapi
                  datanya (menu, meja, sejarah pesanan) tidak dihapus dan bisa
                  dinyalakan lagi kapan saja.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={toggleArchive}>
                  Ya, arsipkan
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleArchive}
            disabled={isPending}
          >
            <ArchiveRestore className="mr-1.5 h-4 w-4" />
            Nyalakan lagi
          </Button>
        )}
      </div>
    </div>
  );
}

/** Dialog edit nama & tanggal bangun. Slug sengaja tidak bisa diedit. */
function EditOutletDialog({
  outlet,
  onDone,
}: {
  outlet: OutletCardData;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nama = String(formData.get("nama") ?? "").trim();
    const tanggal = String(formData.get("tanggal_bangun") ?? "").trim();

    if (nama.length < 2) {
      setError("Nama outlet minimal 2 karakter.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await updateOutlet(outlet.id, nama, tanggal);
      if (result.success) {
        setOpen(false);
        onDone();
      } else {
        setError(result.error ?? "Gagal menyimpan.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <Pencil className="mr-1.5 h-4 w-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle>Edit {outlet.nama}</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`edit-nama-${outlet.id}`}>Nama outlet</Label>
            <Input
              id={`edit-nama-${outlet.id}`}
              name="nama"
              defaultValue={outlet.nama}
              maxLength={60}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-tanggal-${outlet.id}`}>Tanggal bangun</Label>
            <Input
              id={`edit-tanggal-${outlet.id}`}
              name="tanggal_bangun"
              type="date"
              defaultValue={outlet.tanggal_bangun ?? ""}
            />
          </div>
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Slug <code className="font-mono">{outlet.slug}</code> sengaja beku —
            tercetak di QR meja, jadi tidak bisa diganti.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Simpan
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
