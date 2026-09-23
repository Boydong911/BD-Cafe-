// File: components/admin/table-manager.tsx
"use client";

import { useState, useTransition } from "react";
import { Tables } from "@/types/database.types";
import { createTable, toggleTableActive, deleteTable } from "@/app/admin/owner/meja/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { TableQrCard } from "@/components/admin/table-qr-card";

type TableRow = Tables<"tables">;

export function TableManager({ initialTables }: { initialTables: TableRow[] }) {
  const [tables, setTables] = useState(initialTables);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleCreate(formData: FormData) {
    setError(null);
    const result = await createTable(formData);
    if (result?.error) {
      setError(result.error);
      return;
    }
    // refresh sederhana: reload data via location, atau bisa optimistic.
    window.location.reload();
  }

  function handleToggle(id: string, current: boolean) {
    startTransition(async () => {
      setTables((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_active: !current } : t))
      );
      await toggleTableActive(id, !current);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Hapus meja ini? Tindakan tidak bisa dibatalkan.")) return;
    startTransition(async () => {
      setTables((prev) => prev.filter((t) => t.id !== id));
      await deleteTable(id);
    });
  }

  return (
    <div className="space-y-6">
      <form
        action={handleCreate}
        className="flex flex-col sm:flex-row gap-3 bg-card border border-border rounded-lg p-4"
      >
        <Input name="table_number" placeholder="Nomor meja (contoh: 05)" required className="sm:w-48" />
        <Input name="label" placeholder="Label (opsional, contoh: Dekat Jendela)" className="flex-1" />
        <Button type="submit">Tambah Meja</Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nomor</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Aktif</TableHead>
              <TableHead>QR Code</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tables.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Belum ada meja. Tambahkan di atas.
                </TableCell>
              </TableRow>
            )}
            {tables.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.table_number}</TableCell>
                <TableCell className="text-muted-foreground">{t.label ?? "—"}</TableCell>
                <TableCell>
                  <Switch
                    checked={t.is_active}
                    disabled={isPending}
                    onCheckedChange={() => handleToggle(t.id, t.is_active)}
                  />
                </TableCell>
                <TableCell>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">Lihat QR</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogTitle>QR Meja {t.table_number}</DialogTitle>
                      <TableQrCard tableNumber={t.table_number} label={t.label} />
                    </DialogContent>
                  </Dialog>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={isPending}
                    onClick={() => handleDelete(t.id)}
                  >
                    Hapus
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}