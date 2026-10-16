// File: app/admin/owner/kategori/page.tsx
import { createClient } from "@/lib/supabase/server";
import { CategoryManager } from "@/components/admin/category-manager";

export default async function OwnerCategoriesPage() {
  const supabase = await createClient();

  // Hitung jumlah menu per kategori di halaman ini juga, supaya owner langsung
  // tahu kategori mana yang masih dipakai sebelum menghapusnya.
  const [{ data: categories, error }, { data: menuCounts }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true }),
    supabase.from("menu_items").select("category_id"),
  ]);

  const countByCategory = new Map<string, number>();
  for (const item of menuCounts ?? []) {
    if (!item.category_id) continue;
    countByCategory.set(
      item.category_id,
      (countByCategory.get(item.category_id) ?? 0) + 1
    );
  }

  const rows = (categories ?? []).map((category) => ({
    ...category,
    menu_count: countByCategory.get(category.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Kategori</h1>
        <p className="text-sm text-muted-foreground">
          Urutan di sini menentukan urutan filter kategori di halaman menu customer.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">Gagal memuat kategori: {error.message}</p>
      )}

      <CategoryManager initialCategories={rows} />
    </div>
  );
}
