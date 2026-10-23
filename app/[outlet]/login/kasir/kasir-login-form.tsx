"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { kasirLoginAction, type LoginState } from "@/app/login/actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, UserPlus, Store, ShieldAlert } from "lucide-react";
import { LoginShell } from "@/components/auth/login-shell";

const initialState: LoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Memproses..." : "Masuk"}
    </Button>
  );
}

/**
 * Halaman login KASIR ber-outlet (mis. /outlet-a/login/kasir).
 *
 * Tiap outlet punya pintu sendiri supaya jelas tempat kasir outlet mana
 * yang harus berdiri. Setelah login, kasir mendarat di board outlet-nya
 * sendiri (app/login/actions.ts menyesuaikan target setelah cek profil).
 *
 * `notice` adalah peringatan yang muncul DI BAWAH KOLOM PASSWORD, di oper
 * dari halaman yang memindahkan orang ke sini (mis. kasir yang mencoba
 * login di halaman owner ditendang ke sini dengan notice "bukan-owner").
 */
export default function KasirLoginForm({
  notice,
  outletSlug,
}: {
  notice?: string;
  /** Slug outlet pintu login ini — dipakai link ke pendaftarannya. */
  outletSlug: string;
}) {
  const [state, formAction] = useActionState(kasirLoginAction, initialState);

  return (
    <LoginShell>
      <Card className="w-full rounded-2xl shadow-2xl">
        <CardHeader>
          <div className="mb-1 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Store className="h-5 w-5" />
            </span>
            <div>
              <CardTitle className="font-serif text-xl">Login Kasir</CardTitle>
              <CardDescription className="text-sm">
                Masuk untuk memproses pesanan.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                placeholder="budi"
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            {notice && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{notice}</span>
              </div>
            )}

            {state?.error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}

            <SubmitButton />
          </form>

          <div className="mt-4 border-t pt-4">
            <Button asChild variant="outline" className="w-full">
              <Link href={`/${outletSlug}/daftar`}>
                <UserPlus className="mr-1.5 h-4 w-4" />
                Daftarkan Karyawan Baru
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </LoginShell>
  );
}
