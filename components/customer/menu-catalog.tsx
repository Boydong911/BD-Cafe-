"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, PackageSearch } from "lucide-react";
import {
  ALL,
  CategoryFilter,
  type CategoryFilterGroup,
} from "@/components/category-filter";
import { MenuCard, type MenuCardItem } from "./menu-card";

export function MenuCatalog({
  items,
  groups,
  tableParam,
}: {
  items: MenuCardItem[];
  groups: CategoryFilterGroup[];
  tableParam: string | null;
}) {
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>(ALL);
  const [activeChild, setActiveChild] = useState<string | null>(null);

  /** Peta kategori_id -> grup induk, untuk memfilter tanpa join ulang. */
  const groupByCategoryId = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      for (const child of group.children) map.set(child.id, group.id);
    }
    return map;
  }, [groups]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesGroup =
        activeGroup === ALL
          ? true
          : activeChild !== null
            ? item.category_id === activeChild
            : item.category_id !== null &&
              groupByCategoryId.get(item.category_id) === activeGroup;

      const matchesSearch =
        keyword.length === 0 ||
        item.name.toLowerCase().includes(keyword) ||
        (item.description?.toLowerCase().includes(keyword) ?? false);

      return matchesGroup && matchesSearch;
    });
  }, [items, search, activeGroup, activeChild, groupByCategoryId]);

  const activeLabel =
    activeChild !== null
      ? groups
          .find((g) => g.id === activeGroup)
          ?.children.find((c) => c.id === activeChild)?.name
      : groups.find((g) => g.id === activeGroup)?.name;

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari menu, mis. 'Es Kopi Susu'..."
          className="pl-9"
        />
      </div>

      {/* Filter kategori: Minuman / Makanan -> sub-kategori */}
      <CategoryFilter
        groups={groups}
        activeGroup={activeGroup}
        activeChild={activeChild}
        onGroupChange={setActiveGroup}
        onChildChange={setActiveChild}
        showOutOfStock={false}
      />

      {/* Grid menu */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <PackageSearch className="h-8 w-8" />
          <p className="text-sm">
            Menu tidak ditemukan
            {activeLabel ? ` di kategori "${activeLabel}"` : ""}
            {search ? ` untuk "${search}"` : ""}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filteredItems.map((item) => (
            <MenuCard key={item.id} item={item} tableParam={tableParam} />
          ))}
        </div>
      )}
    </div>
  );
}
