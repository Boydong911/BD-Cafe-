"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  ALL,
  CategoryFilter,
  OUT_OF_STOCK,
  type CategoryFilterGroup,
} from "@/components/category-filter";
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
import { ImageOff, Pencil, Trash2 } from "lucide-react";
import { deleteMenuItem, toggleMenuStock } from "@/app/admin/owner/menu/actions";
import type { MenuItemRow } from "@/types/menu";

export function MenuTable({
  items,
  groups,
  outletSlug,
}: {
  items: MenuItemRow[];
  groups: CategoryFilterGroup[];
  /** Slug outlet yang sedang dilihat, supaya link Edit kembali ke daftar outlet yang sama. */
  outletSlug?: string;
}) {
  const [rows, setRows] = useState(items);
  const [activeGroup, setActiveGroup] = useState<string>(ALL);
  const [activeChild, setActiveChild] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /** Peta kategori_id -> nama grup, supaya menu bisa difilter tanpa join ulang. */
  const groupByCategoryId = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      for (const child of group.children) map.set(child.id, group.id);
    }
    return map;
  }, [groups]);

  const visibleRows = useMemo(() => {
    if (activeGroup === ALL) return rows;
    if (activeGroup === OUT_OF_STOCK) return rows.filter((r) => !r.is_available);

    return rows.filter((r) => {
      if (!r.category_id) return false;
      if (groupByCategoryId.get(r.category_id) !== activeGroup) return false;
      if (activeChild && r.category_id !== activeChild) return false;
      return true;
    });
  }, [rows, activeGroup, activeChild, groupByCategoryId]);

  const outOfStockCount = useMemo(
    () => rows.filter((r) => !r.is_available).length,
    [rows]
  );

  function handleToggleStock(id: string, next: boolean) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, is_available: next } : r)));
    startTransition(async () => {
      try {
        await toggleMenuStock(id, next);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Gagal update stok");
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, is_available: !next } : r)));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteMenuItem(id);
        setRows((prev) => prev.filter((r) => r.id !== id));
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Gagal menghapus menu");
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        Belum ada menu. Klik &quot;Tambah Menu&quot; untuk mulai mengisi katalog.
      </div>
    );
  }

  const isFiltered = activeGroup !== ALL || activeChild !== null;

  return (
    <div className="space-y-3">
      <CategoryFilter
        groups={groups}
        activeGroup={activeGroup}
        activeChild={activeChild}
        onGroupChange={setActiveGroup}
        onChildChange={setActiveChild}
        outOfStockCount={outOfStockCount}
      />

      {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

      {visibleRows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Tidak ada menu di filter ini.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Foto</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-right">Harga</TableHead>
                <TableHead className="text-right">HPP</TableHead>
                <TableHead className="text-center">Stok</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((item) => (
                <TableRow key={item.id}>
                <TableCell>
                  <div className="relative h-10 w-10 overflow-hidden rounded-md bg-muted">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.name}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageOff className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  {item.categories?.name ? (
                    <Badge variant="secondary">{item.categories.name}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  Rp {item.price.toLocaleString("id-ID")}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  Rp {item.cost_price.toLocaleString("id-ID")}
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={item.is_available}
                    disabled={isPending}
                    onCheckedChange={(checked) => handleToggleStock(item.id, checked)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button asChild size="icon" variant="ghost" className="h-8 w-8">
                      <Link
                        href={
                          outletSlug
                            ? `/admin/owner/menu/${item.id}/edit?outlet=${outletSlug}`
                            : `/admin/owner/menu/${item.id}/edit`
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus &quot;{item.name}&quot;?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tindakan ini tidak bisa dibatalkan. Menu akan hilang dari katalog
                            customer dan dashboard.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => handleDelete(item.id)}
                          >
                            Hapus
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {isFiltered && (
        <p className="text-xs text-muted-foreground">
          Menampilkan {visibleRows.length} dari {rows.length} menu.
        </p>
      )}
    </div>
  );
}