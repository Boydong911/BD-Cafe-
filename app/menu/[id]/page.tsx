import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MenuDetail } from "@/components/customer/menu-detail";
import { TableSessionSync } from "@/components/customer/table-session-sync";
import { normalizeCustomizationGroups } from "@/lib/menu-customizations";

export const revalidate = 0; // selalu ambil stok & harga terbaru

type DetailRow = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  image_url: string | null;
  is_available: boolean;
  customization_options: unknown;
  categories: { name: string } | null;
};

export default async function MenuDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ table?: string }>;
}) {
  const [{ id }, { table }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("menu_items")
    .select(
      "id, name, description, price, image_url, is_available, customization_options, categories(name)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const row = data as unknown as DetailRow;

  // Buang grup/pilihan kosong supaya UI tidak menampilkan baris tanpa label.
  // Pakai normalizer agar data rusak di DB tidak bikin halaman ini error 500.
  const cleanGroups = normalizeCustomizationGroups(row.customization_options);

  const backHref = table ? `/menu?table=${table}` : "/menu";

  return (
    <div className="mx-auto max-w-3xl p-4 pb-28 sm:p-6">
      <Suspense fallback={null}>
        <TableSessionSync />
      </Suspense>

      <MenuDetail
        item={{
          id: row.id,
          name: row.name,
          description: row.description,
          price: Number(row.price),
          image_url: row.image_url,
          is_available: row.is_available,
          category_name: row.categories?.name ?? null,
        }}
        groups={cleanGroups}
        backHref={backHref}
      />
    </div>
  );
}