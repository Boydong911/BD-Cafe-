/**
 * Jalankan sekali di awal untuk membuat akun Owner default:
 *   Username: xxxx
 *   Password: xxxx
 *
 * Password akan otomatis di-hash (bcrypt) oleh Supabase Auth saat
 * disimpan ke auth.users — kita tidak pernah menangani hashing manual.
 *
 * Cara jalankan:
 *   1. Isi .env.local (butuh SUPABASE_SERVICE_ROLE_KEY, JANGAN dipakai di client!)
 *   2. npx tsx scripts/seed-owner.ts
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

const OWNER_USERNAME = "xxxx";
const OWNER_PASSWORD = "xxxx";
const OWNER_INTERNAL_EMAIL = `${OWNER_USERNAME}@cafe.internal`;

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Pastikan NEXT_PUBLIC_SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY terisi di .env.local");
  }

  const supabaseAdmin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Buat user di Supabase Auth (password otomatis di-hash oleh Supabase)
  const { data: userData, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email: OWNER_INTERNAL_EMAIL,
      password: OWNER_PASSWORD,
      email_confirm: true,
    });

  if (createError) {
    throw createError;
  }

  // 2) Insert baris profile dengan role 'owner'
  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: userData.user.id,
    username: OWNER_USERNAME,
    full_name: "Boy (Owner)",
    role: "owner",
  });

  if (profileError) {
    throw profileError;
  }

  console.log("✅ Akun owner berhasil dibuat:");
  console.log(`   username: ${OWNER_USERNAME}`);
  console.log(`   password: ${OWNER_PASSWORD}`);
}

main().catch((err) => {
  console.error("❌ Gagal seed owner:", err);
  process.exit(1);
});