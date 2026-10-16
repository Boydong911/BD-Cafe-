import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MenuForm, type MenuFormCategory } from "@/components/admin/menu-form";
import { fetchCategoryTree } from "@/lib/categories";
import type { MenuItemRow } from "@/types/menu";

export default async function EditMenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: menuData }, groups] = await Promise.all([
    supabase.from("menu_items").select("*").eq("id", id).single(),
    fetchCategoryTree(),
  ]);

  if (!menuData) notFound();

  const menuItem = menuData as unknown as MenuItemRow;

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
        <h1 className="text-2xl font-bold">Edit Menu</h1>
        <p className="text-sm text-muted-foreground">
          Perbarui detail &quot;{menuItem.name}&quot;.
        </p>
      </div>
      <MenuForm mode="edit" categories={categories} initialData={menuItem} />
    </div>
  );
}