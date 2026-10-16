/**
 * Seed kategori & menu awal supaya halaman /menu tidak kosong.
 * Pakai Service Role Key (bypass RLS) — sama seperti seed-owner.ts.
 *
 * Cara jalankan:
 *   npx tsx scripts/seed-menu.ts
 *
 * Aman dijalankan berkali-kali: kategori & menu dicek dulu by name
 * sebelum insert, jadi tidak akan bikin duplikat kalau di-run ulang.
 */
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";

// tsx/node menjalankan file ini DI LUAR Next.js, jadi .env.local tidak
// otomatis terbaca seperti saat `next dev`. Baris ini memaksa Node membaca
// .env.local dengan cara yang SAMA PERSIS seperti Next.js melakukannya.
loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Opsi kustomisasi TIDAK ditulis manual di sini lagi. Sumber tunggalnya ada di
// lib/menu-defaults.ts — sama persis dengan yang dipakai createMenuItem() saat
// owner menambah menu lewat dashboard. Menu drink dapat Gula + Suhu,
// menu food tidak dapat apa-apa.
//
// PENTING: grup memakai key "options" (bukan "choices") — itulah yang dibaca
// seluruh aplikasi di app/menu, app/checkout, dan components/customer.
import { defaultOptionsForCategory, toJsonOptions } from "../lib/menu-defaults";

/**
 * Struktur kategori dua tingkat.
 *   parent_id = null  -> kategori tingkat atas (hanya untuk mengelompokkan)
 *   parent_id = UUID   -> sub-kategori tempat menu benar-benar menempel
 */
const CATEGORY_TREE = [
  { name: "Minuman", parent: null, isDrink: false, sortOrder: 1 },
  { name: "Makanan", parent: null, isDrink: false, sortOrder: 2 },

  { name: "Kopi", parent: "Minuman", isDrink: true, sortOrder: 10 },
  { name: "Non-Kopi", parent: "Minuman", isDrink: true, sortOrder: 11 },
  { name: "Manual Brew", parent: "Minuman", isDrink: true, sortOrder: 12 },

  { name: "Berat", parent: "Makanan", isDrink: false, sortOrder: 20 },
  { name: "Ringan", parent: "Makanan", isDrink: false, sortOrder: 21 },
] as const;

const MENU_ITEMS: Array<{
  category: (typeof CATEGORY_TREE)[number]["name"];
  name: string;
  description: string;
  price: number;
  cost_price: number;
  is_available: boolean;
}> = [
  {
    category: "Kopi",
    name: "Kopi Susu Gula Aren",
    description: "Espresso, susu segar, dan gula aren asli — signature kami.",
    price: 22000,
    cost_price: 9000,
    is_available: true,
  },
  {
    category: "Kopi",
    name: "Caramel Macchiato",
    description: "Espresso dengan foam susu lembut dan saus karamel.",
    price: 26000,
    cost_price: 11000,
    is_available: true,
  },
  {
    category: "Kopi",
    name: "Butterscotch Latte",
    description: "Latte creamy dengan sentuhan butterscotch manis gurih.",
    price: 27000,
    cost_price: 11500,
    is_available: false,
  },
  {
    category: "Manual Brew",
    name: "V60 Single Origin",
    description: "Biji kopi pilihan, diseduh manual untuk rasa yang bersih.",
    price: 28000,
    cost_price: 12000,
    is_available: true,
  },
  {
    category: "Manual Brew",
    name: "Kopi Tubruk",
    description: "Kopi hitam tradisional, disajikan panas.",
    price: 15000,
    cost_price: 6000,
    is_available: true,
  },
  {
    category: "Non-Kopi",
    name: "Matcha Latte",
    description: "Matcha grade premium dengan susu segar.",
    price: 25000,
    cost_price: 10500,
    is_available: true,
  },
  {
    category: "Non-Kopi",
    name: "Chocolate Frappe",
    description: "Cokelat dingin diblender dengan whipped cream.",
    price: 24000,
    cost_price: 10000,
    is_available: true,
  },
  {
    category: "Ringan",
    name: "Croissant Almond",
    description: "Croissant renyah dengan taburan almond panggang.",
    price: 18000,
    cost_price: 8000,
    is_available: true,
  },
  {
    category: "Ringan",
    name: "French Fries",
    description: "Kentang goreng renyah dengan saus sambal & mayo.",
    price: 17000,
    cost_price: 6500,
    is_available: true,
  },
];

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      "Pastikan NEXT_PUBLIC_SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY terisi di .env.local"
    );
  }

  const supabaseAdmin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Pastikan semua kategori ada (insert kalau belum).
  //    Diurutkan dua tahap supaya induk selalu dibuat sebelum sub-kategori —
  //    foreign key parent_id butuh id induknya sudah ada.
  const categoryIdByName = new Map<string, string>();
  const categoryIsDrink = new Map<string, boolean>();

  const ordered = [
    ...CATEGORY_TREE.filter((c) => c.parent === null),
    ...CATEGORY_TREE.filter((c) => c.parent !== null),
  ];

  for (const spec of ordered) {
    const { data: existing, error: findError } = await supabaseAdmin
      .from("categories")
      .select("id")
      .eq("name", spec.name)
      .maybeSingle();

    if (findError) throw findError;

    let id: string;
    if (existing) {
      id = existing.id;
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("categories")
        .insert({
          name: spec.name,
          sort_order: spec.sortOrder,
          is_drink: spec.isDrink,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      id = inserted.id;
      console.log(`✅ Kategori dibuat: ${spec.name}`);
    }

    categoryIdByName.set(spec.name, id);
    categoryIsDrink.set(spec.name, spec.isDrink);
  }

  // Sambungkan sub-kategori ke induknya (aman dijalankan berulang).
  for (const spec of CATEGORY_TREE) {
    if (!spec.parent) continue;

    const parentId = categoryIdByName.get(spec.parent);
    const childId = categoryIdByName.get(spec.name);
    if (!parentId || !childId) continue;

    const { error: linkError } = await supabaseAdmin
      .from("categories")
      .update({ parent_id: parentId, is_drink: spec.isDrink })
      .eq("id", childId);

    if (linkError) throw linkError;
  }

  // 2) Insert menu item kalau nama belum ada
  for (const item of MENU_ITEMS) {
    const { data: existing, error: findError } = await supabaseAdmin
      .from("menu_items")
      .select("id")
      .eq("name", item.name)
      .maybeSingle();

    if (findError) throw findError;

    if (existing) {
      console.log(`↷ Lewati (sudah ada): ${item.name}`);
      continue;
    }

    // Opsi kustomisasi ikut kategori: drink -> Gula + Suhu, makanan -> [].
    const isDrink = categoryIsDrink.get(item.category) ?? false;

    const { error: insertError } = await supabaseAdmin.from("menu_items").insert({
      category_id: categoryIdByName.get(item.category)!,
      name: item.name,
      description: item.description,
      price: item.price,
      cost_price: item.cost_price,
      image_url: null,
      is_available: item.is_available,
      customization_options: toJsonOptions(defaultOptionsForCategory(isDrink)),
    });

    if (insertError) throw insertError;

    console.log(`✅ Menu dibuat: ${item.name}`);
  }

  console.log("\n🎉 Seed menu selesai. Buka /menu untuk cek hasilnya.");
}

main().catch((err) => {
  console.error("❌ Gagal seed menu:", err);
  process.exit(1);
});