-- =========================================================
-- MIGRASI BACKUP — WAJIB JALANKAN INI DULUAN
--
-- File   : supabase/migrations/20261015-backup-menu-customization.sql
-- Waktu  : SEBELUM menjalankan 20261015-fix-customizations-and-order-number.sql
-- Tujuan : menyimpan snapshot kolom `menu_items.customization_options`
--          supaya seluruh perubahan bisa DIBATALKAN (lihat file rollback).
--
-- Cara pakai: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Script ini idempotent, aman dijalankan berkali-kali.
-- =========================================================

-- 1) Backup SELURUH baris menu_items (id + nilai customization_options sekarang)
create table if not exists public._bak_menu_customization_20261015 (
  id                    uuid primary key,
  name                  text,
  customization_options jsonb,
  backed_up_at          timestamptz not null default now()
);

-- Kalau tabel backup sudah ada, selaraskan isinya dengan kondisi database sekarang.
insert into public._bak_menu_customization_20261015 (id, name, customization_options)
select id, name, customization_options
from public.menu_items
on conflict (id) do update
  set name                  = excluded.name,
      customization_options = excluded.customization_options;

-- 2) Simpan definisi default lama order_number supaya bisa dikembalikan persis
create table if not exists public._bak_schema_notes_20261015 (
  note_key   text primary key,
  note_value text not null,
  saved_at   timestamptz not null default now()
);

insert into public._bak_schema_notes_20261015 (note_key, note_value)
values (
  'orders.order_number.default',
  coalesce(
    (select column_default
     from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'orders'
       and column_name  = 'order_number'),
    '::text'
  )
)
on conflict (note_key) do nothing;

-- 3) Cek hasilnya — pastikan jumlah backup = jumlah menu_items
select
  (select count(*) from public.menu_items)                    as total_menu,
  (select count(*) from public._bak_menu_customization_20261015) as jumlah_backup,
  (select note_value
     from public._bak_schema_notes_20261015
    where note_key = 'orders.order_number.default')          as default_order_number_lama;

-- ⚠️ PENTING: salin hasil query di atas (khususnya `jumlah_backup` dan
--    `default_order_number_lama`) ke catatanmu. Ini bukti bahwa backup berhasil.
--    Kalau jumlah_backup != total_menu, JANGAN lanjut ke file berikutnya.
