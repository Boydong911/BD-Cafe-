// File: app/admin/owner/karyawan/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

/**
 * Bentuk yang selalu punya `error`, biar komponen boleh akses `state.error`
 * tanpa narrowing di setiap tempat. `useActionState` butuh initial state,
 * jadi kita pakai bentuk longgar ini hanya untuk nilai awalnya.
 */
export type ActionState = {
  success: boolean;
  message?: string;
  error?: string;
};

/**
 * Semua operasi di sini memanggil function SQL `SECURITY DEFINER`
 * (lihat supabase/migrations/20261017-create-staff.sql).
 *
 * Function tersebut sudah menolak pemanggil yang bukan owner, jadi kita tidak
 * perlu cek role lagi di sini. Tetap kita cek, supaya kalau migrasi belum
 * dijalankan pesannya jelas ("jalankan migrasi") dan bukan error Postgres yang
 * membingungkan.
 */
async function requireOwner() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, ok: false as const, error: "Belum masuk." };

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

function revalidateStaff() {
  revalidatePath("/admin/owner/karyawan");
}

const createSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter")
    .max(30, "Username maksimal 30 karakter")
    // Email internal dibuat dari username, jadi karakter '@' tidak boleh ikut.
    .regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, _ dan -"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  full_name: z.string().trim().max(100).optional().nullable(),
});

export async function createStaff(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = createSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    full_name: formData.get("full_name") || null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Kasir harus terikat satu outlet (hidden input dari halaman karyawan).
  const outletId = String(formData.get("outlet_id") ?? "");
  if (!z.string().uuid().safeParse(outletId).success) {
    return { success: false, error: "Outlet wajib dipilih." };
  }

  const { supabase, ok, error: authError } = await requireOwner();
  if (!ok) return { success: false, error: authError ?? "Akses ditolak." };

  const { data, error } = await supabase.rpc("create_staff_account", {
    p_username: parsed.data.username,
    p_password: parsed.data.password,
    p_full_name: parsed.data.full_name,
    p_outlet_id: outletId,
  });

  if (error) {
    // Pesan error dari RPC sengaja dibuat enak dibaca (lihat file migrasi),
    // jadi aman ditampilkan apa adanya ke owner.
    return { success: false, error: error.message };
  }

  revalidateStaff();
  return { success: true, message: `Karyawan ${parsed.data.username} berhasil dibuat.` };
}

const resetSchema = z.object({
  staffId: z.string().uuid("Data tidak valid."),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export async function resetStaffPassword(
  staffId: string,
  password: string
): Promise<ActionResult> {
  const parsed = resetSchema.safeParse({ staffId, password });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { supabase, ok, error: authError } = await requireOwner();
  if (!ok) return { success: false, error: authError ?? "Akses ditolak." };

  const { error } = await supabase.rpc("reset_staff_password", {
    p_staff_id: parsed.data.staffId,
    p_new_password: parsed.data.password,
  });

  if (error) return { success: false, error: error.message };

  revalidateStaff();
  return { success: true, message: "Password berhasil diganti." };
}

export async function updateStaffName(
  staffId: string,
  fullName: string
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(staffId).success) {
    return { success: false, error: "Data tidak valid." };
  }
  if (fullName.trim().length > 100) {
    return { success: false, error: "Nama terlalu panjang." };
  }

  const { supabase, ok, error: authError } = await requireOwner();
  if (!ok) return { success: false, error: authError ?? "Akses ditolak." };

  const { error } = await supabase.rpc("update_staff_profile", {
    p_staff_id: staffId,
    p_full_name: fullName,
  });

  if (error) return { success: false, error: error.message };

  revalidateStaff();
  return { success: true };
}

/**
 * Hapus karyawan. Akun langsung hilang dari sistem login.
 *
 * Akun owner sendiri ditolak oleh function SQL — jadi tidak mungkin owner
 * mengunci dirinya sendiri keluar dari dashboard.
 */
export async function deleteStaff(staffId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(staffId).success) {
    return { success: false, error: "Data tidak valid." };
  }

  const { supabase, ok, error: authError } = await requireOwner();
  if (!ok) return { success: false, error: authError ?? "Akses ditolak." };

  const { error } = await supabase.rpc("delete_staff_account", {
    p_staff_id: staffId,
  });

  if (error) return { success: false, error: error.message };

  revalidateStaff();
  return { success: true, message: "Karyawan dihapus." };
}

const moveSchema = z.object({
  staffId: z.string().uuid("Data tidak valid."),
  outletId: z.string().uuid("Data tidak valid."),
});

/**
 * Pindahkan kasir ke outlet lain. Jalannya lewat RPC move_staff_account —
 * profiles tidak punya policy UPDATE untuk owner di RLS, jadi function
 * SECURITY DEFINER-lah yang berhak menggeser outlet_id.
 */
export async function moveStaff(
  staffId: string,
  outletId: string
): Promise<ActionResult> {
  const parsed = moveSchema.safeParse({ staffId, outletId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { supabase, ok, error: authError } = await requireOwner();
  if (!ok) return { success: false, error: authError ?? "Akses ditolak." };

  const { error } = await supabase.rpc("move_staff_account", {
    p_staff_id: parsed.data.staffId,
    p_outlet_id: parsed.data.outletId,
  });

  if (error) return { success: false, error: error.message };

  revalidateStaff();
  return { success: true, message: "Karyawan dipindahkan ke outlet baru." };
}
