// File: components/admin/category-manager.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Plus,
  Trash2,
  X,
  ArrowDown,
  ArrowUp,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  createCategory,
  deleteCategory,
  deleteCategoryForce,
  moveCategory,
  updateCategory,
} from "@/app/admin/owner/kategori/actions";

export type CategoryRow = {
  id: string;
  name: string;
  sort_order: number;
  menu_count: number;
};

export function CategoryManager({
  initialCategories,
}: {
  initialCategories: CategoryRow[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  /**
   * Jalankan server action lalu segarkan data dari server.
   *
   * Sengaja TIDAK memakai sisipkan optimistic dengan `crypto.randomUUID()`:
   * id kategori dibuat oleh database, jadi id karangan akan menggagalkan
   * edit/hapus baris tersebut sampai halaman di-reload penuh.
   */
  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleCreate(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      setError("Nama kategori wajib diisi.");
      return;
    }

    run(async () => {
      const result = await createCategory(formData);
      if (result.success) {
        (document.getElementById("kategori-baru") as HTMLFormElement | null)?.reset();
      }
      return result;
    });
  }

  function handleUpdate(id: string, formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      setError("Nama kategori wajib diisi.");
      return;
    }

    run(async () => {
      const result = await updateCategory(id, formData);
      if (result.success) setEditingId(null);
      return result;
    });
  }

  function handleDelete(category: CategoryRow) {
    const confirmation =
      category.menu_count > 0
        ? `"${category.name}" masih dipakai ${category.menu_count} menu.\n\n` +
          "Kalau dihapus, menu-menu itu akan jadi TANPA kategori.\n" +
          "Lanjutkan?"
        : `Hapus kategori "${category.name}"?`;

    if (!confirm(confirmation)) return;

    run(async () => {
      // Kalau masih ada menu yang menempel, owner sudah menyatakan setuju lewat
      // konfirmasi di atas — langsung pakai jalur paksa. Kalau kategori sudah
      // kosong, jalankan delete biasa supaya tidak menimpa menu tanpa sengaja.
      return category.menu_count > 0
        ? deleteCategoryForce(category.id)
        : deleteCategory(category.id);
    });
  }

  function handleMove(category: CategoryRow, direction: "up" | "down") {
    const index = categories.findIndex((c) => c.id === category.id);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || swapWith < 0 || swapWith >= categories.length) return;

    // Susun ulang tampilan seketika supaya tombol terasa responsif, lalu
    // biarkan server yang jadi sumber kebenaran lewat router.refresh().
    setCategories((prev) => {
      const next = [...prev];
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return next;
    });

    run(() => moveCategory(category.id, direction));
  }

  return (
    <div className="space-y-6">
      <form
        action={handleCreate}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row"
      >
        <Input
          id="kategori-baru"
          name="name"
          placeholder="Nama kategori (contoh: Minuman Panas)"
          required
          maxLength={50}
          className="sm:w-72"
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-1.5 h-4 w-4" />
          )}
          Tambah Kategori
        </Button>
      </form>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Urutan</TableHead>
              <TableHead>Nama Kategori</TableHead>
              <TableHead className="w-28 text-right">Jumlah Menu</TableHead>
              <TableHead className="w-40 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                  Belum ada kategori. Tambahkan yang pertama di atas.
                </TableCell>
              </TableRow>
            )}

            {categories.map((category, index) => (
              <TableRow key={category.id}>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={isPending || index === 0}
                      onClick={() => handleMove(category, "up")}
                      aria-label={`Naikkan urutan ${category.name}`}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={isPending || index === categories.length - 1}
                      onClick={() => handleMove(category, "down")}
                      aria-label={`Turunkan urutan ${category.name}`}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>

                <TableCell>
                  {editingId === category.id ? (
                    <form
                      action={(formData) => handleUpdate(category.id, formData)}
                      className="flex items-center gap-2"
                    >
                      <Input
                        name="name"
                        defaultValue={category.name}
                        autoFocus
                        maxLength={50}
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
                    <span className="font-medium">{category.name}</span>
                  )}
                </TableCell>

                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    category.menu_count === 0 && "text-muted-foreground"
                  )}
                >
                  {category.menu_count}
                </TableCell>

                <TableCell className="text-right">
                  {editingId === category.id ? null : (
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={isPending}
                        onClick={() => setEditingId(category.id)}
                        aria-label={`Ubah nama ${category.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={isPending}
                        onClick={() => handleDelete(category)}
                        aria-label={`Hapus kategori ${category.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
