// File: components/admin/staff-manager.tsx
"use client";

import { useEffect, useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  Copy,
  Eye,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  createStaff,
  deleteStaff,
  moveStaff,
  resetStaffPassword,
  updateStaffName,
  type ActionResult,
  type ActionState,
} from "@/app/admin/owner/karyawan/actions";

export type StaffRow = {
  id: string;
  username: string;
  full_name: string | null;
  role: "owner" | "kasir";
  outlet_id: string | null;
  outlet_nama: string | null;
  created_at: string;
};

const initialState: ActionState = { success: false };

/**
 * Generate password acak yang cukup kuat untuk akun kasir.
 *
 * PENGECUALIAN: string ini dibuat di browser owner dan langsung dikirim ke
 * server untuk di-hash. Yang tersimpan di database tetap hash-nya — password
 * asli tidak pernah disimpan di mana pun.
 */
function generatePassword(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);

  let out = "";
  for (const byte of bytes) out += alphabet[byte % alphabet.length];

  // Pastikan ada minimal satu angka supaya tidak terlalu sulit ditebak.
  return /[0-9]/.test(out) ? out : out.slice(0, 11) + "7";
}

export type StaffOutletOption = { id: string; nama: string; is_pusat: boolean };

export function StaffManager({
  staff,
  currentUserId,
  outlets,
  selectedOutletId,
}: {
  staff: StaffRow[];
  currentUserId: string;
  /** Daftar outlet aktif untuk penempatan kasir. */
  outlets: StaffOutletOption[];
  selectedOutletId: string;
}) {
  const router = useRouter();
  // Akun kasir baru otomatis mengikuti outlet yang sedang dilihat owner.
  const [newOutletId, setNewOutletId] = useState(selectedOutletId);

  useEffect(() => {
    setNewOutletId(selectedOutletId);
  }, [selectedOutletId]);
  const [state, formAction, isCreating] = useActionState<ActionState, FormData>(
    createStaff,
    initialState
  );

  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function run(action: () => Promise<ActionState>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        if (result.message) setNotice(result.message);
        router.refresh();
      } else {
        setError(result.error ?? "Terjadi kesalahan.");
      }
    });
  }

  /**
   * Isi field password dengan hasil acak.
   *
   * Pakai `formRef` + `requestSubmit()` supaya nilainya ikut terkirim sebagai
   * bagian dari `formData` yang terkirim. Mengatur `value` langsung tidak
   * cukup untuk field yang belum pernah disentuh user (React/ uncontrolled
   * input akan mengabaikan penulisan property `value`).
   */
  function handleGenerate() {
    const password = generatePassword();
    setGeneratedPassword(password);
    setShowPassword(true);

    // Tunggu render selesai dulu supaya field ada dan React tidak menimpanya.
    requestAnimationFrame(() => {
      const field = formRef.current?.querySelector<HTMLInputElement>(
        'input[name="password"]'
      );
      if (!field) return;

      // Setter native dipakai supaya React mencatat perubahan nilai; menulis
      // `field.value = ...` langsung bisa diabaikan field yang belum disentuh.
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(field, password);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  return (
    <div className="space-y-6">
      {/* ---- Tambah karyawan baru ---- */}
      <form
        ref={formRef}
        action={formAction}
        className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
      >
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground">
            Tambah Karyawan
          </h2>
          <p className="text-sm text-muted-foreground">
            Karyawan baru langsung bisa login di halaman login dan masuk ke
            dashboard kasir.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nama Lengkap</Label>
            <Input
              id="full_name"
              name="full_name"
              placeholder="Contoh: Budi Santoso"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              placeholder="budi"
              autoComplete="off"
              required
              minLength={3}
              maxLength={30}
            />
            <p className="text-xs text-muted-foreground">
              Dipakai untuk login. huruf, angka, titik, _ dan - saja.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="outlet_kasir_baru">Penempatan Outlet</Label>
          <input type="hidden" name="outlet_id" value={newOutletId} />
          <Select value={newOutletId} onValueChange={setNewOutletId}>
            <SelectTrigger id="outlet_kasir_baru" className="w-full sm:w-72">
              <SelectValue placeholder="Pilih outlet" />
            </SelectTrigger>
            <SelectContent>
              {outlets.map((outlet) => (
                <SelectItem key={outlet.id} value={outlet.id}>
                  {outlet.nama}
                  {outlet.is_pusat ? " (pusat)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Kasir hanya melihat pesanan outlet penempatannya. Bisa dipindah
            kemudian lewat kolom Outlet di daftar bawah.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Minimal 6 karakter"
                autoComplete="new-password"
                required
                minLength={6}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {showPassword ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGenerate}
              className="shrink-0"
            >
              <KeyRound className="mr-1.5 h-4 w-4" />
              Buat acak
            </Button>
          </div>

          {generatedPassword && (
            <p className="flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-2 text-xs">
              <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="font-mono">{generatedPassword}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(generatedPassword)}
                className="ml-auto rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                aria-label="Salin password"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Password disimpan dalam bentuk hash — tidak bisa dibaca kembali,
            termasuk oleh owner. Kalau karyawan lupa, pakai tombol Reset Password.
          </p>
        </div>

        {state?.error && (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {state.error}
          </p>
        )}

        <Button
          type="submit"
          disabled={isCreating}
          className="w-full sm:w-auto"
        >
          {isCreating ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-1.5 h-4 w-4" />
          )}
          Buat Akun
        </Button>
      </form>

      {/* ---- Daftar karyawan ---- */}
      <div className="space-y-3">
        <h2 className="font-serif text-lg font-semibold text-foreground">
          Daftar Karyawan
        </h2>

        {error && (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
        {notice && (
          <p className="flex items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-400">
            <Check className="h-4 w-4 shrink-0" />
            {notice}
          </p>
        )}

        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Karyawan</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Outlet</TableHead>
                <TableHead>Bergabung</TableHead>
                <TableHead className="w-28 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    Belum ada karyawan.
                  </TableCell>
                </TableRow>
              )}

              {staff.map((person) => {
                const isSelf = person.id === currentUserId;
                const isResetting = resettingId === person.id;

                return (
                  <TableRow key={person.id}>
                    <TableCell>
                      {editingId === person.id ? (
                        <form
                          action={(formData) => {
                            const fullName = String(formData.get("full_name") ?? "");
                            run(async () => {
                              const result = await updateStaffName(person.id, fullName);
                              if (result.success) setEditingId(null);
                              return result;
                            });
                          }}
                          className="flex items-center gap-2"
                        >
                          <Input
                            name="full_name"
                            defaultValue={person.full_name ?? ""}
                            autoFocus
                            maxLength={100}
                            className="h-9 max-w-xs"
                          />
                          <Button type="submit" size="sm" disabled={isPending}>
                            Simpan
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </form>
                      ) : (
                        <span className="flex items-center gap-2 font-medium">
                          <UserRound className="h-4 w-4 text-muted-foreground" />
                          {person.full_name ?? "—"}
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="font-mono text-sm">{person.username}</TableCell>

                    <TableCell>
                      {person.role === "owner" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent-foreground">
                          <ShieldCheck className="h-3 w-3" />
                          Owner
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          Kasir
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      {person.role === "owner" ? (
                        <span className="text-xs text-muted-foreground">
                          Semua outlet
                        </span>
                      ) : (
                        <Select
                          value={person.outlet_id ?? ""}
                          onValueChange={(nextOutletId) => {
                            if (nextOutletId === person.outlet_id) return;
                            run(() => moveStaff(person.id, nextOutletId));
                          }}
                        >
                          <SelectTrigger className="h-8 w-44 text-xs">
                            <SelectValue placeholder="Pilih outlet" />
                          </SelectTrigger>
                          <SelectContent>
                            {outlets.map((outlet) => (
                              <SelectItem
                                key={outlet.id}
                                value={outlet.id}
                                className="text-xs"
                              >
                                {outlet.nama}
                                {person.outlet_id === outlet.id ? " (sekarang)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(person.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "Asia/Jakarta",
                      })}
                    </TableCell>

                    <TableCell className="text-right">
                      {isResetting ? (
                        <ResetPasswordForm
                          staffName={person.full_name ?? person.username}
                          disabled={isPending}
                          onCancel={() => setResettingId(null)}
                          onSubmit={(password) => {
                            run(async () => {
                              const result = await resetStaffPassword(person.id, password);
                              if (result.success) setResettingId(null);
                              return result;
                            });
                          }}
                        />
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isPending}
                            onClick={() => {
                              setEditingId(person.id);
                              setResettingId(null);
                            }}
                            aria-label={`Ubah nama ${person.username}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isPending}
                            onClick={() => setResettingId(person.id)}
                            aria-label={`Reset password ${person.username}`}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>

                          {/*
                            Akun owner tidak bisa dihapus sama sekali — button
                           -nya tidak dirender, bukan sekadar disabled, supaya
                            tidak APPEAR bisa diklik lalu ditolak.
                          */}
                          {!isSelf && person.role !== "owner" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  disabled={isPending}
                                  aria-label={`Hapus karyawan ${person.username}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Hapus {person.full_name ?? person.username}?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Akun ini akan langsung hilang dan tidak bisa login
                                    lagi. Tindakan ini tidak bisa dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-white hover:bg-destructive/90"
                                    onClick={() => run(() => deleteStaff(person.id))}
                                  >
                                    Ya, hapus
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

/** Formulir mini untuk ganti password satu karyawan. */
function ResetPasswordForm({
  staffName,
  disabled,
  onSubmit,
  onCancel,
}: {
  staffName: string;
  disabled: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 6) {
      setLocalError("Password minimal 6 karakter.");
      return;
    }
    setLocalError(null);
    onSubmit(password);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-end gap-1.5">
      <div className="flex gap-1.5">
        <div className="relative">
          <Input
            type={visible ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password baru"
            autoComplete="new-password"
            autoFocus
            className="h-8 w-40 pr-8 text-xs"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Sembunyikan" : "Tampilkan"}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
          >
            {visible ? <X className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <Button type="submit" size="sm" disabled={disabled}>
          Simpan
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {localError && <p className="text-xs text-destructive">{localError}</p>}

      <p className="max-w-[22rem] text-right text-[11px] text-muted-foreground">
        Password lama {staffName} tidak bisa ditampilkan — simpanan database
        hanya menyimpan hash-nya.
      </p>
    </form>
  );
}
