"use client";

import { useActionState, useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Coffee, ImageOff, Loader2, Sandwich, Upload } from "lucide-react";
import { createMenuItem, updateMenuItem, type MenuFormState } from "@/app/admin/owner/menu/actions";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { describeOptions } from "@/lib/menu-defaults";
import type { MenuItemRow } from "@/types/menu";

/** Batas upload — harus sama dengan validasi di `uploadMenuImage()`. */
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const initialState: MenuFormState = {};

/**
 * Kategori yang boleh dipilih di form. Hanya SUB-kategori — kategori tingkat
 * atas (Minuman / Makanan) tidak pernah jadi tujuan menu.
 *
 * `isDrink` ikut dibawa supaya form bisa memberi tahu owner apa yang akan
 * menempel otomatis ke menu ini.
 */
export type MenuFormCategory = {
  id: string;
  name: string;
  groupName: string;
  isDrink: boolean;
};

export function MenuForm({
  mode,
  categories,
  initialData,
}: {
  mode: "create" | "edit";
  categories: MenuFormCategory[];
  initialData?: MenuItemRow;
}) {
  const router = useRouter();

  const action =
    mode === "edit" && initialData
      ? updateMenuItem.bind(null, initialData.id)
      : createMenuItem;

  const [state, formAction, isPending] = useActionState(action, initialState);

  const [isAvailable, setIsAvailable] = useState(initialData?.is_available ?? true);
  const [categoryId, setCategoryId] = useState(initialData?.category_id ?? "none");
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialData?.image_url ?? null
  );
  const [pickedFile, setPickedFile] = useState<{ name: string; size: number } | null>(
    null
  );

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPickedFile(null);
      return;
    }
    setPickedFile({ name: file.name, size: file.size });
    setImagePreview(URL.createObjectURL(file));
  }

  // Lepas blob URL lama supaya tidak menumpuk di memory setiap owner
  // memilih file berkali-kali.
  useEffect(() => {
    if (!imagePreview?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const fileTooBig = pickedFile ? pickedFile.size > MAX_IMAGE_BYTES : false;

  /** Sub-kategori dikelompokkan per induk, supaya dropdown terbaca "Kopi — Kopi". */
  const categoryGroups = categories.reduce<
    { groupName: string; items: MenuFormCategory[] }[]
  >((acc, category) => {
    const existing = acc.find((g) => g.groupName === category.groupName);
    if (existing) existing.items.push(category);
    else acc.push({ groupName: category.groupName, items: [category] });
    return acc;
  }, []);

  const selectedCategory =
    categoryId === "none"
      ? null
      : (categories.find((c) => c.id === categoryId) ?? null);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {state?.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="image">Foto Menu</Label>
        <div className="flex items-start gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
            {imagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview lokal (blob:), bukan aset remote
              <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageOff className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            {/*
              Input file asli disembunyikan (sr-only) supaya bisa diganti
              tampilan sendiri. Native "Choose File" tidak bisa diberi hover
              yang berarti, dan tidak ada indikasi apakah file sudah dipilih.
            */}
            <input
              id="image"
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              className="sr-only"
            />

            <label
              htmlFor="image"
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm font-medium transition-colors",
                "hover:border-accent hover:bg-accent/10 hover:text-accent-foreground",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                fileTooBig
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : pickedFile
                    ? "border-accent/70 bg-accent/10 text-accent-foreground"
                    : "text-muted-foreground"
              )}
            >
              {fileTooBig ? (
                <ImageOff className="h-4 w-4 shrink-0" />
              ) : pickedFile ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <Upload className="h-4 w-4 shrink-0" />
              )}
              <span className="max-w-[16rem] truncate">
                {pickedFile ? pickedFile.name : "Pilih foto"}
              </span>
            </label>

            <p
              className={cn(
                "truncate text-xs",
                fileTooBig ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {fileTooBig
                ? `Ukuran ${formatBytes(pickedFile!.size)} melebihi batas 3MB.`
                : pickedFile
                  ? `${formatBytes(pickedFile.size)} — klik lagi untuk mengganti.`
                  : "JPG, PNG, atau WEBP. Maks 3MB."}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Nama Menu</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          defaultValue={initialData?.name}
          placeholder="Contoh: Kopi Susu Gula Aren"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Deskripsi</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={initialData?.description ?? ""}
          placeholder="Deskripsi singkat menu (opsional)"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">Harga Jual (Rp)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            min={0}
            step={500}
            required
            defaultValue={initialData?.price}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cost_price">HPP (Rp)</Label>
          <Input
            id="cost_price"
            name="cost_price"
            type="number"
            min={0}
            step={100}
            required
            defaultValue={initialData?.cost_price}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category_id">Kategori</Label>
        <input type="hidden" name="category_id" value={categoryId === "none" ? "" : categoryId} />
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger id="category_id">
            <SelectValue placeholder="Pilih kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Tanpa Kategori</SelectItem>
            {categoryGroups.map((group) => (
              <SelectGroup key={group.groupName}>
                <SelectLabel>{group.groupName}</SelectLabel>
                {group.items.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        {/* Pratinjau: owner langsung tahu tombol apa yang akan muncul di kartu menu. */}
        {mode === "create" && selectedCategory && (
          <p
            className={cn(
              "flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-xs",
              selectedCategory.isDrink
                ? "border-accent/40 bg-accent/10 text-foreground"
                : "border-border bg-muted/50 text-muted-foreground"
            )}
          >
            {selectedCategory.isDrink ? (
              <Coffee className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            ) : (
              <Sandwich className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <span>
              {describeOptions(selectedCategory.isDrink)}{" "}
              <span className="text-muted-foreground">
                (Kategori {selectedCategory.groupName} · {selectedCategory.name})
              </span>
            </span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Stok Tersedia</p>
          <p className="text-xs text-muted-foreground">Matikan kalau menu ini sedang habis.</p>
        </div>
        <input type="hidden" name="is_available" value={isAvailable ? "on" : ""} />
        <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "Simpan Menu" : "Perbarui Menu"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Batal
        </Button>
      </div>
    </form>
  );
}