import type { CustomizationGroup } from "@/types/menu";
import type { Json } from "@/types/database.types";

/**
 * Opsi kustomisasi default untuk kategori MINUMAN.
 *
 * Ini satu-satunya sumber kebenaran. Dipakai oleh:
 *   - `createMenuItem()`  -> menu baru langsung dapat tombol Gula + Ice/Hot
 *   - `menu/new/page.tsx` -> pratinjau ke owner apa yang akan menempel
 *   - `scripts/seed-menu.ts` -> seeding
 *
 * Menu MAKANAN tidak punya opsi apa pun (`[]`), jadi di kartu menunya tidak
 * muncul tombol Gula maupun Ice/Hot.
 */
export const DEFAULT_DRINK_OPTIONS: CustomizationGroup[] = [
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

/** Menu makanan: tanpa opsi. */
export const NO_CUSTOMIZATION_OPTIONS: CustomizationGroup[] = [];

/**
 * Pilih opsi kustomisasi berdasarkan kategori menu.
 *
 * `isDrink` diambil dari kolom `categories.is_drink` — BUKAN dari nama
 * kategori, supaya kategori baru seperti "Kue" atau "Dessert" tidak
 * salah dapat tombol Ice/Hot.
 */
export function defaultOptionsForCategory(isDrink: boolean): CustomizationGroup[] {
  return isDrink ? DEFAULT_DRINK_OPTIONS : NO_CUSTOMIZATION_OPTIONS;
}

/** Bentuk JSON untuk disimpan ke kolom `menu_items.customization_options`. */
export function toJsonOptions(groups: CustomizationGroup[]): Json {
  return groups as unknown as Json;
}

/** Ringkasan satu kalimat untuk ditampilkan di form. */
export function describeOptions(isDrink: boolean): string {
  return isDrink
    ? "Menu minuman otomatis dapat tombol Gula (Non Gula / Gula) dan Suhu (Ice / Hot)."
    : "Menu makanan tidak punya tombol kustomisasi.";
}
