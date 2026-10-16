// File: components/admin/registration-banner.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Check, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markRegistrationsSeen } from "@/app/admin/owner/actions";
import type { RegistrationEntry } from "@/lib/registrations";

/**
 * Banner di paling atas dashboard owner kalau ada pendaftaran karyawan yang
 * belum sempat dilihat.
 *
 * Tujuannya membantu owner melakukan deteksi: pendaftaran dari luar jam kerja,
 * atau nama yang tidak dikenal, langsung kelihatan di sini tanpa harus membuka
 * halaman Karyawan lebih dulu.
 */
export function RegistrationBanner({
  entries,
}: {
  entries: RegistrationEntry[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (entries.length === 0) return null;

  function dismiss() {
    startTransition(async () => {
      await markRegistrationsSeen();
      router.refresh();
    });
  }

  const selfRegistered = entries.filter(
    (entry) => entry.source === "self_register"
  );

  return (
    <div className="rounded-2xl border-2 border-amber-500/60 bg-amber-500/10 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />

        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="font-semibold text-foreground">
              {entries.length} karyawan baru terdaftar
              {selfRegistered.length > 0 && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  ({selfRegistered.length} daftar sendiri)
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Kalau ada yang tidak dikenali, hapus lewat halaman Karyawan.
            </p>
          </div>

          <ul className="space-y-1">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
              >
                <span className="font-medium text-foreground">
                  {entry.full_name ?? entry.username}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  @{entry.username}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatWhen(entry.created_at)}
                </span>
                {entry.source === "self_register" && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    daftar sendiri
                  </span>
                )}
                {!entry.still_active && (
                  <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">
                    sudah dihapus
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/owner/karyawan">
                <UserPlus className="mr-1.5 h-4 w-4" />
                Buka Karyawan
              </Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss} disabled={isPending}>
              <Check className="mr-1.5 h-4 w-4" />
              Sudah dicek
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          disabled={isPending}
          aria-label="Tutup notifikasi"
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-amber-500/20 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Waktu relatif yang enak dibaca owner: "baru saja", "2 jam lalu", atau
 * tanggal lengkap kalau sudah lebih dari seminggu.
 */
function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "baru saja";
  if (diffMin < 60) return `${diffMin} menit lalu`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;

  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}
