import type { CustomizationGroup } from "@/types/menu";

/**
 * Normalisasi kolom `menu_items.customization_options` (jsonb) menjadi array
 * grup yang aman dipakai di UI.
 *
 * Kenapa perlu: data di database pernah salah format (key "choices" alih-alih
 * "options", atau grup tanpa daftar opsi). Tanpa normalisasi, `g.options.filter()`
 * melempar TypeError dan seluruh halaman detail menu jadi error 500.
 *
 * Aturan: grup tanpa nama atau tanpa opsi valid dibuang, bukan dibiarkan error.
 */
export function normalizeCustomizationGroups(raw: unknown): CustomizationGroup[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (g): g is CustomizationGroup =>
        !!g && typeof g.name === "string" && g.name.trim() !== ""
    )
    .map((g) => ({
      ...g,
      options: Array.isArray(g.options)
        ? g.options.filter((o) => !!o && typeof o.label === "string" && o.label.trim() !== "")
        : [],
    }))
    .filter((g) => g.options.length > 0);
}
