import type { Metadata } from "next";
import { MenuForm } from "@/components/admin/menu-form";
import { fetchCategoryTree } from "@/lib/categories";
import type { MenuFormCategory } from "@/components/admin/menu-form";

export const metadata: Metadata = {
  title: "Tambah Menu",
};

export default async function NewMenuPage() {
  const groups = await fetchCategoryTree();

  // Menu hanya boleh menempel ke SUB-kategori, jadi kategori tingkat atas
  // (Minuman / Makanan) sengaja tidak ikut dikirim ke form.
  const categories: MenuFormCategory[] = groups.flatMap((group) =>
    group.children.map((child) => ({
      id: child.id,
      name: child.name,
      groupName: group.name,
      isDrink: child.isDrink,
    }))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tambah Menu</h1>
        <p className="text-sm text-muted-foreground">
          Isi detail menu baru untuk katalog BD Coffee.
        </p>
      </div>
      <MenuForm mode="create" categories={categories} />
    </div>
  );
}