-- =========================================================
-- MIGRASI: 2026-10-19 - Perbaiki pgcrypto tidak ketemu
--
-- GEJALA:
--   Daftar karyawan baru di /daftar gagal dengan:
--     function gen_salt(unknown) does not exist
--
-- AKAR MASALAH:
--   Tiga fungsi di 20261017-create-staff.sql memanggil crypt() dan
--   gen_salt() dari pgcrypto, tapi semuanya ditulis dengan
--   `set search_path = public`.
--
--   Di Supabase, extension TIDAK dipasang ke public. `create extension`
--   milik Supabase installing ke schema `extensions`. search_path = public
--   tidak pernah melihat ke sana, jadi Postgres tidak menemukan gen_salt,
--   padahal pgcrypto sebenarnya sudah terpasang.
--
--   Catatan: ini tidak ketahuan saat fungsi dibuat. Nama fungsi dari
--   pgcrypto dicek saat fungsi itu DIJALANKAN, bukan saat didefinisikan.
--   Jadi "create or replace function" berhasil tanpa error, dan errornya
--   baru muncul saat karyawan pertama didaftarkan.
--
--   Kemungkinan kedua yang sama-sama menutupi: pgcrypto belum terpasang
--   sama sekali di proyek ini. Baris pertama di bawah menutup kemungkinan
--   itu.
--
-- PERBAIKAN:
--   1. Pastikan pgcrypto terpasang.
--   2. Tambahkan `extensions` ke search_path ketiga fungsi yang memakainya.
--      public ditulis lebih dulu supaya kalau ternyata pgcrypto ada di
--      public, tidak ada yang berubah sama sekali.
--   3. Verifikasi, supaya kalau ternyata pgcrypto ada di schema ketiga
--      yang tidak terduga, errornya jelas dan bukan muncul lagi saat
--      pendaftaran.
--
-- YANG TIDAK BERUBAH:
--   Badannya fungsi tidak disentuh. CREATE OR REPLACE tidak dipakai karena
--   hanya setelan search_path yang berubah; ALTER FUNCTION cukup dan tidak
--   berisiko merusak body.
-- =========================================================

create extension if not exists pgcrypto;

alter function public.create_staff_account(text, text, text)
  set search_path = public, extensions;

alter function public.register_staff_account(text, text, text)
  set search_path = public, extensions;

alter function public.reset_staff_password(uuid, text)
  set search_path = public, extensions;

-- ---------------------------------------------------------
-- Verifikasi
-- ---------------------------------------------------------
do $$
declare
  v_ok     boolean;
  v_where  text;
begin
  select
    exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where p.proname = 'gen_salt'
        and n.nspname in ('public', 'extensions')
    ),
    coalesce(
      (
        select string_agg(n.nspname, ', ')
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where p.proname = 'gen_salt'
      ),
      '(tidak ditemukan sama sekali)'
    )
  into v_ok, v_where;

  if not v_ok then
    raise exception
      'gen_salt tidak ada di public maupun extensions (ditemukan di: %). Jalankan ALTER FUNCTION ... SET search_path = <schema>, public; untuk create_staff_account, register_staff_account, dan reset_staff_password.',
      v_where;
  end if;

  raise notice 'OK: gen_salt ketemu di public atau extensions.';
end;
$$;