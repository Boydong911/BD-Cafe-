"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { KeyRound, AlertCircle, CheckCircle2 } from "lucide-react";
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
import {
  changeOwnerPasswordAction,
  type ChangePasswordState,
} from "./actions";

const initialState: ChangePasswordState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Menyimpan..." : "Simpan Password Baru"}
    </Button>
  );
}

/**
 * Form ganti password login owner — satu-satunya isi halaman Pengaturan
 * untuk sekarang. Password sekarang wajib diketik lagi supaya orang yang
 * kebetulan pegang laptop owner tidak bisa diam-diam menggantinya.
 */
export function PasswordChangeForm({ username }: { username: string | null }) {
  const [state, formAction] = useActionState(
    changeOwnerPasswordAction,
    initialState
  );

  // Saat sukses, form di-bongkar ulang (key naik) supaya semua kolom kosong
  // lagi — pesan suksesnya tetap tampil karena di luar form.
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (state?.success) setFormKey((k) => k + 1);
  }, [state?.success]);

  return (
    <Card className="w-full rounded-2xl shadow-sm">
      <CardHeader>
        <div className="mb-1 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <CardTitle className="font-serif text-xl">
              Ubah Password Login Owner
            </CardTitle>
            <CardDescription className="text-sm">
              {username ? (
                <>
                  Pintu dashboard owner ini: akun <b>{username}</b>.
                </>
              ) : (
                <>Pintu dashboard owner ini.</>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form action={formAction} key={formKey} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current_password">Password Sekarang</Label>
            <Input
              id="current_password"
              name="current_password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new_password">Password Baru</Label>
            <Input
              id="new_password"
              name="new_password"
              type="password"
              placeholder="Minimal 6 karakter"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">Ulangi Password Baru</Label>
            <Input
              id="confirm_password"
              name="confirm_password"
              type="password"
              placeholder="Ulangi yang tadi"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>

          <SubmitButton />
        </form>

        {state?.success && (
          <div className="mt-4 flex items-start gap-2 rounded-md bg-emerald-600/10 p-3 text-sm text-emerald-800 dark:text-emerald-400">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.success}</span>
          </div>
        )}

        {state?.error && (
          <div className="mt-4 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
