"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { kasirLoginAction, type LoginState } from "../actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, UserPlus, Store } from "lucide-react";

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
 * Halaman login KASIR (`/login/kasir`).
 *
 * Terpisah dari halaman owner supaya kasir tidak salah masuk ke halaman yang
 * salah. Setelah login, langsung mendarat di /admin/kasir.
 */
export default function KasirLoginForm() {
  const [state, formAction] = useActionState(kasirLoginAction, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-1 flex items-center gap-2">
            <Store className="h-5 w-5 text-accent" />
            <CardTitle>Login Kasir</CardTitle>
          </div>
          <CardDescription>Masuk untuk memproses pesanan.</CardDescription>
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
              <Link href="/daftar">
                <UserPlus className="mr-1.5 h-4 w-4" />
                Daftarkan Karyawan Baru
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
