import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { MenuCardItem } from "@/components/customer/menu-card";

/**
 * Ambil menu + kategori untuk ditampilkan sebagai katalog.
 *
 * Dipakai oleh halaman /menu dan oleh tab "Pesan Menu" di halaman kasir,
 * supaya keduanya tidak punya query dan pemetaan field yang terpisah.
 * Satu sumber data, dua pemakai.
 */
export async function fetchMenuCatalog(): Promise<{
  items: MenuCardItem[];
  groups: Awaited<ReturnType<typeof fetchCategoryTree>>;
}> {
  const supabase = await createClient();

  const [{ data, error }, groups] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id, name, price, image_url, is_available, categories(id, name)")
      .order("name", { ascending: true }),
    fetchCategoryTree(),
  ]);

  if (error) {
    console.error("[menu] gagal memuat:", error.message);
    return { items: [], groups };
  }

  type Row = {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    is_available: boolean;
    categories: { id: string; name: string } | null;
  };

  const rows = (data ?? []) as unknown as Row[];

  return {
    groups,
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      image_url: row.image_url,
      is_available: row.is_available,
      category_id: row.categories?.id ?? null,
      category_name: row.categories?.name ?? null,
    })),
  };
}

/**
 * Kategori dua tingkat: induk (Minuman / Makanan) + sub-kategori.
 *
 * `parent_id IS NULL` = kategori tingkat atas. Menu TIDAK pernah langsung
 * menempel ke kategori tingkat atas — selalu ke sub-kategorinya.
 */
export type CategoryGroup = {
  id: string;
  name: string;
  /** Sub-kategori, sudah urut. */
  children: CategoryChild[];
  /** Total menu di grup ini (semua sub-kategorinya). */
  menuCount: number;
  /** Urutan tampil; makin kecil makin di atas. */
  sortOrder: number;
};

export type CategoryChild = {
  id: string;
  name: string;
  parentId: string;
  /** True = kategori minuman -> dapat opsi Gula + Ice/Hot. */
  isDrink: boolean;
  sortOrder: number;
};

type CategoryRowDb = {
  id: string;
  name: string;
  parent_id: string | null;
  is_drink: boolean;
  sort_order: number;
};

/**
 * Ambil seluruh kategori lalu kelompokkan jadi induk -> sub-kategori.
 *
 * Sub-kategori yang induknya hilang (mis. kategorinya dihapus dari database)
 * TIDAK dibuang diam-diam: dikembalikan sebagai grup sendiri supaya owner
 * tetap bisa melihat dan memperbaiki induknya.
 */
export async function fetchCategoryTree(): Promise<CategoryGroup[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, parent_id, is_drink, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[categories] gagal memuat:", error.message);
    return [];
  }

  const rows = (data ?? []) as CategoryRowDb[];

  const childrenOf = new Map<string, CategoryChild[]>();
  for (const row of rows) {
    if (!row.parent_id) continue;
    const list = childrenOf.get(row.parent_id) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
      isDrink: row.is_drink,
      sortOrder: row.sort_order,
    });
    childrenOf.set(row.parent_id, list);
  }

  const parents = rows
    .filter((row) => !row.parent_id)
    .map((row) => {
      const children = (childrenOf.get(row.id) ?? []).sort(
        (a, b) => a.sortOrder - b.sortOrder
      );
      return {
        id: row.id,
        name: row.name,
        children,
        menuCount: 0,
        sortOrder: row.sort_order,
      };
    });

  // Sub-kategori yatim (induknya tidak ada) -> jadikan grup supaya tidak hilang.
  const knownParentIds = new Set(parents.map((p) => p.id));
  const orphans = rows.filter(
    (row) => row.parent_id && !knownParentIds.has(row.parent_id)
  );
  for (const row of orphans) {
    parents.push({
      id: row.id,
      name: row.name,
      children: [],
      menuCount: 0,
      sortOrder: 999,
    });
  }

  // Urutan ikut kolom `sort_order`, bukan alfabet. Owner mengatur urutannya di
  // halaman Kategori (Minuman di atas Makanan), dan pilihan itu harus berlaku
  // juga di filter — bukan diganti urutan abjad yang menimpanya.
  return parents.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "id")
  );
}

/** Hitung jumlah menu per kategori (dipakai untuk badge jumlah di filter). */
export async function fetchMenuCountByCategory(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select("category_id");

  if (error) {
    console.error("[categories] gagal hitung menu:", error.message);
    return new Map();
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.category_id) continue;
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Pasang jumlah menu ke tiap grup (total anak-anaknya).
 * Dipanggil setelah `fetchMenuCountByCategory()`.
 */
export function attachCounts(
  groups: CategoryGroup[],
  counts: Map<string, number>
): CategoryGroup[] {
  return groups.map((group) => {
    const total = group.children.reduce(
      (sum, child) => sum + (counts.get(child.id) ?? 0),
      0
    );
    return { ...group, menuCount: total };
  });
}
