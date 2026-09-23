"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const menuSchema = z.object({
  name: z.string().min(2, "Nama menu wajib diisi"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Harga tidak boleh negatif"),
  cost_price: z.coerce.number().min(0, "HPP tidak boleh negatif"),
  category_id: z.string().uuid().optional().or(z.literal("")),
  is_available: z.coerce.boolean().default(true),
  customization_options: z.string().optional(), // JSON string dari form
});

export type MenuFormState = { error?: string };

const MAX_FILE_SIZE_MB = 3;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Upload foto menu ke Supabase Storage bucket `menu-images`.
 * Hanya bisa dipanggil oleh user dengan role 'owner' (dijaga RLS storage.objects).
 */
async function uploadMenuImage(file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Format gambar harus JPG, PNG, atau WEBP.");
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`Ukuran gambar maksimal ${MAX_FILE_SIZE_MB}MB.`);
  }

  const supabase = await createClient();
  const ext = file.name.split(".").pop();
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const filePath = `menu/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("menu-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Gagal upload gambar: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("menu-images").getPublicUrl(filePath);

  return publicUrl;
}

export async function createMenuItem(
  _prevState: MenuFormState,
  formData: FormData
): Promise<MenuFormState> {
  const parsed = menuSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    cost_price: formData.get("cost_price"),
    category_id: formData.get("category_id"),
    is_available: formData.get("is_available") === "on",
    customization_options: formData.get("customization_options"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const supabase = await createClient();

  // Pastikan yang memanggil benar-benar owner (defense in depth, selain RLS)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();

  if (profile?.role !== "owner") {
    return { error: "Hanya Owner yang boleh menambah menu." };
  }

  let imageUrl: string | null = null;
  const file = formData.get("image") as File | null;
  if (file && file.size > 0) {
    try {
      imageUrl = await uploadMenuImage(file);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Gagal upload gambar" };
    }
  }

  let customizationOptions: unknown = [];
  if (parsed.data.customization_options) {
    try {
      customizationOptions = JSON.parse(parsed.data.customization_options);
    } catch {
      return { error: "Format opsi kustomisasi tidak valid (harus JSON)." };
    }
  }

  const { error: insertError } = await supabase.from("menu_items").insert({
    name: parsed.data.name,
    description: parsed.data.description || null,
    price: parsed.data.price,
    cost_price: parsed.data.cost_price,
    category_id: parsed.data.category_id || null,
    is_available: parsed.data.is_available,
    image_url: imageUrl,
    customization_options: customizationOptions,
  });

  if (insertError) {
    return { error: `Gagal menyimpan menu: ${insertError.message}` };
  }

  revalidatePath("/admin/owner/menu");
  revalidatePath("/menu");
  redirect("/admin/owner/menu");
}

export async function updateMenuItem(
  menuId: string,
  _prevState: MenuFormState,
  formData: FormData
): Promise<MenuFormState> {
  const parsed = menuSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    cost_price: formData.get("cost_price"),
    category_id: formData.get("category_id"),
    is_available: formData.get("is_available") === "on",
    customization_options: formData.get("customization_options"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const supabase = await createClient();

  const updatePayload: Record<string, unknown> = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    price: parsed.data.price,
    cost_price: parsed.data.cost_price,
    category_id: parsed.data.category_id || null,
    is_available: parsed.data.is_available,
  };

  if (parsed.data.customization_options) {
    try {
      updatePayload.customization_options = JSON.parse(
        parsed.data.customization_options
      );
    } catch {
      return { error: "Format opsi kustomisasi tidak valid (harus JSON)." };
    }
  }

  const file = formData.get("image") as File | null;
  if (file && file.size > 0) {
    try {
      updatePayload.image_url = await uploadMenuImage(file);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Gagal upload gambar" };
    }
  }

  const { error: updateError } = await supabase
    .from("menu_items")
    .update(updatePayload)
    .eq("id", menuId);

  if (updateError) {
    return { error: `Gagal memperbarui menu: ${updateError.message}` };
  }

  revalidatePath("/admin/owner/menu");
  revalidatePath(`/menu/${menuId}`);
  revalidatePath("/menu");
  redirect("/admin/owner/menu");
}

export async function deleteMenuItem(menuId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").delete().eq("id", menuId);

  if (error) {
    throw new Error(`Gagal menghapus menu: ${error.message}`);
  }

  revalidatePath("/admin/owner/menu");
  revalidatePath("/menu");
}

export async function toggleMenuStock(menuId: string, isAvailable: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_items")
    .update({ is_available: isAvailable })
    .eq("id", menuId);

  if (error) {
    throw new Error(`Gagal update stok: ${error.message}`);
  }

  revalidatePath("/admin/owner/menu");
  revalidatePath("/menu");
}
