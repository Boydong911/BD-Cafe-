"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, PackageSearch } from "lucide-react";
import { MenuCard, type MenuCardItem } from "./menu-card";

export type CategoryOption = {
  id: string;
  name: string;
};

export function MenuCatalog({
  items,
  categories,
  tableParam,
}: {
  items: MenuCardItem[];
  categories: CategoryOption[];
  tableParam: string | null;
}) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesCategory =
        activeCategory === "all" || item.category_name === activeCategory;

      const matchesSearch =
        keyword.length === 0 ||
        item.name.toLowerCase().includes(keyword) ||
        (item.description?.toLowerCase().includes(keyword) ?? false);

      return matchesCategory && matchesSearch;
    });
  }, [items, search, activeCategory]);

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

      {/* Filter kategori */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Button
          size="sm"
          variant={activeCategory === "all" ? "default" : "outline"}
          onClick={() => setActiveCategory("all")}
          className="shrink-0"
        >
          Semua
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            size="sm"
            variant={activeCategory === cat.name ? "default" : "outline"}
            onClick={() => setActiveCategory(cat.name)}
            className="shrink-0"
          >
            {cat.name}
          </Button>
        ))}
      </div>

      {/* Grid menu */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <PackageSearch className="h-8 w-8" />
          <p className="text-sm">
            Menu tidak ditemukan{search ? ` untuk "${search}"` : ""}.
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
