// File: app/admin/owner/outlet/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateOutletSlug } from "@/lib/outlets";
import type { Database } from "@/types/database.types";

export type OutletActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

export type OutletActionState = {
  success: boolean;
  message?: string;
  error?: string;
};

async function requireOwner() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { supabase, ok: false as const, error: "Belum masuk." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "owner") {
    return { supabase, ok: false as const, error: "Akses ditolak." };
  }

  return { supabase, ok: true as const, error: null };
}

function revalidateOutlet() {
  revalidatePath("/admin/owner/outlet");
  revalidatePath("/admin/owner/menu");
  revalidatePath("/admin/owner/meja");
  revalidatePath("/admin/owner/karyawan");
}

const createSchema = z.object({
  nama: z
    .string()
    .trim()
    .min(2, "Nama outlet minimal 2 karakter")
    .max(60, "Nama outlet maksimal 60 karakter"),
  // Kosong = tidak diisi; terisi harus bentuk tanggal.
  tanggal_bangun: z
    .string()
    .trim()
    .regex(/^(?:\d{4}-\d{2}-\d{2})?$/, "Tanggal tidak valid (YYYY-MM-DD)")
    .optional(),
  menu_mode: z.enum(["salinan", "sendiri"]),
});

export async function createOutlet(
  _prevState: OutletActionState,
  formData: FormData
): Promise<OutletActionState> {
  const parsed = createSchema.safeParse({
    nama: formData.get("nama"),
    tanggal_bangun: formData.get("tanggal_bangun") ?? "",
    menu_mode: formData.get("menu_mode") ?? "salinan",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { supabase, ok, error: authError } = await requireOwner();
  if (!ok) return { success: false, error: authError ?? "Akses ditolak." };

  const slug = await generateOutletSlug();

  const { data: outlet, error: insertError } = await supabase
    .from("outlets")
    .insert({
      slug,
      nama: parsed.data.nama,
      tanggal_bangun: parsed.data.tanggal_bangun || null,
      menu_mode: parsed.data.menu_mode,
    })
    .select("id, slug")
    .single();

  if (insertError || !outlet) {
    return { success: false, error: `Gagal membuat outlet: ${insertError?.message ?? "?"}` };
  }

  // Mode "salinan": menu pusat difotokopi SEKALI jadi milik outlet baru.
  // Setelah ini keduanya berdiri sendiri (ubah menu pusat tidak menyentuh salinan).
  let copied = 0;
  if (parsed.data.menu_mode === "salinan") {
    const { data: pusat } = await supabase
      .from("outlets")
      .select("id")
      .eq("is_pusat", true)
      .limit(1)
      .maybeSingle();

    if (pusat) {
      const { data: sourceItems } = await supabase
        .from("menu_items")
        .select("category_id, name, description, price, cost_price, image_url, is_available, customization_options")
        .eq("outlet_id", pusat.id);

      const payload = (sourceItems ?? []).map((item) => ({
        ...item,
        outlet_id: outlet.id,
      })) as unknown as Database["public"]["Tables"]["menu_items"]["Insert"][];

      if (payload.length > 0) {
        const { error: copyError, count } = await supabase
          .from("menu_items")
          .insert(payload);
        copied = copyError ? 0 : (count ?? payload.length);

        if (copyError) {
          return {
            success: false,
            error: `Outlet terbentuk, tapi penyalinan menu gagal: ${copyError.message}`,
          };
        }
      }
    }
  }

  revalidateOutlet();

  /*
   * Meja 1 otomatis: outlet baru langsung punya satu meja yang bisa
   * diberi QR. Gagal di sini TIDAK membatalkan outlet — meja bisa
   * ditambahkan manual di halaman Kelola Meja.
   */
  const { error: tableError } = await supabase.from("tables").insert({
    outlet_id: outlet.id,
    table_number: "1",
    label: "Meja 1",
  });

  const mejaNote = tableError
    ? "Meja 1 gagal dibuat otomatis — tambahkan manual di Kelola Meja."
    : "Meja 1 + QR otomatis siap di Kelola Meja.";

  return {
    success: true,
    message:
      copied > 0
        ? `Outlet "${parsed.data.nama}" dibuat (slug ${outlet.slug}) — ${copied} menu tersalin. ${mejaNote} Halaman publiknya: /${outlet.slug}/menu`
        : `Outlet "${parsed.data.nama}" dibuat (slug ${outlet.slug}). ${mejaNote} Halaman publiknya: /${outlet.slug}/menu`,
  };
}

const updateSchema = z.object({
  outletId: z.string().uuid("Data tidak valid."),
  nama: z
    .string()
    .trim()
    .min(2, "Nama outlet minimal 2 karakter")
    .max(60, "Nama outlet maksimal 60 karakter"),
  tanggal_bangun: z
    .string()
    .trim()
    .regex(/^(?:\d{4}-\d{2}-\d{2})?$/, "Tanggal tidak valid (YYYY-MM-DD)")
    .optional(),
});

/** Edit nama & tanggal bangun. Slug SENGAJA tidak bisa diedit (QR tercetak). */
export async function updateOutlet(
  outletId: string,
  nama: string,
  tanggalBangun: string
): Promise<OutletActionState> {
  const parsed = updateSchema.safeParse({
    outletId,
    nama,
    tanggal_bangun: tanggalBangun ?? "",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { supabase, ok, error: authError } = await requireOwner();
  if (!ok) return { success: false, error: authError ?? "Akses ditolak." };

  const { error } = await supabase
    .from("outlets")
    .update({
      nama: parsed.data.nama,
      tanggal_bangun: parsed.data.tanggal_bangun || null,
    })
    .eq("id", parsed.data.outletId);

  if (error) return { success: false, error: error.message };

  revalidateOutlet();
  return { success: true, message: "Outlet diperbarui." };
}

const archiveSchema = z.object({
  outletId: z.string().uuid("Data tidak valid."),
  isActive: z.boolean(),
});

/** Arsip = nonaktif (data aman, bisa dinyalakan lagi). Outlet pusat bebas arsip. */
export async function archiveOutlet(
  outletId: string,
  isActive: boolean
): Promise<OutletActionState> {
  const parsed = archiveSchema.safeParse({ outletId, isActive });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { supabase, ok, error: authError } = await requireOwner();
  if (!ok) return { success: false, error: authError ?? "Akses ditolak." };

  if (!parsed.data.isActive) {
    const { data: outlet } = await supabase
      .from("outlets")
      .select("is_pusat, nama")
      .eq("id", parsed.data.outletId)
      .maybeSingle();

    if (!outlet) return { success: false, error: "Outlet tidak ditemukan." };
    if (outlet.is_pusat) {
      return { success: false, error: "Outlet pusat tidak bisa diarsipkan." };
    }
  }

  const { error } = await supabase
    .from("outlets")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.outletId);

  if (error) return { success: false, error: error.message };

  revalidateOutlet();
  return {
    success: true,
    message: parsed.data.isActive
      ? "Outlet kembali aktif."
      : "Outlet diarsipkan — datanya tetap aman dan bisa dinyalakan lagi.",
  };
}
