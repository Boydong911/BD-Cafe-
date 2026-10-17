"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ownerLoginAction, type LoginState } from "./actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, ShieldCheck } from "lucide-react";

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
 * Halaman login OWNER (`/login`).
 *
 * Terpisah dari halaman login kasir (`/login/kasir`) supaya kasir tidak
 * salah masuk ke halaman yang salah. Akun kasir yang nekat ke sini akan
 * dialihkan otomatis oleh server action.
 */
export default function OwnerLoginForm() {
  const [state, formAction] = useActionState(ownerLoginAction, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-1 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <CardTitle>Login Owner</CardTitle>
          </div>
          <CardDescription>Khusus pemilik BD Coffee.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                placeholder="boy123"
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
        </CardContent>
      </Card>
    </div>
  );
}
