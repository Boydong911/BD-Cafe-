"use client";

import { useMemo, useState } from "react";
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
  /** Label kategori dibuat lebih besar dan rata tengah. Dipakai di /menu. */
  centerFilter = false,
}: {
  items: MenuCardItem[];
  groups: CategoryFilterGroup[];
  tableParam: string | null;
  centerFilter?: boolean;
}) {
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

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (activeGroup === ALL) return true;
        if (activeChild !== null) return item.category_id === activeChild;
        return (
          item.category_id !== null &&
          groupByCategoryId.get(item.category_id) === activeGroup
        );
      }),
    [items, activeGroup, activeChild, groupByCategoryId]
  );

  const activeLabel =
    activeChild !== null
      ? groups
          .find((g) => g.id === activeGroup)
          ?.children.find((c) => c.id === activeChild)?.name
      : groups.find((g) => g.id === activeGroup)?.name;

  return (
    <div className="space-y-5">
      <CategoryFilter
        groups={groups}
        activeGroup={activeGroup}
        activeChild={activeChild}
        onGroupChange={setActiveGroup}
        onChildChange={setActiveChild}
        showOutOfStock={false}
        className={centerFilter ? "justify-items-center [&>div]:justify-center" : undefined}
      />

      {filteredItems.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Menu tidak ditemukan
          {activeLabel ? ` di kategori "${activeLabel}"` : ""}.
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