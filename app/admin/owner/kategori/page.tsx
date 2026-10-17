// File: app/admin/owner/kategori/page.tsx
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  CategoryManager,
  type CategoryManagerRow,
} from "@/components/admin/category-manager";
import {
  attachCounts,
  fetchCategoryTree,
  fetchMenuCountByCategory,
} from "@/lib/categories";

export const metadata: Metadata = {
  title: "Kelola Kategori",
};

export default async function OwnerCategoriesPage() {
  const supabase = await createClient();

  const { data: rawCategories, error } = await supabase
    .from("categories")
    .select("id, name, parent_id, is_drink, sort_order")
    .order("sort_order", { ascending: true });

  const counts = await fetchMenuCountByCategory();
  const groups = attachCounts(await fetchCategoryTree(), counts);

  // Ratakan pohon jadi daftar datar, tapi tetap urut induk -> anak supaya
  // tabelnya bisa dibaca sekilas tanpa berklik.
  const rows: CategoryManagerRow[] = [];

  for (const group of groups) {
    rows.push({
      id: group.id,
      name: group.name,
      parentId: null,
      parentName: null,
      isDrink: false,
      isGroup: true,
      menuCount: group.menuCount,
    });

    for (const child of group.children) {
      rows.push({
        id: child.id,
        name: child.name,
        parentId: group.id,
        parentName: group.name,
        isDrink: child.isDrink,
        isGroup: false,
        menuCount: counts.get(child.id) ?? 0,
      });
    }
  }

  // Jaring pengaman: kategori yang tidak masuk pohon (mis. induknya somehow
  // hilang) tetap harus terlihat, kalau tidak owner tidak akan pernah tahu
  // kategori itu ada dan tidak bisa diperbaiki.
  const seen = new Set(rows.map((row) => row.id));
  for (const category of rawCategories ?? []) {
    if (seen.has(category.id)) continue;
    rows.push({
      id: category.id,
      name: category.name,
      parentId: category.parent_id,
      parentName: null,
      isDrink: category.is_drink,
      isGroup: false,
      menuCount: 0,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Kategori</h1>
        <p className="text-sm text-muted-foreground">
          Urutan di sini menentukan urutan filter di halaman menu.{" "}
          <span className="font-medium">Minuman</span> dan{" "}
          <span className="font-medium">Makanan</span> hanya pengelompok — menu
          selalu menempel ke sub-kategorinya.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">Gagal memuat kategori: {error.message}</p>
      )}

      <CategoryManager
        rows={rows}
        groups={groups.map((group) => ({ id: group.id, name: group.name }))}
      />
    </div>
  );
}
