"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { daftarAction, type DaftarState } from "./actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, CheckCircle2, UserPlus } from "lucide-react";

const initialState: DaftarState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Membuat akun..." : "Daftar & Masuk"}
    </Button>
  );
}

/**
 * Pendaftaran karyawan baru (`/daftar` ber-outlet, mis. /outlet-a/daftar).
 *
 * Terbuka dari halaman login kasir outlet yang sama. Slot outlet dikirim
 * sebagai input tersembunyi — server memvalidasi ulang slug-nya, jadi
 * isian ini bukan keputusan keamanan, hanya konteks.
 * Setelah daftar, akun langsung dipakai — pemohon langsung masuk ke
 * dashboard kasir tanpa mengetik ulang password.
 */
export default function DaftarForm({ outletSlug }: { outletSlug: string }) {
  const [state, formAction] = useActionState(daftarAction, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-1 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-accent" />
            <CardTitle>Daftar Karyawan Baru</CardTitle>
          </div>
          <CardDescription>
            Daftar sebagai kasir outlet <b>/{outletSlug}</b>. Isi data di bawah.
            Akun langsung aktif dan kamu langsung masuk ke dashboard kasir.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form action={formAction} className="space-y-4">
            {/* Outlet tempat pendaftaran — baca ulang & divalidasi di server action */}
            <input type="hidden" name="outlet_slug" value={outletSlug} />
            <div className="space-y-2">
              <Label htmlFor="full_name">Nama Lengkap</Label>
              <Input
                id="full_name"
                name="full_name"
                placeholder="Budi Santoso"
                autoComplete="name"
                required
                minLength={3}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                placeholder="budi"
                autoComplete="username"
                required
                minLength={3}
                maxLength={30}
                className="lowercase"
              />
              <p className="text-xs text-muted-foreground">
                Dipakai untuk login. huruf kecil, angka, titik, _ dan - saja.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Buat Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Minimal 6 karakter"
                autoComplete="new-password"
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Jangan memakai password pentingmu yang lain — ini akun kerja.
              </p>
            </div>

            {state?.error && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}

            {state?.success && (
              <div className="flex items-start gap-2 rounded-md bg-emerald-600/10 p-3 text-sm text-emerald-800 dark:text-emerald-400">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{state.success}</span>
              </div>
            )}

            <SubmitButton />
          </form>

          <div className="mt-4 border-t pt-4">
            <Button asChild variant="ghost" className="w-full">
              <Link href={`/${outletSlug}/login/kasir`}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Kembali ke login kasir
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
