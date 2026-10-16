-- =========================================================
-- ROLLBACK: 2026-10-17 — Fungsi admin kelola karyawan
--
-- Menghapus kelima function yang dibuat migrasi ini.
--
-- ⚠️ TIDAK menghapus akun karyawan yang sudah dibuat lewat dashboard.
--    Akun itu ada di auth.users dan tetap bisa login. Untuk menonaktifkan
--    semua kasir sekaligus, jalankan manual di SQL Editor:
--
--      delete from auth.users
--       where id in (
--         select id from public.profiles where role = 'kasir'
--       );
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- =========================================================

drop function if exists public.register_staff_account(text, text, text);
drop function if exists public.delete_staff_account(uuid);
drop function if exists public.update_staff_profile(uuid, text);
drop function if exists public.reset_staff_password(uuid, text);
drop function if exists public.create_staff_account(text, text, text);
drop function if exists public.list_staff();
drop function if exists public._bd_require_owner();

-- ---------------------------------------------------------
-- VERIFIKASI: semua function harus hilang
-- ---------------------------------------------------------
select proname
from pg_proc
where proname in (
  'list_staff', 'create_staff_account', 'register_staff_account',
  'reset_staff_password', 'update_staff_profile', 'delete_staff_account',
  '_bd_require_owner'
);
-- Hasilnya harus kosong.
