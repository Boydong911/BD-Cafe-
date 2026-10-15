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

// PENTING: pakai key "options" (bukan "choices") — ini yang dibaca seluruh
// aplikasi di app/menu, app/checkout, dan components/customer.
import type { CustomizationGroup } from "@/types/menu";

const GULA_ICE_SHOT: CustomizationGroup[] = [
  {
    name: "Gula",
    options: [
      { label: "Non Gula", price_delta: 0 },
      { label: "Gula", price_delta: 0 },
    ],
  },
  {
    name: "Suhu",
    options: [
      { label: "Ice", price_delta: 0 },
      { label: "Hot", price_delta: 0 },
    ],
  },
];

const CATEGORIES = ["Kopi Susu", "Manual Brew", "Non-Kopi", "Makanan Ringan"] as const;

const MENU_ITEMS: Array<{
  category: (typeof CATEGORIES)[number];
  name: string;
  description: string;
  price: number;
  cost_price: number;
  is_available: boolean;
  customization_options: CustomizationGroup[];
}> = [
  {
    category: "Kopi Susu",
    name: "Kopi Susu Gula Aren",
    description: "Espresso, susu segar, dan gula aren asli — signature kami.",
    price: 22000,
    cost_price: 9000,
    is_available: true,
    customization_options: GULA_ICE_SHOT,
  },
  {
    category: "Kopi Susu",
    name: "Caramel Macchiato",
    description: "Espresso dengan foam susu lembut dan saus karamel.",
    price: 26000,
    cost_price: 11000,
    is_available: true,
    customization_options: GULA_ICE_SHOT,
  },
  {
    category: "Kopi Susu",
    name: "Butterscotch Latte",
    description: "Latte creamy dengan sentuhan butterscotch manis gurih.",
    price: 27000,
    cost_price: 11500,
    is_available: false,
    customization_options: GULA_ICE_SHOT,
  },
  {
    category: "Manual Brew",
    name: "V60 Single Origin",
    description: "Biji kopi pilihan, diseduh manual untuk rasa yang bersih.",
    price: 28000,
    cost_price: 12000,
    is_available: true,
    customization_options: [],
  },
  {
    category: "Manual Brew",
    name: "Kopi Tubruk",
    description: "Kopi hitam tradisional, disajikan panas.",
    price: 15000,
    cost_price: 6000,
    is_available: true,
    customization_options: [],
  },
  {
    category: "Non-Kopi",
    name: "Matcha Latte",
    description: "Matcha grade premium dengan susu segar.",
    price: 25000,
    cost_price: 10500,
    is_available: true,
    customization_options: GULA_ICE_SHOT,
  },
  {
    category: "Non-Kopi",
    name: "Chocolate Frappe",
    description: "Cokelat dingin diblender dengan whipped cream.",
    price: 24000,
    cost_price: 10000,
    is_available: true,
    customization_options: [],
  },
  {
    category: "Makanan Ringan",
    name: "Croissant Almond",
    description: "Croissant renyah dengan taburan almond panggang.",
    price: 18000,
    cost_price: 8000,
    is_available: true,
    customization_options: [],
  },
  {
    category: "Makanan Ringan",
    name: "French Fries",
    description: "Kentang goreng renyah dengan saus sambal & mayo.",
    price: 17000,
    cost_price: 6500,
    is_available: true,
    customization_options: [],
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

  // 1) Pastikan semua kategori ada (insert kalau belum)
  const categoryIdByName = new Map<string, string>();

  for (let i = 0; i < CATEGORIES.length; i++) {
    const name = CATEGORIES[i];

    const { data: existing, error: findError } = await supabaseAdmin
      .from("categories")
      .select("id")
      .eq("name", name)
      .maybeSingle();

    if (findError) throw findError;

    if (existing) {
      categoryIdByName.set(name, existing.id);
      continue;
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("categories")
      .insert({ name, sort_order: i })
      .select("id")
      .single();

    if (insertError) throw insertError;

    categoryIdByName.set(name, inserted.id);
    console.log(`✅ Kategori dibuat: ${name}`);
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

    const { error: insertError } = await supabaseAdmin.from("menu_items").insert({
      category_id: categoryIdByName.get(item.category)!,
      name: item.name,
      description: item.description,
      price: item.price,
      cost_price: item.cost_price,
      image_url: null,
      is_available: item.is_available,
      customization_options: item.customization_options,
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