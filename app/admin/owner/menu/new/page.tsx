import { createClient } from "@/lib/supabase/server";
import { MenuForm } from "@/components/admin/menu-form";
import type { CategoryRow } from "@/types/menu";

export default async function NewMenuPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name").order("sort_order");
  const categories = (data ?? []) as unknown as CategoryRow[];

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