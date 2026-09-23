import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MenuForm } from "@/components/admin/menu-form";
import type { CategoryRow, MenuItemRow } from "@/types/menu";

export default async function EditMenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: menuData }, { data: categoryData }] = await Promise.all([
    supabase.from("menu_items").select("*").eq("id", id).single(),
    supabase.from("categories").select("id, name").order("sort_order"),
  ]);

  if (!menuData) notFound();

  const menuItem = menuData as unknown as MenuItemRow;
  const categories = (categoryData ?? []) as unknown as CategoryRow[];

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