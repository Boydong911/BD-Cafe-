-- =========================================================
-- ROLLBACK: 2026-10-19 - Perbaiki pgcrypto tidak ketemu
--
-- Mengembalikan search_path ketiga fungsi ke `public`.
--
-- PERINGATAN: rollback mengembalikan BUG ASAL. Pendaftaran karyawan gagal
-- dengan "function gen_salt(unknown) does not exist", kalau pgcrypto ada
-- di schema `extensions`.
--
-- Ekstensi pgcrypto sengaja TIDAK di-drop di sini. Ia mungkin dipakai
-- function lain di database, dan menghapusnya tidak bisa dibatalkan tanpa
-- memasang ulang.
--
-- Kalau baris `create extension` di migrasi asli perlu dibatalkan juga,
-- jalankan manual HANYA setelah memastikan tidak ada function lain yang
-- memakainya:
--   drop extension if exists pgcrypto;
-- =========================================================

alter function public.create_staff_account(text, text, text)
  set search_path = public;

alter function public.register_staff_account(text, text, text)
  set search_path = public;

alter function public.reset_staff_password(uuid, text)
  set search_path = public;