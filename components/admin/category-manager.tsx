// File: components/admin/category-manager.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Coffee,
  Loader2,
  Pencil,
  Plus,
  Sandwich,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createCategory,
  deleteCategory,
  deleteCategoryForce,
  moveCategory,
  setCategoryDrink,
  updateCategory,
} from "@/app/admin/owner/kategori/actions";

export type CategoryManagerRow = {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  /** Sub-kategori minuman -> menu-nya dapat tombol Gula + Ice/Hot. */
  isDrink: boolean;
  /** True = kategori tingkat atas (Minuman / Makanan), bukan tempat menu. */
  isGroup: boolean;
  menuCount: number;
};

export function CategoryManager({
  rows,
  groups,
}: {
  rows: CategoryManagerRow[];
  groups: { id: string; name: string }[];
}) {
  const [items, setItems] = useState(rows);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newParentId, setNewParentId] = useState(groups[0]?.id ?? "");
  const [newIsDrink, setNewIsDrink] = useState(true);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  /**
   * Jalankan server action lalu segarkan dari server.
   *
   * Sengaja TIDAK memakai sisipkan optimistic dengan `crypto.randomUUID()`:
   * id kategori dibuat database, jadi id karangan akan menggagalkan
   * edit/hapus baris tersebut sampai halaman di-reload penuh.
   */
  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
      else router.refresh();
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

  function handleDelete(category: CategoryManagerRow) {
    const extra =
      category.menuCount > 0
        ? `\n\n${category.menuCount} menu di dalamnya akan jadi TANPA kategori.`
        : "";
    if (!confirm(`Hapus kategori "${category.name}"?${extra}`)) return;

    run(() =>
      category.menuCount > 0
        ? deleteCategoryForce(category.id)
        : deleteCategory(category.id)
    );
  }

  function handleDrink(id: string, next: boolean) {
    // Tampilkan perubahan seketika, server yang jadi sumber kebenaran.
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, isDrink: next } : c)));
    run(() => setCategoryDrink(id, next));
  }

  function handleMove(category: CategoryManagerRow, direction: "up" | "down") {
    const siblings = items.filter((c) => c.parentId === category.parentId);
    const index = siblings.findIndex((c) => c.id === category.id);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || swapWith < 0 || swapWith >= siblings.length) return;

    setItems((prev) => {
      const next = [...prev];
      const a = next.findIndex((c) => c.id === siblings[index].id);
      const b = next.findIndex((c) => c.id === siblings[swapWith].id);
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });

    run(() => moveCategory(category.id, direction));
  }

  return (
    <div className="space-y-6">
      {/* Tambah sub-kategori */}
      <form
        action={handleCreate}
        className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="kategori-baru"
            name="name"
            placeholder="Nama kategori (contoh: Kopi)"
            required
            maxLength={50}
            className="sm:w-64"
          />
          <select
            id="kategori-induk"
            name="parent_id"
            value={newParentId}
            onChange={(e) => setNewParentId(e.target.value)}
            required
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-48"
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              name="is_drink"
              checked={newIsDrink}
              onChange={(e) => setNewIsDrink(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-[hsl(var(--accent))]"
            />
            Minuman (dapat tombol Gula + Ice/Hot)
          </label>

          <Button type="submit" disabled={isPending || !newParentId} className="sm:ml-auto">
            {isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-4 w-4" />
            )}
            Tambah
          </Button>
        </div>

        {groups.length === 0 && (
          <p className="text-xs text-destructive">
            Belum ada kategori induk (Minuman / Makanan). Jalankan migrasi
            20261016-category-groups.sql dulu.
          </p>
        )}
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
              <TableHead className="w-14">Urutan</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead className="w-52">Jenis</TableHead>
              <TableHead className="w-28 text-right">Jumlah Menu</TableHead>
              <TableHead className="w-24 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  Belum ada kategori. Tambahkan yang pertama di atas.
                </TableCell>
              </TableRow>
            )}

            {items.map((category, index) => {
              const siblingIndex = items
                .slice(0, index)
                .filter((c) => c.parentId === category.parentId).length;
              const siblingCount = items.filter(
                (c) => c.parentId === category.parentId
              ).length;

              return (
                <TableRow key={category.id}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={isPending || siblingIndex === 0}
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
                        disabled={isPending || siblingIndex === siblingCount - 1}
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
                      <span
                        className={
                          category.isGroup
                            ? "font-serif text-base font-bold"
                            : "font-medium"
                        }
                      >
                        {category.isGroup ? (
                          category.name
                        ) : (
                          <>
                            <span className="mr-2 text-muted-foreground">└</span>
                            {category.name}
                          </>
                        )}
                      </span>
                    )}
                  </TableCell>

                  <TableCell>
                    {category.isGroup ? (
                      <span className="text-xs text-muted-foreground">
                        Pengelompok
                      </span>
                    ) : (
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Switch
                          checked={category.isDrink}
                          disabled={isPending}
                          onCheckedChange={(checked) =>
                            handleDrink(category.id, checked)
                          }
                        />
                        <span className="flex items-center gap-1.5">
                          {category.isDrink ? (
                            <>
                              <Coffee className="h-3.5 w-3.5 text-accent" />
                              <span className="text-xs font-medium">Minuman</span>
                            </>
                          ) : (
                            <>
                              <Sandwich className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                Makanan
                              </span>
                            </>
                          )}
                        </span>
                      </label>
                    )}
                  </TableCell>

                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {category.isGroup ? "—" : category.menuCount}
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
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Menu di kategori <span className="font-medium">Minuman</span> otomatis dapat tombol
        Gula &amp; Ice/Hot. Menu di kategori Makanan tidak.
      </p>
    </div>
  );
}
