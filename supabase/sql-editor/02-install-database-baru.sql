-- ============================================================================
-- 02-INSTALL-DATABASE-BARU — SKEMA LENGKAP BD CAFE
-- Dibangun otomatis: 2026-10-20
--
-- PERINGATAN: file ini HANYA untuk DATABASE BARU yang masih kosong
-- (contoh: membuat project Supabase baru, atau memulihkan total).
-- Di database yang sudah berjalan, file ini JANGAN dijalankan —
-- kebanyakan perintah create-nya sudah ada, eksekusi akan berhenti
-- di error, dan keadaan setengah-jalan itu yang membingungkan.
--
-- Isi = gabungan PERSIS (tanpa diedit) dari 17 file asli yang
-- dulu dijalankan satu per satu di SQL Editor, dalam urutan
-- tanggal pemasangannya. Setiap bagian dibuka dengan penanda
-- nomor urutan dan nama file aslinya (di bawah).
--
-- Cara aman: jalankan SEMUANYA sekaligus, lalu tunggu. Bila muncul
-- error, BERHENTI (jangan lanjut) dan catat pesan errornya.
-- Setelah selesai, jalankan 01-cek-kesehatan.sql untuk memastikan.
--
-- Catatan (20 Okt 2026): file ini DIBEKUKAN. Perubahan SETELAH tanggal
-- ini tidak ditambahkan ke sini, melainkan sebagai file baru di
-- supabase/migrations/ (aturan di 00-PROSEDUR.md bagian 4). Membangun
-- database baru dari nol = tempel file ini dulu, lalu jalankan
-- file-file migrations yang bertanggal sesudah 20 Okt, urut nama.
-- ============================================================================

-- ============================================================================
-- [1/17] asal: supabase/schema.sql
-- ============================================================================

-- =========================================================
-- CAFE/RESTORAN APP — SUPABASE SCHEMA
-- Jalankan di Supabase SQL Editor secara berurutan.
-- =========================================================

-- ---------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------
create type user_role as enum ('owner', 'kasir');
create type order_type as enum ('dine_in', 'takeaway');
create type payment_method as enum ('qris', 'cash');
create type payment_status as enum ('pending', 'paid');
create type order_status as enum (
  'pending',      -- baru masuk, menunggu konfirmasi kasir
  'confirmed',    -- dikonfirmasi kasir / pembayaran diterima
  'preparing',    -- sedang dibuat
  'ready',        -- siap diantar / diambil
  'completed',    -- selesai
  'cancelled'
);

-- ---------------------------------------------------------
-- 2. PROFILES (extends auth.users) — Owner & Kasir
-- ---------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique not null,
  full_name   text,
  role        user_role not null default 'kasir',
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'Data staff (owner/kasir), 1:1 dengan auth.users';

-- Function untuk menerjemahkan username -> email login internal.
-- SECURITY DEFINER supaya bisa dipanggil oleh 'anon' (belum login) saat proses login,
-- tapi HANYA mengembalikan email, tidak pernah mengembalikan password/hash.
create or replace function public.get_login_email(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.username = p_username
  limit 1;
$$;

revoke all on function public.get_login_email(text) from public;
grant execute on function public.get_login_email(text) to anon, authenticated;

-- ---------------------------------------------------------
-- 3. CATEGORIES
-- ---------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 4. MENU ITEMS
-- ---------------------------------------------------------
create table public.menu_items (
  id                      uuid primary key default gen_random_uuid(),
  category_id             uuid references public.categories (id) on delete set null,
  name                    text not null,
  description             text,
  price                   numeric(12,2) not null check (price >= 0),
  cost_price              numeric(12,2) not null default 0 check (cost_price >= 0), -- HPP
  image_url               text,
  is_available            boolean not null default true,
  -- Opsi kustomisasi disimpan sebagai JSON. WAJIB pakai key "options"
  -- (bukan "choices") karena itulah yang dibaca seluruh aplikasi:
  --   [
  --   { "name": "Gula", "options": [
  --       {"label":"Non Gula","price_delta":0},
  --       {"label":"Gula","price_delta":0}
  --   ]},
  --   { "name": "Suhu", "options": [
  --       {"label":"Ice","price_delta":0},{"label":"Hot","price_delta":0}
  --   ]}
  --   ]
  customization_options   jsonb not null default '[]'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_menu_items_category on public.menu_items (category_id);
create index idx_menu_items_available on public.menu_items (is_available);

-- ---------------------------------------------------------
-- 5. ORDERS
-- ---------------------------------------------------------
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  -- Nomor urut per hari: ORD-YYYYMMDD-01, -02, ... (diisi trigger, lihat
  -- migrations/20261015-fix-customizations-and-order-number.sql)
  order_number      text unique not null,
  customer_name     text not null,
  order_type        order_type not null,
  table_number      text,                    -- null jika takeaway
  notes             text,
  payment_method    payment_method not null,
  payment_status    payment_status not null default 'pending',
  status            order_status not null default 'pending',
  subtotal          numeric(12,2) not null default 0,
  total             numeric(12,2) not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint chk_table_number check (
    (order_type = 'dine_in'  and table_number is not null) or
    (order_type = 'takeaway' and table_number is null)
  )
);

create index idx_orders_status on public.orders (status);
create index idx_orders_created_at on public.orders (created_at);

-- ---------------------------------------------------------
-- 6. ORDER ITEMS
-- ---------------------------------------------------------
create table public.order_items (
  id                        uuid primary key default gen_random_uuid(),
  order_id                  uuid not null references public.orders (id) on delete cascade,
  menu_item_id              uuid references public.menu_items (id) on delete set null,
  menu_name                 text not null,     -- snapshot nama saat dipesan
  unit_price                numeric(12,2) not null,
  unit_cost                 numeric(12,2) not null default 0, -- snapshot HPP untuk laporan
  quantity                  int not null check (quantity > 0),
  selected_customizations   jsonb not null default '[]'::jsonb, -- pilihan gula/ice/shot yg dipilih
  subtotal                  numeric(12,2) not null,
  created_at                timestamptz not null default now()
);

create index idx_order_items_order on public.order_items (order_id);
create index idx_order_items_menu on public.order_items (menu_item_id);

-- ---------------------------------------------------------
-- 7. TRIGGER updated_at
-- ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_menu_items_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- 8. ROW LEVEL SECURITY
-- ---------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.categories   enable row level security;
alter table public.menu_items   enable row level security;
alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;

-- Helper: cek apakah user login adalah staff (owner/kasir)
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid()
  );
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'owner'
  );
$$;

-- PROFILES: staff hanya bisa lihat profil sendiri; owner bisa lihat semua
create policy "profiles_select_self_or_owner"
  on public.profiles for select
  using (id = auth.uid() or public.is_owner());

-- CATEGORIES: publik boleh baca, hanya owner boleh tulis
create policy "categories_public_read"
  on public.categories for select using (true);
create policy "categories_owner_write"
  on public.categories for all using (public.is_owner()) with check (public.is_owner());

-- MENU ITEMS: publik boleh baca semua (termasuk yang habis, biar UI bisa tampilkan
-- badge "Habis"); hanya owner boleh insert/update/delete
create policy "menu_items_public_read"
  on public.menu_items for select using (true);
create policy "menu_items_owner_write"
  on public.menu_items for insert with check (public.is_owner());
create policy "menu_items_owner_update"
  on public.menu_items for update using (public.is_owner()) with check (public.is_owner());
create policy "menu_items_owner_delete"
  on public.menu_items for delete using (public.is_owner());

-- ORDERS:
--  * Siapa saja (anon) boleh INSERT order baru (checkout customer)
--  * Hanya staff yang boleh SELECT daftar order & UPDATE status.
--
--  CATATAN PENTING (diperbaiki 2026-10-17):
--    Dulu ada policy "orders_public_select_by_id" dengan `using (true)` —
--    padahal namanya promising "by id". `using (true)` berarti SEMUA baris
--    lolos untuk SIAPA SAJA termasuk anon tanpa login, jadi siapa pun bisa
--    membaca seluruh riwayat pesanan: nama pelanggan, meja, total, catatan.
--    Policy itu sudah DIHAPUS.
--
--    Halaman customer (/order/[id] dan /order/[id]/pay) sekarang memakai RPC
--    `get_order_by_id(p_order_id)` / `get_order_items(p_order_id)` yang
--    SECURITY DEFINER dan hanya mengembalikan SATU baris untuk UUID tertentu.
--    UUID acak 122-bit tidak bisa ditebak, jadi model "punya link = punya
--    akses" tetap berlaku tanpa daftar pesanan ikut terbuka.
--
--    Konsekuensi: halaman customer tidak bisa pakai Realtime lagi (Realtime
--    tunduk pada RLS yang sama), jadi status di-poll tiap 4-5 detik lewat
--    `get_order_payment_state()`. Dashboard kasir tetap Realtime karena kasir
--    adalah staff.
create policy "orders_public_insert"
  on public.orders for insert with check (true);
create policy "orders_staff_select"
  on public.orders for select using (public.is_staff());
create policy "orders_staff_update"
  on public.orders for update using (public.is_staff()) with check (public.is_staff());

-- ORDER ITEMS: sama seperti orders — insert terbuka untuk anon (checkout),
-- select hanya staff. Halaman customer pakai RPC get_order_items().
create policy "order_items_public_insert"
  on public.order_items for insert with check (true);
create policy "order_items_staff_select"
  on public.order_items for select using (public.is_staff());
create policy "order_items_staff_update"
  on public.order_items for update using (public.is_staff());

-- ---------------------------------------------------------
-- 9. REALTIME
-- ---------------------------------------------------------
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;

-- ---------------------------------------------------------
-- 10. REPORTING FUNCTIONS (dipakai Dashboard Owner)
-- ---------------------------------------------------------

-- Ringkasan omzet/HPP/profit per bucket waktu ('hour' | 'day' | 'week' | 'month')
--
-- PENTING: bucket dihitung dalam zona waktu WIB, bukan UTC.
-- `date_trunc` pada timestamptz memakai TimeZone sesi Postgres (Supabase =
-- UTC). Tanpa konversi di bawah, bucket "hari" bergeser 7 jam dan kolom
-- "omzet hari ini" tidak cocok dengan nota yang benar-benar dicetak hari itu.
-- Lihat migrasi 20261016-sales-report-wib.sql.
create or replace function public.get_sales_report(
  p_period text,             -- 'hour' | 'day' | 'week' | 'month'
  p_start  timestamptz,
  p_end    timestamptz
)
returns table (
  bucket        timestamptz,
  omzet         numeric,
  cost          numeric,
  net_profit    numeric,
  total_orders  bigint
)
language sql stable security definer set search_path = public as $$
  select
    date_trunc(p_period, o.created_at at time zone 'Asia/Jakarta')
      at time zone 'Asia/Jakarta' as bucket,
    coalesce(sum(oi.subtotal), 0) as omzet,
    coalesce(sum(oi.unit_cost * oi.quantity), 0) as cost,
    coalesce(sum(oi.subtotal - (oi.unit_cost * oi.quantity)), 0) as net_profit,
    count(distinct o.id) as total_orders
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where o.status <> 'cancelled'
    and o.created_at between p_start and p_end
  group by bucket
  order by bucket;
$$;

-- Top 5 menu terlaris pada rentang tanggal tertentu
create or replace function public.get_top_menu(
  p_start  timestamptz,
  p_end    timestamptz,
  p_limit  int default 5
)
returns table (
  menu_item_id  uuid,
  menu_name     text,
  total_qty     bigint,
  total_omzet   numeric
)
language sql stable security definer set search_path = public as $$
  select
    oi.menu_item_id,
    oi.menu_name,
    sum(oi.quantity) as total_qty,
    sum(oi.subtotal) as total_omzet
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.status <> 'cancelled'
    and o.created_at between p_start and p_end
  group by oi.menu_item_id, oi.menu_name
  order by total_qty desc
  limit p_limit;
$$;

grant execute on function public.get_sales_report(text, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_top_menu(timestamptz, timestamptz, int) to authenticated;

-- File: supabase/schema.sql (simpan juga di project kamu buat riwayat)

create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  table_number text not null unique,
  label text, -- opsional, misal "Dekat Jendela", "VIP"
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Aktifkan RLS
alter table public.tables enable row level security;

-- Siapa aja (termasuk customer yang scan QR) boleh baca meja yang aktif
create policy "public read active tables"
  on public.tables for select
  using (is_active = true);

-- Owner boleh baca semua (termasuk yang nonaktif) buat kebutuhan manage
create policy "owner read all tables"
  on public.tables for select
  using (is_owner());

-- Cuma owner yang boleh tambah/ubah/hapus
create policy "owner insert tables"
  on public.tables for insert
  with check (is_owner());

create policy "owner update tables"
  on public.tables for update
  using (is_owner());

create policy "owner delete tables"
  on public.tables for delete
  using (is_owner());

-- ============================================================================
-- [2/17] asal: supabase/storage-policies.sql
-- ============================================================================

-- =========================================================
-- SUPABASE STORAGE — bucket `menu-images`
-- Buat bucket dulu lewat Dashboard atau SQL berikut:
-- =========================================================

insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

-- Siapa saja boleh membaca (foto menu tampil publik di katalog)
create policy "menu_images_public_read"
  on storage.objects for select
  using (bucket_id = 'menu-images');

-- Hanya user dengan role 'owner' yang boleh upload/update/hapus foto menu
create policy "menu_images_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'menu-images'
    and public.is_owner()
  );

create policy "menu_images_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'menu-images'
    and public.is_owner()
  );

create policy "menu_images_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'menu-images'
    and public.is_owner()
  );

-- ============================================================================
-- [3/17] asal: supabase/migrations/20261015-backup-menu-customization.sql
-- ============================================================================

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

-- ============================================================================
-- [4/17] asal: supabase/migrations/20261015-fix-customizations-and-order-number.sql
-- ============================================================================

-- =========================================================
-- MIGRASI: 2026-10-15
--  1) Normalisasi customization_options (key "choices" -> "options")
--     Menu minuman dapat grup Gula + Suhu, makanan tidak.
--  2) order_number jadi BERURUTAN per hari: ORD-YYYYMMDD-01, -02, -03 ...
--     (sebelumnya acak 4 digit)
--
-- ⚠️ WAJIB jalankan file ini SEBELUM file ini:
--    20261015-backup-menu-customization.sql
--
-- Untuk membatalkan semua perubahan: jalankan 20261015-rollback.sql
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Script ini aman diulang (idempotent).
-- =========================================================

-- ---------------------------------------------------------
-- 0. KEAMANAN: pastikan backup sudah ada sebelum menimpa data
-- ---------------------------------------------------------
do $$
declare
  v_total int;
  v_bak   int;
begin
  select count(*) into v_total from public.menu_items;
  select count(*) into v_bak
    from public._bak_menu_customization_20261015;

  if v_bak = 0 then
    raise exception
      'BACKUP BELUM ADA. Jalankan 20261015-backup-menu-customization.sql dulu - migrasi dibatalkan agar data tidak hilang.';
  end if;

  if v_bak < v_total then
    raise warning
      'Backup hanya % dari % menu. Lanjutkan hanya kalau ini disengaja.', v_bak, v_total;
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 1. DATA KUSTOMISASI
-- ---------------------------------------------------------

-- 1a. Pastikan kolom berisi array yang valid
update public.menu_items
set customization_options = '[]'::jsonb
where jsonb_typeof(customization_options) is distinct from 'array';

-- 1b. Menu MINUMAN (semua kategori kecuali "Makanan Ringan")
--     dapat 2 grup: Gula (Non Gula / Gula) dan Suhu (Ice / Hot)
update public.menu_items mi
set customization_options = jsonb_build_array(
  jsonb_build_object(
    'name', 'Gula',
    'options', jsonb_build_array(
      jsonb_build_object('label', 'Non Gula', 'price_delta', 0),
      jsonb_build_object('label', 'Gula',     'price_delta', 0)
    )
  ),
  jsonb_build_object(
    'name', 'Suhu',
    'options', jsonb_build_array(
      jsonb_build_object('label', 'Ice', 'price_delta', 0),
      jsonb_build_object('label', 'Hot', 'price_delta', 0)
    )
  )
)
where exists (
  select 1
  from public.categories c
  where c.id = mi.category_id
    and c.name <> 'Makanan Ringan'
);

-- 1c. MAKANAN & menu tanpa kategori -> tidak ada opsi kustomisasi
update public.menu_items mi
set customization_options = '[]'::jsonb
where not exists (
  select 1
  from public.categories c
  where c.id = mi.category_id
    and c.name <> 'Makanan Ringan'
);

-- ---------------------------------------------------------
-- 2. NOMOR PESANAN BERURUTAN PER HARI
-- ---------------------------------------------------------

-- Hapus default acak yang lama; nomornya diisi trigger di bawah.
alter table public.orders alter column order_number drop default;

create or replace function public.next_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_seq  int;
begin
  -- Advisory lock supaya 2 pesanan yang masuk bersamaan
  -- tidak mendapat nomor yang sama.
  perform pg_advisory_xact_lock(hashtext('bd_coffee_order_number')::bigint);

  select count(*)::int + 1
    into v_seq
    from public.orders
   where (created_at at time zone 'Asia/Jakarta')::date = v_today;

  return 'ORD-' || to_char(v_today, 'YYYYMMDD') || '-' || lpad(v_seq::text, 2, '0');
end;
$$;

create or replace function public.trg_orders_set_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := public.next_order_number();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_order_number on public.orders;
create trigger trg_orders_order_number
  before insert on public.orders
  for each row execute function public.trg_orders_set_order_number();

-- ---------------------------------------------------------
-- 3. VERIFIKASI (hasilnya harus 0 baris)
--    Kalau muncul baris, masih ada data yang belum sesuai format "options"
-- ---------------------------------------------------------
select mi.name, mi.customization_options
from public.menu_items mi
where exists (
  select 1
  from jsonb_array_elements(mi.customization_options) as grp(raw)
  where raw ? 'choices'
     or not (raw ? 'options')
);

-- ============================================================================
-- [5/17] asal: supabase/migrations/20261016-category-groups.sql
-- ============================================================================

-- =========================================================
-- MIGRASI: 2026-10-16 — Kategori dua tingkat (Minuman / Makanan)
--
-- TUJUAN:
--   1. Kategori jadi dua tingkat. "Minuman" dan "Makanan" adalah induk
--      (parent_id IS NULL), sub-kategori nempel ke induknya:
--        Minuman -> Kopi, Non-Kopi, Manual Brew
--        Makanan -> Berat, Ringan
--   2. Kolom `is_drink` menandai sub-kategori yang_is_minuman. Ini yang
--      membuat menu minuman otomatis dapat tombol Gula + Ice/Hot, sementara
--      menu makanan tidak.
--
--   Tanpa `is_drink`, kita hanya bisa menebak dari NAMA kategori — rapuh,
--   dan langsung salah begitu ada kategori baru seperti "Kue" atau "Dessert".
--
-- PERUBAHAN DATA:
--   - "Kopi Susu"     -> "Kopi"
--   - "Makanan Ringan"-> "Ringan"  (menu di dalamnya tetap nempel, karena
--                                    yang diubah cuma nama barisnya)
--   - tambah "Berat" (kosong, siap diisi)
--   - tambah induk "Minuman" & "Makanan"
--   - tiap menu MINUMAN yang belum punya opsi kustomisasi dikasih Gula + Suhu
--   - tiap menu MAKANAN yang opsinya persis sama dengan default minum
--     dikosongkan (kexcepta opsi khusus yang sengaja dibuat owner, itu
--     tidak disentuh)
--
-- ⚠️ Jalankan setelah 20261016-queue-number-on-confirmation.sql
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Script ini idempotent, aman diulang.
-- =========================================================

-- ---------------------------------------------------------
-- 1. KOLOM BARU
-- ---------------------------------------------------------
alter table public.categories
  add column if not exists parent_id uuid
    references public.categories (id) on delete set null;

alter table public.categories
  add column if not exists is_drink boolean not null default false;

comment on column public.categories.parent_id is
  'Kategori induk. NULL = kategori tingkat atas (Minuman / Makanan).';
comment on column public.categories.is_drink is
  'True bila kategori ini minuman -> menu-nya dapat opsi Gula + Ice/Hot.';

create index if not exists idx_categories_parent
  on public.categories (parent_id);

-- Fungsi bantu: ambil id kategori berdasarkan nama (aman kalau belum ada).
-- Dipakai ulang supaya seluruh migrasi ini bisa dijalankan berulang.
create or replace function public._bd_cat_id(p_name text)
returns uuid
language sql stable as $$
  select id from public.categories where name = p_name limit 1;
$$;

-- ---------------------------------------------------------
-- 2. INDUK: Minuman & Makanan
-- ---------------------------------------------------------
insert into public.categories (name, sort_order, is_drink)
values ('Minuman', 1, false), ('Makanan', 2, false)
on conflict (name) do nothing;

-- ---------------------------------------------------------
-- 3. GANTI NAMA + TAMBAH KATEGORI BARU
-- ---------------------------------------------------------
update public.categories set name = 'Kopi' where name = 'Kopi Susu';
update public.categories set name = 'Ringan' where name = 'Makanan Ringan';

insert into public.categories (name, sort_order, is_drink)
values ('Berat', 20, false)
on conflict (name) do nothing;

-- ---------------------------------------------------------
-- 4. SAMBUNGKAN SUB-KATEGORI KE INDUKNYA
-- ---------------------------------------------------------
update public.categories
   set parent_id = public._bd_cat_id('Minuman'),
       is_drink  = true
 where name in ('Kopi', 'Non-Kopi', 'Manual Brew');

update public.categories
   set parent_id = public._bd_cat_id('Makanan'),
       is_drink  = false,
       sort_order = case name when 'Berat' then 20 else 21 end
 where name in ('Berat', 'Ringan');

-- Rapikan urutan sub-kategori minuman.
update public.categories set sort_order = 10 where name = 'Kopi';
update public.categories set sort_order = 11 where name = 'Non-Kopi';
update public.categories set sort_order = 12 where name = 'Manual Brew';

-- ---------------------------------------------------------
-- 5. BACKFILL OPSI KUSTOMISASI MENU
-- ---------------------------------------------------------
do $$
declare
  v_default constant jsonb := '[{"name":"Gula","options":[{"label":"Non Gula","price_delta":0},{"label":"Gula","price_delta":0}]},{"name":"Suhu","options":[{"label":"Ice","price_delta":0},{"label":"Hot","price_delta":0}]}]'::jsonb;
begin
  -- Menu MINUMAN tanpa opsi (null / bukan array / array kosong) -> dapat default.
  --
  -- `jsonb_array_length()` melempar error kalau kolomnya bukan array, jadi
  -- json_typeof harus dicek lebih dulu. CASE dipakai (bukan OR) karena CASE
  -- dijamin Postgres evaluating cabangnya berurutan.
  update public.menu_items m
     set customization_options = v_default
    from public.categories c
   where m.category_id = c.id
     and c.is_drink
     and case
           when jsonb_typeof(m.customization_options) = 'array'
             then jsonb_array_length(m.customization_options) = 0
           else true
         end;

  -- Menu MAKANAN: kosongkan HANYA kalau isinya persis sama dengan default
  -- minum (mis. sisa seed lama). Opsi lain yang sengaja dibuat owner
  -- (mis. "Extra Shot" Rp 5.000) TIDAK disentuh.
  update public.menu_items m
     set customization_options = '[]'::jsonb
    from public.categories c
   where m.category_id = c.id
     and not c.is_drink
     and m.customization_options = v_default;
end;
$$;

-- ---------------------------------------------------------
-- 6. VERIFIKASI
-- ---------------------------------------------------------

-- 6a. Pohon kategori harus jadi dua tingkat, tanpa sub-kategori yatim.
select
  coalesce(p.name, '(tingkat atas)') as induk,
  c.name                          as kategori,
  c.is_drink,
  c.sort_order,
  (select count(*) from public.menu_items m where m.category_id = c.id) as jumlah_menu
from public.categories c
left join public.categories p on p.id = c.parent_id
order by coalesce(p.sort_order, c.sort_order), p.name nulls last, c.sort_order;

-- 6b. Tidak boleh ada kategori tingkat atas yang sudah punya menu langsung
--     (menu harus selalu di sub-kategori, bukan langsung di Minuman/Makanan).
select c.name, count(m.id) as jumlah_menu
from public.categories c
join public.menu_items m on m.category_id = c.id
where c.parent_id is null
group by c.name;
-- Hasilnya harus kosong. Kalau tidak, pindahkan menu itu ke sub-kategori.

-- 6c. Semua menu minuman harus punya 2 grup (Gula + Suhu).
--     CASE dipakai agar aman pada kolom yang bukan array.
with per_menu as (
  select
    c.is_drink,
    case
      when jsonb_typeof(m.customization_options) = 'array'
        then jsonb_array_length(m.customization_options)
      else 0
    end as jumlah_grup
  from public.menu_items m
  join public.categories c on c.id = m.category_id
)
select
  count(*) filter (where not is_drink)                        as total_makanan,
  count(*) filter (where is_drink and jumlah_grup = 2)         as minuman_lengkap,
  count(*) filter (where is_drink and jumlah_grup <> 2)        as minuman_belum_lengkap,
  count(*) filter (where not is_drink and jumlah_grup > 0)     as makanan_yg_punya_opsi
from per_menu;
-- minuman_belum_lengkap harus 0.
-- makanan_yg_punya_opsi boleh > 0 kalau memang ada opsi khusus (mis. Extra Shot).

-- ============================================================================
-- [6/17] asal: supabase/migrations/20261016-queue-number-on-confirmation.sql
-- ============================================================================

-- =========================================================
-- MIGRASI: 2026-10-16 — Nomor Antrean DISAAT KONFIRMASI
--
-- PERUBAHAN dari versi 15-10:
--   Sebelumnya order_number dibuat saat pesanan DIBUAT.
--   Sekarang  order_number (nomor antrean) dibuat saat pesanan DIKONFIRMASI
--   (pembayaran diterima), sehingga urutannya mengikuti urutan konfirmasi —
--   bukan urutan pesanan masuk.
--
-- ⚠️ Jalankan 20261015-backup-menu-customization.sql DULUAN (kalau belum).
--    Untuk membatalkan: jalankan 20261016-rollback-queue-number.sql
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Script ini idempotent, aman diulang.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Bersihkan trigger versi lama (kalau sempat dijalankan)
-- ---------------------------------------------------------
drop trigger if exists trg_orders_order_number on public.orders;
drop function if exists public.trg_orders_set_order_number();

-- ---------------------------------------------------------
-- 2. order_number boleh NULL (menunggu konfirmasi)
--    Default acak dihapus — nomornya sekarang dari trigger UPDATE.
-- ---------------------------------------------------------
alter table public.orders alter column order_number drop default;
alter table public.orders alter column order_number drop not null;

-- Backfill: pesanan lama yang SUDAH dibayar deserving punya nomor antrean.
-- Pesanan yang masih pending sengaja dibiarkan NULL (menunggu konfirmasi).
update public.orders o
set order_number = 'ORD-' || to_char(d.tanggal, 'YYYYMMDD') || '-' || lpad(d.urut::text, 2, '0')
from (
  select
    id,
    (created_at at time zone 'Asia/Jakarta')::date as tanggal,
    row_number() over (
      partition by (created_at at time zone 'Asia/Jakarta')::date
      order by created_at
    ) as urut
  from public.orders
  where payment_status = 'paid'
) d
where o.id = d.id
  and o.order_number is null;

-- ---------------------------------------------------------
-- 3. Generator nomor antrean (dipakai trigger di bawah)
-- ---------------------------------------------------------
create or replace function public.next_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_seq  int;
begin
  -- Advisory lock: 2 pesanan yang dikonfirmasi bersamaan
  -- tidak mungkin mendapat nomor yang sama.
  perform pg_advisory_xact_lock(hashtext('bd_coffee_order_number')::bigint);

  select count(*)::int + 1
    into v_seq
    from public.orders
   where (created_at at time zone 'Asia/Jakarta')::date = v_today
     and order_number is not null;

  return 'ORD-' || to_char(v_today, 'YYYYMMDD') || '-' || lpad(v_seq::text, 2, '0');
end;
$$;

-- ---------------------------------------------------------
-- 4. Trigger: nomor antrean dibuat saat pembayaran terkonfirmasi
--    Berlaku untuk QRIS (klik "Sudah Bayar") maupun Tunai (kasir konfirmasi).
-- ---------------------------------------------------------
create or replace function public.trg_orders_set_order_number()
returns trigger
language plpgsql
as $$
begin
  -- hanya saat pembayaran berubah menjadi 'paid' dan belum punya nomor
  if new.payment_status = 'paid'
     and (old.payment_status is distinct from 'paid')
     and new.order_number is null then
    new.order_number := public.next_order_number();

    -- langsung naik ke status "confirmed" supaya kasir dan
    -- halaman customer sama-sama menampilkan antrean
    if new.status = 'pending' then
      new.status := 'confirmed';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_order_number on public.orders;
create trigger trg_orders_order_number
  before update on public.orders
  for each row execute function public.trg_orders_set_order_number();

-- ---------------------------------------------------------
-- 5. Verifikasi
-- ---------------------------------------------------------

-- 5a. Hanya boleh ada 1 trigger untuk order_number
select tgname as trigger_name
from pg_trigger
where tgrelid = 'public.orders'::regclass
  and not tgisinternal
order by tgname;

-- 5b. Pesanan menunggu konfirmasi (order_number masih NULL) — wajar
select
  count(*) filter (where order_number is null) as menunggu_konfirmasi,
  count(*) filter (where order_number is not null) as sudah_ada_nomor
from public.orders;

-- 5c. Tidak boleh ada nomor antrean ganda
select order_number, count(*) as jumlah
from public.orders
where order_number is not null
group by order_number
having count(*) > 1;
-- Query ini harus mengembalikan 0 baris.

-- ============================================================================
-- [7/17] asal: supabase/migrations/20261016-rls-qris-confirm.sql
-- ============================================================================

-- =========================================================
-- MIGRASI: 2026-10-16 — Izin customer konfirmasi pembayaran QRIS
--
-- MASALAH:
--   Policy "orders_staff_update" (schema.sql) hanya mengizinkan UPDATE
--   oleh staff. Customer adalah pengguna 'anon' (belum login), jadi
--   saat ia klik tombol "Sudah Bayar" atau timer expire, PostgreSQL
--   menolak dengan error RLS.
--
-- SOLUSI:
--   Dua function SECURITY DEFINER. Function ini bypass RLS, tapi
--   TERTUTUP secara ketat: hanya boleh mengubah payment_status ->
--   'paid' (atau status -> 'cancelled'), dan hanya untuk pesanan QRIS
--   yang masih 'pending'. Field lain (total, table_number, dll)
--   tidak bisa disentuh dari sisi customer.
--
-- ⚠️ WAJIB dijalankan SETELAH 20261016-queue-number-on-confirmation.sql
--    (function ini relies on trigger penomoran antrean).
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Script ini idempotent, aman diulang.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Fungsi: konfirmasi bayar QRIS
-- ---------------------------------------------------------
create or replace function public.confirm_qris_payment(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Hanya: order QRIS, belum dibayar, belum dibatalkan.
  -- Trigger trg_orders_order_number yang menugaskan nomor antrean
  -- dan menaikkan status ke 'confirmed'.
  update public.orders
     set payment_status = 'paid'
   where id = p_order_id
     and payment_method = 'qris'
     and payment_status = 'pending'
     and status <> 'cancelled';

  return found;
end;
$$;

-- ---------------------------------------------------------
-- 2. Fungsi: batalkan pesanan yang belum dibayar
--    (dipakai timer 15 menit yang habis)
-- ---------------------------------------------------------
create or replace function public.cancel_unpaid_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Hanya order yang MASIH pending DAN belum dibayar.
  -- Kalau sudah dibayar, tidak akan ter-cancel.
  update public.orders
     set status = 'cancelled'
   where id = p_order_id
     and payment_status = 'pending'
     and status = 'pending';

  return found;
end;
$$;

-- ---------------------------------------------------------
-- 3. Batasi siapa saja yang boleh memanggil
--    (default Postgres = semua orang; kita persempit)
-- ---------------------------------------------------------
revoke all on function public.confirm_qris_payment(uuid) from public;
revoke all on function public.cancel_unpaid_order(uuid) from public;

grant execute on function public.confirm_qris_payment(uuid) to anon, authenticated;
grant execute on function public.cancel_unpaid_order(uuid)  to anon, authenticated;

-- ---------------------------------------------------------
-- 4. Verifikasi
-- ---------------------------------------------------------

-- 4a. Dua function harus ada
select proname as nama_fungsi, prosecdef as security_definer
from pg_proc
where proname in ('confirm_qris_payment', 'cancel_unpaid_order');

-- 4b. Hanya anon + authenticated yang boleh memanggil (public harus kosong)
select has_function_privilege('anon', 'confirm_qris_payment(uuid)', 'execute')          as anon_bisa,
       has_function_privilege('authenticated', 'confirm_qris_payment(uuid)', 'execute') as login_bisa,
       has_function_privilege('public', 'confirm_qris_payment(uuid)', 'execute')        as public_bisa;
-- public_bisa harus FALSE.

-- ============================================================================
-- [8/17] asal: supabase/migrations/20261016-sales-report-wib.sql
-- ============================================================================

-- =========================================================
-- MIGRASI: 2026-10-16 — Bucket laporan penjualan ikut zona waktu WIB
--
-- MASALAH:
--   get_sales_report() memakai `date_trunc(p_period, o.created_at)` pada
--   kolom bertipe timestamptz. date_trunc memotong berdasarkan TimeZone
--   sesi Postgres, dan Supabase mengaturnya ke UTC.
--
--   Akibatnya untuk BD Coffee (WIB = UTC+7):
--     - "hari ini" pada dashboard punya batas 07:00 WIB, bukan 00:00 WIB
--     - bucket per hari bergeser 7 jam ke belakang
--     - kolom "omzet hari ini" tidak cocok dengan nota yang benar-benar
--       dicetak hari itu
--
-- SOLUSI:
--   Konversi ke waktu lokal WALL CLOCK dulu, potong, baru kembalikan
--   ke timestamptz.
--
--     created_at at time zone 'Asia/Jakarta'   -> timestamp lokal (tanpa tz)
--     date_trunc(...)                          -> potong tengah malam lokal
--     ... at time zone 'Asia/Jakarta'          -> kembali jadi timestamptz
--
--   Bulannya (bucket start-of-month) sekarang kembali 00:00 WIB = 17:00 UTC
--   hari sebelumnya, dan `formatBucketLabel()` di app membulatkan balik
--   ke "16 Okt".
--
-- CATATAN:
--   Filter p_start / p_end TIDAK diubah — keduanya absolute time, jadi
--   tidak terpengaruh. Hanya pengelompokannya yang jadi WIB.
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Script ini idempotent, aman diulang.
-- =========================================================

create or replace function public.get_sales_report(
  p_period text,             -- 'hour' | 'day' | 'week' | 'month'
  p_start  timestamptz,
  p_end    timestamptz
)
returns table (
  bucket        timestamptz,
  omzet         numeric,
  cost          numeric,
  net_profit    numeric,
  total_orders  bigint
)
language sql stable security definer set search_path = public as $$
  select
    date_trunc(p_period, o.created_at at time zone 'Asia/Jakarta')
      at time zone 'Asia/Jakarta' as bucket,
    coalesce(sum(oi.subtotal), 0) as omzet,
    coalesce(sum(oi.unit_cost * oi.quantity), 0) as cost,
    coalesce(sum(oi.subtotal - (oi.unit_cost * oi.quantity)), 0) as net_profit,
    count(distinct o.id) as total_orders
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where o.status <> 'cancelled'
    and o.created_at between p_start and p_end
  group by bucket
  order by bucket;
$$;

-- Grant tidak berubah dari schema.sql, tapi diulang agar script ini
-- berdiri sendiri kalau dijalankan di database yang grant-nya hilang.
grant execute on function public.get_sales_report(text, timestamptz, timestamptz) to authenticated;
revoke execute on function public.get_sales_report(text, timestamptz, timestamptz) from anon;

-- ---------------------------------------------------------
-- VERIFIKASI
-- ---------------------------------------------------------

-- 6a. Bucket harian harus mulai pada 17:00 UTC (= 00:00 WIB hari berikutnya).
--     Kalau jam-nya 00:00, migrasi BELUM dijalankan.
select bucket, omzet, total_orders
from public.get_sales_report('day', now() - interval '7 days', now())
order by bucket;

-- 6b. Cek konversi bolak-balik: jam bucket + 7 harus genap 00:00 UTC
select bucket,
       extract(hour from bucket at time zone 'UTC') as jam_utc,
       (extract(hour from bucket at time zone 'UTC') + 7) % 24 as jam_wib
from public.get_sales_report('day', now() - interval '7 days', now())
order by bucket;
-- jam_wib semua harus 0.

-- ============================================================================
-- [9/17] asal: supabase/migrations/20261017-confirm-cash-payment.sql
-- ============================================================================

-- =========================================================
-- MIGRASI: 2026-10-17 — Konfirmasi bayar TUNAI lewat RPC
--
-- MASALAH (dari laporan owner):
--   Tombol "Konfirmasi Bayar" di dashboard kasir gagal untuk pesanan TUNAI.
--   Jalur QRIS (tombol "Sudah Bayar" di halaman customer) jalan normal.
--
-- PENYEBAB:
--   Dua jalur pembayaran memakai cara berbeda untuk mengubah payment_status:
--
--     QRIS  -> app/order/[id]/actions.ts memanggil RPC confirm_qris_payment()
--              Function itu SECURITY DEFINER, jadi BYPASS RLS.
--
--     TUNAI -> app/admin/kasir/actions.ts memakai `.from("orders").update()`
--              Update langsung WAJIB lolos policy RLS.
--
--   Setelah policy select/insert untuk anon dibersihkan di
--   20261017-lock-down-orders-rls.sql, jalur TUNAI jadi satu-satunya yang
--   bergantung penuh pada policy RLS, dan di situlah ia tersandung.
--
--   Perbaikannya bukan loosen policy RLS (itu akan membuka data pesanan lagi),
--   tapi menyamakan jalur TUNAI dengan QRIS: sama-sama lewat function
--   SECURITY DEFINER yang sempit cakupannya.
--
-- ⚠️ Jalankan SETELAH 20261016-queue-number-on-confirmation.sql
--    (function ini memicu trigger penomoran antrean, sama seperti QRIS).
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Script ini idempotent, aman diulang.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Fungsi: konfirmasi bayar TUNAI oleh kasir
-- ---------------------------------------------------------
create or replace function public.confirm_cash_payment(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role  text;
  v_found integer;
begin
  -- Hanya staff (owner atau kasir) yang boleh mengonfirmasi pembayaran.
  -- Sengaja dicek di dalam function, bukan hanya lewat grant, karena
  -- SECURITY DEFINER membuat contextberganti menjadi hak function, bukan hak caller.
  select p.role::text into v_role
  from public.profiles p
  where p.id = auth.uid();

  if v_role is null or v_role not in ('owner', 'kasir') then
    raise exception 'Hanya kasir atau owner yang boleh mengonfirmasi pembayaran.'
      using errcode = '42501';
  end if;

  -- Syarat yang BOLEH diubah, persis seperti confirm_qris_payment():
  --   - hanya pesanan TUNAI
  --   - belum dibayar
  --   - belum dibatalkan
  -- Kolom lain (total, table_number, status) tidak disentuh. Nomor antrean
  -- tetap dibuat oleh trigger trg_orders_order_number.
  update public.orders
     set payment_status = 'paid'
   where id = p_order_id
     and payment_method = 'cash'
     and payment_status = 'pending'
     and status <> 'cancelled';

  get diagnostics v_found = row_count;
  return v_found > 0;
end;
$$;

-- ---------------------------------------------------------
-- 2. Grant hanya ke yang sudah login
-- ---------------------------------------------------------
revoke all on function public.confirm_cash_payment(uuid) from public;
grant execute on function public.confirm_cash_payment(uuid) to authenticated;

-- ---------------------------------------------------------
-- 3. Verifikasi
-- ---------------------------------------------------------

-- 3a. Function harus ada
select proname as nama_fungsi, prosecdef as security_definer
from pg_proc
where proname = 'confirm_cash_payment';
-- security_definer harus true.

-- 3b. anon TIDAK boleh memanggil
select
  has_function_privilege('anon', 'confirm_cash_payment(uuid)', 'execute') as anon_bisa;
-- Harus FALSE.

-- 3c. Update langsung ke tabel orders oleh anon harus tetap GAGAL.
--     Ini yang menjaga agar jalur baru tidak membuka celah baru.
select has_table_privilege('anon', 'public.orders', 'update') as anon_bisa_update;
-- Harus FALSE.

-- ============================================================================
-- [10/17] asal: supabase/migrations/20261017-create-staff.sql
-- ============================================================================

-- =========================================================
-- MIGRASI: 2026-10-17 — Fungsi admin untuk kelola karyawan
--
-- TUJUAN:
--   Owner perlu menambah kasir dari dashboard, bukan lewat script manual.
--   Pembuatan akun HARUS lewat Supabase Auth Admin API (auth.admin.createUser)
--   supaya password di-hash bcrypt oleh Supabase, sama seperti akun owner.
--
-- MENGAPA ADA FUNGSI SQL DI SINI:
--   `auth.users` dan `auth.admin.*` hanya bisa dipanggil pakai Service Role
--   Key, yang tidak boleh ada di Next.js server component mana pun (bocor kalau
--   salah tempat). Solusinya: pindahkan logika itu ke dalam function
--   SECURITY DEFINER yang hanya boleh dipanggil role 'owner' yang sedang login.
--
--   Function ini diberi grant ke `authenticated` BUKAN ke `anon`, dan isinya
--   sendiri menolak kalau pemanggil bukan owner. Jadi meskipun siapa pun yang
--   punya sesi login, hanya owner yang bisa membuat/ubah/hapus karyawan.
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Script ini idempotent, aman diulang.
-- =========================================================

-- ---------------------------------------------------------
-- 0. Helper: pastikan pemanggil adalah owner
-- ---------------------------------------------------------
create or replace function public._bd_require_owner()
returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'Akses ditolak: hanya owner yang boleh mengelola karyawan.'
      using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 1. Daftar karyawan (untuk ditampilkan di dashboard)
-- ---------------------------------------------------------
-- CATATAN: tabel public.profiles TIDAK punya kolom updated_at (lihat
-- schema.sql) — hanya id, username, full_name, role, created_at. Jangan
-- menambahkan kolom yang tidak ada di sini.
create or replace function public.list_staff()
returns table (
  id            uuid,
  username      text,
  full_name     text,
  role          public.user_role,
  created_at    timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.full_name, p.role, p.created_at
  from public.profiles p
  order by p.role, p.username;
$$;

-- ---------------------------------------------------------
-- 2. Buat karyawan baru (role kasir)
-- ---------------------------------------------------------
-- Memakai extension `pgcrypto` untuk generate bcrypt. Password di-hash DI
-- DALAM database lalu dioper ke auth.users — string aslinya tidak pernah
-- disimpan di tabel mana pun, jadi tidak bisa dibaca owner maupun dicuri.
create or replace function public.create_staff_account(
  p_username text,
  p_password text,
  p_full_name text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_email   text;
  v_hash    text;
begin
  perform public._bd_require_owner();

  if p_username is null or btrim(p_username) = '' then
    raise exception 'Username wajib diisi.';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password minimal 6 karakter.';
  end if;

  -- Username dipakai sebagai email internal dengan suffix '@cafe.internal',
  -- sama seperti akun owner. Email tidak pernah dikirim ke mana pun.
  v_email := lower(btrim(p_username)) || '@cafe.internal';

  if exists (select 1 from public.profiles where username = btrim(p_username)) then
    raise exception 'Username % sudah dipakai.', p_username;
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Username % sudah dipakai.', p_username;
  end if;

  -- Password di-hash dengan bcrypt (cost 10, default Supabase).
  -- `crypt()` menghasilkan string $2a$/$2b$ yang persis format yang
  -- diharapkan func verify_password() bawaan Supabase Auth.
  v_hash := crypt(p_password, gen_salt('bf'));

  -- 2a) Baris di auth.users
  insert into auth.users (
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_email,
    v_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('username', btrim(p_username)),
    'authenticated',
    'authenticated'
  )
  returning id into v_user_id;

  -- 2b) Trigger Supabase Auth membuat baris di public.profiles otomatis
  --     dengan role default 'kasir', jadi tidak perlu insert manual di sini.
  --     Tapi kalau trigger-nya belum terpasang (mis. di project lama), tetap
  --     pastikan barisnya ada.
  if not exists (select 1 from public.profiles where id = v_user_id) then
    insert into public.profiles (id, username, full_name, role)
    values (
      v_user_id,
      btrim(p_username),
      nullif(btrim(coalesce(p_full_name, '')), ''),
      'kasir'
    );
  else
    update public.profiles
       set full_name = nullif(btrim(coalesce(p_full_name, '')), '')
     where id = v_user_id
       and full_name is null;
  end if;

  -- 2c) Catat jejak pendaftaran supaya owner bisa melihat siapa yang masuk.
  --     Source 'owner' karena dipanggil dari dashboard Karyawan.
  --     Fungsi log-nya dibuat di 20261017-lock-down-orders-rls.sql.
  perform public._bd_log_registration(
    v_user_id,
    btrim(p_username),
    nullif(btrim(coalesce(p_full_name, '')), ''),
    'owner'
  );

  return v_user_id;
end;
$$;

-- ---------------------------------------------------------
-- 2b. Pendaftaran mandiri oleh calon kasir (dari halaman /daftar)
-- ---------------------------------------------------------
-- Bedanya dengan create_staff_account():
--   - TIDAK butuh owner. Halaman /daftar memang terbuka untuk siapa saja yang
--     punya link-nya, sesuai permintaan owner ("kasir bisa daftar sendiri").
--   - Role SELALU 'kasir' dan di-hardcode di dalam function ini. Daftar
--     parameternya sengaja tidak menyertakan role sama sekali, jadi tidak ada
--     jalan untuk mendaftarkan diri sebagai owner.
--
-- Konsekuensi yang harus disadari owner: siapa pun yang tahu URL /daftar
-- bisa membuat akun kasir. Kalau nanti ini tidak diinginkan, cabut grant
-- `anon` di bawah (baris revoke) — halaman akan langsung gagal.
create or replace function public.register_staff_account(
  p_username text,
  p_password text,
  p_full_name text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_email   text;
  v_hash    text;
  v_clean   text;
begin
  v_clean := lower(btrim(coalesce(p_username, '')));

  if length(v_clean) < 3 then
    raise exception 'Username minimal 3 karakter.';
  end if;
  if length(v_clean) > 30 then
    raise exception 'Username maksimal 30 karakter.';
  end if;
  if v_clean !~ '^[a-z0-9._-]+$' then
    raise exception 'Username hanya boleh huruf kecil, angka, titik, _ dan -.';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password minimal 6 karakter.';
  end if;
  if btrim(coalesce(p_full_name, '')) = '' then
    raise exception 'Nama lengkap wajib diisi.';
  end if;

  v_email := v_clean || '@cafe.internal';

  if exists (select 1 from public.profiles where username = v_clean) then
    raise exception 'Username % sudah dipakai. Coba yang lain.', v_clean;
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Username % sudah dipakai. Coba yang lain.', v_clean;
  end if;

  v_hash := crypt(p_password, gen_salt('bf'));

  insert into auth.users (
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_email,
    v_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('username', v_clean),
    'authenticated',
    'authenticated'
  )
  returning id into v_user_id;

  -- Role di-hardcode 'kasir' di sini. Kalau trigger auth sudah membuat
  -- baris profile dengan default 'kasir', baris itu dipakai; kalau belum,
  -- kita insert sendiri.
  if exists (select 1 from public.profiles where id = v_user_id) then
    update public.profiles
       set full_name = btrim(p_full_name)
     where id = v_user_id;
  else
    insert into public.profiles (id, username, full_name, role)
    values (v_user_id, v_clean, btrim(p_full_name), 'kasir');
  end if;

  -- Catat jejak pendaftaran. Source 'self_register' karena berasal dari
  -- halaman /daftar yang terbuka untuk umum — ini yang perlu diawasi owner.
  perform public._bd_log_registration(
    v_user_id,
    v_clean,
    btrim(p_full_name),
    'self_register'
  );

  return v_user_id;
end;
$$;

-- ---------------------------------------------------------
-- 3. Reset password karyawan
-- ---------------------------------------------------------
-- Owner TIDAK bisa membaca password lama (Supabase menyimpannya sebagai hash
-- bcrypt satu arah). Jadi kalau karyawan lupa, satu-satunya jalan adalah
-- membuat password baru. Password baru dikembalikan ke caller untuk
-- ditampilkan satu kali di layar.
create or replace function public.reset_staff_password(
  p_staff_id uuid,
  p_new_password text
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._bd_require_owner();

  if p_new_password is null or length(p_new_password) < 6 then
    raise exception 'Password minimal 6 karakter.';
  end if;

  if not exists (select 1 from public.profiles where id = p_staff_id) then
    raise exception 'Karyawan tidak ditemukan.';
  end if;

  update auth.users
     set encrypted_password = crypt(p_new_password, gen_salt('bf')),
         updated_at = now()
   where id = p_staff_id;

  if not found then
    raise exception 'Karyawan tidak ditemukan di sistem login.';
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 4. Ubah nama lengkap
-- ---------------------------------------------------------
create or replace function public.update_staff_profile(
  p_staff_id uuid,
  p_full_name text
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._bd_require_owner();

  if not exists (select 1 from public.profiles where id = p_staff_id) then
    raise exception 'Karyawan tidak ditemukan.';
  end if;

  update public.profiles
     set full_name = nullif(btrim(coalesce(p_full_name, '')), '')
   where id = p_staff_id;
end;
$$;

-- ---------------------------------------------------------
-- 5. Hapus karyawan
-- ---------------------------------------------------------
-- Akun owner sendiri TIDAK BOLEH dihapus, supaya tidak ada keadaan di mana
-- tidak ada orang yang bisa masuk ke dashboard.
create or replace function public.delete_staff_account(p_staff_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role;
begin
  perform public._bd_require_owner();

  select role into v_role from public.profiles where id = p_staff_id;

  if v_role is null then
    raise exception 'Karyawan tidak ditemukan.';
  end if;

  if v_role = 'owner' then
    raise exception 'Akun owner tidak bisa dihapus dari sini.';
  end if;

  -- Hapus dari auth.users lebih dulu; baris public.profiles ikut terhapus
  -- karena FK-nya `on delete cascade`.
  delete from auth.users where id = p_staff_id;

  if not found then
    raise exception 'Karyawan tidak ditemukan di sistem login.';
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 6. Grant: hanya authenticated, BUKAN anon
-- ---------------------------------------------------------
revoke all on function public.list_staff() from public;
revoke all on function public.create_staff_account(text, text, text) from public;
revoke all on function public.register_staff_account(text, text, text) from public;
revoke all on function public.reset_staff_password(uuid, text) from public;
revoke all on function public.update_staff_profile(uuid, text) from public;
revoke all on function public.delete_staff_account(uuid) from public;
revoke all on function public._bd_require_owner() from public;

-- Function yang hanya untuk owner.
grant execute on function public.list_staff() to authenticated;
grant execute on function public.create_staff_account(text, text, text) to authenticated;
grant execute on function public.reset_staff_password(uuid, text) to authenticated;
grant execute on function public.update_staff_profile(uuid, text) to authenticated;
grant execute on function public.delete_staff_account(uuid) to authenticated;

-- Pendaftaran mandiri BUTUH anon, karena orang yang daftar belum punya sesi
-- login. Function ini hanya bisa membuat akun role 'kasir' — tidak ada
-- parameternya untuk menentukan role.
--
-- ⚠️ Tarik grant ini kalau pendaftaran mandiri tidak diinginkan:
--     revoke execute on function public.register_staff_account(text,text,text) from anon;
--   Halaman /daftar akan langsung gagal setelah dicabut.
grant execute on function public.register_staff_account(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------
-- 7. VERIFIKASI
-- ---------------------------------------------------------

-- 7a. Enam function harus ada
select proname
from pg_proc
where proname in (
  'list_staff', 'create_staff_account', 'register_staff_account',
  'reset_staff_password', 'update_staff_profile', 'delete_staff_account'
);

-- 7b. anon TIDAK boleh menyentuh function milik owner (harus semua false).
--     Satu-satunya pengecualian: register_staff_account — memang dibuka untuk
--     anon karena dipakai halaman /daftar, dan isinya hanya bisa membuat akun
--     role 'kasir'.
select
  has_function_privilege('anon', 'create_staff_account(text,text,text)', 'execute') as anon_buat_akun,
  has_function_privilege('anon', 'delete_staff_account(uuid)', 'execute')         as anon_hapus_akun,
  has_function_privilege('anon', 'reset_staff_password(uuid,text)', 'execute')   as anon_reset,
  has_function_privilege('anon', 'list_staff()', 'execute')                      as anon_lihat,
  has_function_privilege('anon', 'register_staff_account(text,text,text)', 'execute') as anon_daftar;
-- Empat kolom pertama harus false. anon_daftar boleh true.

-- 7c. Daftar karyawan sekarang
select username, full_name, role, created_at from public.list_staff();

-- ============================================================================
-- [11/17] asal: supabase/migrations/20261017-drink-sugar-options.sql
-- ============================================================================

-- Ubah opsi kustomisasi menu MINUMAN jadi 3 pilihan gula.
--
--Owner minta label Bahasa Inggris dan menambah satu tingkat di tengah:
--   Non Sugar / Less Sugar / Sugar
--   Ice / Hot
--
-- Menu MAKANAN tidak disentuh: kategori `is_drink = false` tetap `[]`.
--
-- ⚠️ Jalankan SETELAH 20261016-category-groups.sql (butuh kolom categories.is_drink).

begin;

-- Simpan dulu nilai lama supaya bisa dikembalikan oleh file rollback.
create table if not exists backup_menu_options_20261017 as
select id, customization_options from menu_items;

update menu_items m
set customization_options = jsonb_build_array(
      jsonb_build_object(
        'name', 'Gula',
        'options', jsonb_build_array(
          jsonb_build_object('label', 'Non Sugar',  'price_delta', 0),
          jsonb_build_object('label', 'Less Sugar', 'price_delta', 0),
          jsonb_build_object('label', 'Sugar',      'price_delta', 0)
        )
      ),
      jsonb_build_object(
        'name', 'Suhu',
        'options', jsonb_build_array(
          jsonb_build_object('label', 'Ice', 'price_delta', 0),
          jsonb_build_object('label', 'Hot', 'price_delta', 0)
        )
      )
    )
where exists (
  select 1
  from categories c
  join menu_items mi on mi.category_id = c.id
  where mi.id = m.id
    and c.is_drink = true
);

commit;

-- Cek hasil: menu minuman harus punya 2 grup, makanan harus 0 grup.
select
  c.name                                    as kategori,
  c.is_drink,
  jsonb_array_length(m.customization_options) as jumlah_grup
from menu_items m
join categories c on c.id = m.category_id
order by c.is_drink desc, c.name, m.name;

-- ============================================================================
-- [12/17] asal: supabase/migrations/20261017-fix-order-number-collision.sql
-- ============================================================================

-- =========================================================
-- MIGRASI: 2026-10-17 — Perbaiki penomoran antrean yang bentrok
--
-- GEJALA (dari log server kasir):
--   [kasir] confirm_cash_payment gagal:
--   23505 duplicate key value violates unique constraint "orders_order_number_key"
--   Key (order_number)=(ORD-20261017-02) already exists
--
--   Artinya trigger penomoran antrean menghasilkan nomor yang sudah terpakai,
--   jadi konfirmasi pembayaran TUNAI selalu gagal.
--
-- AKAR MASALAH:
--   next_order_number() lama menghitung nomor berikutnya dengan:
--
--     select count(*)::int + 1
--       from public.orders
--      where (created_at at time zone 'Asia/Jakarta')::date = v_today
--        and order_number is not null;
--
--   Tiga hal salah dengan cara itu:
--
--   1) Trigger-nya BEFORE UPDATE. Saat trigger berjalan, order yang sedang
--      diproses BELUM terlihat di hasil count. Kalau ada dua pembayaran yang
--      diproses dalam satu transaksi yang sama, keduanya menghitung jumlah
--      yang sama dan menghasilkan nomor yang sama.
--
--   2) Order yang DIBATALKAN setelah mendapat nomor tetap ikut terhitung
--      (kolom order_number tidak dikosongkan). Jadi nomor meloncat, dan
--      nomor berikutnya bisa menabrak nomor lama yang sudah tidak dipakai.
--
--   3) Kalau ada nomor yang terhapus atau baris yang hilang, count+1 tidak
--      tahu ada "lubang" di urutan.
--
-- SOLUSI:
--   Cari nomor terkecil yang BELUM terpakai, bukan jumlah baris + 1.
--   Postgres punya generate_series untuk membuat daftar kandidat tanpa
--   harus looping di PL/pgSQL:
--
--     select v_prefix || lpad(n::text, 2, '0')
--       into v_result
--       from generate_series(1, 9999) n
--      where not exists (
--              select 1 from public.orders o
--               where o.order_number = v_prefix || lpad(n::text, 2, '0')
--            )
--      order by n
--      limit 1;
--
--   Keuntungannya:
--     - Tidak pernah bentrok: kandidat yang dipilih dijamin belum ada di
--       tabel, karena `not exists` hanya TRUE kalau memang tidak ada.
--     - Kalau nomor ada yang "bolong" (order dibatalkan lalu nomor dihapus),
--       nomor yang kosong itu dipakai kembali — tidak ada nomor melompat.
--     - Tidak bergantung pada hitungan baris sama sekali.
--
--   Advisory lock tetap dipertahankan supaya dua pembayaran yang jalan
--   bersamaan tidak memilih nomor yang sama sebelum salah satunya
--   ter-commit.
--
-- ⚠️ WAJIB dijalankan SETELAH 20261016-queue-number-on-confirmation.sql
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Script ini idempotent, aman diulang.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Fungsi generator nomor antrean (versi baru)
-- ---------------------------------------------------------
create or replace function public.next_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today   date := (now() at time zone 'Asia/Jakarta')::date;
  v_prefix  text := 'ORD-' || to_char(v_today, 'YYYYMMDD') || '-';
  v_result  text;
begin
  -- Advisory lock: mencegah dua pembayaran yang jalan bersamaan memilih
  -- nomor yang sama sebelum salah satunya selesai.
  perform pg_advisory_xact_lock(hashtext('bd_coffee_order_number')::bigint);

  -- Nomor terkecil yang belum dipakai hari ini.
  -- `not exists` dijamin mengembalikan TRUE hanya kalau kandidat itu benar-
  -- benar belum ada di tabel, jadi hasilnya tidak mungkin bentrok dengan
  -- unique constraint.
  select v_prefix || lpad(n::text, 2, '0')
    into v_result
    from generate_series(1, 9999) n
   where not exists (
           select 1
             from public.orders o
            where o.order_number = v_prefix || lpad(n::text, 2, '0')
         )
   order by n
   limit 1;

  if v_result is null then
    raise exception 'Nomor antrean untuk % sudah habis (9999 pesanan).', v_today;
  end if;

  return v_result;
end;
$$;

-- ---------------------------------------------------------
-- 2. Bersihkan nomor bentrok yang mungkin sudah terlanjur ada
-- ---------------------------------------------------------
-- Kalau pernah ada order tanpa nomor padahal sudah dibayar (mis. versi
-- trigger yang lama gagal di tengah jalan), lengkapi dulu supaya tidak ada
-- data yang menggantung.
update public.orders o
   set order_number = public.next_order_number()
 where o.order_number is null
   and o.payment_status = 'paid';

-- ---------------------------------------------------------
-- 3. Verifikasi
-- ---------------------------------------------------------

-- 3a. Function harus ada
select proname, prosecdef
from pg_proc
where proname = 'next_order_number';

-- 3b. Nomor berikutnya yang akan dipakai — harus yang terkecil yang kosong.
select public.next_order_number() as nomor_berikutnya;
-- Ulangi sekali lagi: harus BERBEDA dari yang di atas, karena pemanggilan
-- pertama tidak menulis apa pun ke tabel.

-- 3c. Tidak boleh ada nomor duplikat.
select order_number, count(*) as jumlah
from public.orders
where order_number is not null
group by order_number
having count(*) > 1;
-- Hasilnya harus kosong.

-- 3d. Pesanan lunas tanpa nomor antrean = data menggantung, harus 0.
select count(*) as lunas_tanpa_nomor
from public.orders
where payment_status = 'paid'
  and order_number is null;

-- ============================================================================
-- [13/17] asal: supabase/migrations/20261017-lock-down-orders-rls.sql
-- ============================================================================

-- =========================================================
-- MIGRASI: 2026-10-17 — Kunci RLS pesanan + audit log pendaftaran
--
-- MASALAH 1 (KEAMANAN — INI YANG SERIUS):
--   Policy `orders_public_select_by_id` di schema.sql BERAPA dengan
--   `using (true)`. Padahal namanya promising "select by id".
--
--   Arti `using (true)`: SEMUA baris lolos untuk SIAPA SAJA, termasuk
--   pengunjung anon yang belum login sama sekali. Akibatnya siapa pun yang
--   punya anon key (yang memang publik di dalam bundle browser) bisa:
--     select id, customer_name, table_number, total, notes from orders
--   dan mendapat SELURUH riwayat pesanan — nama pelanggan, meja, total,
--   sampai catatan. `order_items_public_select` memakai `using (true)` juga.
--
--   Komentar di schema.sql sudah niat: "aman karena id berupa UUID acak".
--   Itu benar UNTUK halaman /order/[orderId] — tapi policy-nya tidak membatasi
--   ke satu baris saja, jadi seluruh tabel ikut terbuka.
--
-- SOLUSI:
--   Halaman customer (/order/[id] dan /order/[id]/pay) tidak lagi memakai
--   `.from("orders").select()` langsung. Sekarang lewat RPC
--   `get_order_by_id(p_order_id)` — SECURITY DEFINER, menerima UUID, dan
--   hanya mengembalikan SATU baris itu kalau id-nya benar-benar ada.
--   UUID acak 122-bit tidak bisa ditebak, jadi ini setara amannya dengan
--   "punya link" — persis model yang kamu mau, tapi tanpa bocor daftar.
--
--   Policy select untuk anon DIHAPUS. Yang tersisa hanya policy staff.
--   Customer halaman remeh tetap jalan lewat RPC.
--
--   ⚠️ PENTING soal Realtime: policy RLS juga berlaku untuk Realtime.
--     Dashboard kasir memakai postgres_changes — kasir adalah staff, jadi
--     policy staff tetap berlaku dan realtime TIDAK terganggu.
--     Halaman customer TIDAK lagi memakai realtime untuk update status.
--
-- MASALAH 2 (AUDIT):
--   Halaman /daftar membuat akun kasir tanpa jejak siapa yang mendaftar.
--   Ditambah tabel `staff_registration_log` berisi waktu pendaftaran, supaya
--   owner bisa melihat daftar baru dan kapan.
--
-- CATATAN SOAL IP — sengaja TIDAK disimpan:
--   `inet_client_addr()` dari dalam Postgres mengembalikan alamat internal
--   Supabase (10.x.x.x), BUKAN IP pengunjung — nilainya sama untuk semua orang
--   dan tidak berguna. IP asli harus diteruskan dari server action sebagai
--   parameter; menambahkannya berarti mengubah signature function yang sudah
--   kamu jalankan. Untuk sekarang yang dicatat adalah WAKTU, karena itu sudah
--   menjawab "ada yang daftar di luar jam kerja?".
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Script ini idempotent, aman diulang.
-- =========================================================

-- ---------------------------------------------------------
-- 0. BACKUP policy lama (bukti, supaya bisa dibandingkan)
-- ---------------------------------------------------------
create table if not exists public._bak_rls_policies_20261017 (
  policy_name text primary key,
  definition text not null,
  saved_at    timestamptz not null default now()
);

insert into public._bak_rls_policies_20261017 (policy_name, definition)
select policyname, coalesce(qual, '') || ' | ' || coalesce(with_check, '')
from pg_policies
where schemaname = 'public'
  and tablename in ('orders', 'order_items')
on conflict (policy_name) do update
  set definition = excluded.definition,
      saved_at   = now();

-- ---------------------------------------------------------
-- 1. HAPUS policy select untuk anon
-- ---------------------------------------------------------
drop policy if exists "orders_public_select_by_id" on public.orders;
drop policy if exists "order_items_public_select" on public.order_items;

-- Policy select untuk staff (dashboard kasir). INSERT tetap terbuka untuk anon
-- karena customer membuat pesanan tanpa login.
drop policy if exists "orders_staff_select" on public.orders;
create policy "orders_staff_select"
  on public.orders for select
  using (public.is_staff());

drop policy if exists "order_items_staff_select" on public.order_items;
create policy "order_items_staff_select"
  on public.order_items for select
  using (public.is_staff());

-- ---------------------------------------------------------
-- 2. RPC untuk halaman customer
-- ---------------------------------------------------------
-- Hanya mengembalikan satu pesanan, dan hanya kalau UUID-nya benar-benar ada.
--Grpc ini yang menggantikan select langsung di halaman /order/[id] dan /pay.
create or replace function public.get_order_by_id(p_order_id uuid)
returns table (
  id                uuid,
  order_number      text,
  customer_name     text,
  order_type        public.order_type,
  table_number      text,
  notes             text,
  payment_method    public.payment_method,
  payment_status    public.payment_status,
  status            public.order_status,
  subtotal          numeric,
  total             numeric,
  created_at        timestamptz,
  updated_at        timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select o.id, o.order_number, o.customer_name, o.order_type, o.table_number,
           o.notes, o.payment_method, o.payment_status, o.status,
           o.subtotal, o.total, o.created_at, o.updated_at
    from public.orders o
    where o.id = p_order_id;
end;
$$;

-- Detail item untuk satu pesanan (dipakai halaman ringkasan pesanan).
create or replace function public.get_order_items(p_order_id uuid)
returns table (
  id                      uuid,
  menu_item_id            uuid,
  menu_name               text,
  quantity                int,
  selected_customizations jsonb,
  subtotal                numeric,
  created_at              timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select oi.id, oi.menu_item_id, oi.menu_name, oi.quantity,
           oi.selected_customizations, oi.subtotal, oi.created_at
    from public.order_items oi
    where oi.order_id = p_order_id
    order by oi.created_at;
end;
$$;

-- Cek status saja untuk timer 15 menit (dipakai getPaymentState()).
create or replace function public.get_order_payment_state(p_order_id uuid)
returns table (
  status         public.order_status,
  payment_status public.payment_status,
  created_at     timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select o.status, o.payment_status, o.created_at
    from public.orders o
    where o.id = p_order_id;
end;
$$;

-- ---------------------------------------------------------
-- 3. AUDIT LOG PENDAFTARAN
-- ---------------------------------------------------------
create table if not exists public.staff_registration_log (
  id          uuid primary key default gen_random_uuid(),
  -- id user yang dibuat (bisa null kalau nanti gagal dihapus)
  staff_id    uuid,
  username    text not null,
  full_name   text,
  -- 'self_register' = daftar sendiri dari /daftar
  -- 'owner'       = dibuat owner dari dashboard Karyawan
  source      text not null default 'self_register',
  created_at  timestamptz not null default now()
);

comment on table public.staff_registration_log is
  'Jejak pendaftaran karyawan. Dipakai owner untuk melihat siapa saja yang masuk.';

create index if not exists idx_staff_reg_log_created
  on public.staff_registration_log (created_at desc);

-- Hanya owner yang boleh BACA log. Tidak ada policy insert/update/delete:
-- penulisan selalu dari dalam function, tidak pernah dari client.
alter table public.staff_registration_log enable row level security;

drop policy if exists "staff_registration_log_owner_read" on public.staff_registration_log;
create policy "staff_registration_log_owner_read"
  on public.staff_registration_log for select
  using (public.is_owner());

-- Fungsi yang mencatat pendaftaran. Dipanggil dari dalam
-- register_staff_account() dan create_staff_account().
create or replace function public._bd_log_registration(
  p_staff_id  uuid,
  p_username  text,
  p_full_name text,
  p_source    text
)
returns void
language sql security definer set search_path = public as $$
  insert into public.staff_registration_log (staff_id, username, full_name, source)
  values (p_staff_id, p_username, p_full_name, p_source);
$$;

revoke all on function public._bd_log_registration(uuid, text, text, text) from public;

-- ---------------------------------------------------------
-- 4. RPC untuk owner membaca & menutup catatan
-- ---------------------------------------------------------
create or replace function public.list_recent_registrations(p_days int default 7)
returns table (
  id          uuid,
  username    text,
  full_name   text,
  source      text,
  created_at  timestamptz,
  still_active boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'Akses ditolak: hanya owner yang bisa melihat log pendaftaran.'
      using errcode = '42501';
  end if;

  return query
    select
      l.id,
      l.username,
      l.full_name,
      l.source,
      l.created_at,
      -- Masih bisa login? aka profile-nya masih ada di tabel profiles.
      exists (select 1 from public.profiles p where p.username = l.username)
    from public.staff_registration_log l
    where l.created_at >= now() - make_interval(days => greatest(p_days, 1))
    order by l.created_at desc
    limit 100;
end;
$$;

-- Tandai "sudah saya lihat" supaya banner tidak muncul terus.
-- Disimpan per-akun di tabel kecil, bukan localStorage, supaya tetap
-- tersimpan walau owner ganti perangkat.
create table if not exists public.staff_registration_reads (
  staff_id    uuid primary key references public.profiles (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.staff_registration_reads enable row level security;

drop policy if exists "staff_registration_reads_owner_all" on public.staff_registration_reads;
create policy "staff_registration_reads_owner_all"
  on public.staff_registration_reads for all
  using (public.is_owner())
  with check (public.is_owner());

create or replace function public.mark_registrations_seen(p_staff_id uuid)
returns void
language sql security definer set search_path = public as $$
  insert into public.staff_registration_reads (staff_id, last_seen_at)
  values (p_staff_id, now())
  on conflict (staff_id) do update
    set last_seen_at = now();
$$;

revoke all on function public.mark_registrations_seen(uuid) from public;
grant execute on function public.mark_registrations_seen(uuid) to authenticated;

-- ---------------------------------------------------------
-- 5. Grant RPC
-- ---------------------------------------------------------
revoke all on function public.get_order_by_id(uuid) from public;
revoke all on function public.get_order_items(uuid) from public;
revoke all on function public.get_order_payment_state(uuid) from public;
revoke all on function public.list_recent_registrations(int) from public;

-- Tiga function order: dipakai halaman customer yang BELUM login.
grant execute on function public.get_order_by_id(uuid)         to anon, authenticated;
grant execute on function public.get_order_items(uuid)         to anon, authenticated;
grant execute on function public.get_order_payment_state(uuid) to anon, authenticated;

-- Dua function log: hanya owner, dan keduanya cek is_owner() di dalamnya.
grant execute on function public.list_recent_registrations(int) to authenticated;

-- ---------------------------------------------------------
-- 6. VERIFIKASI
-- ---------------------------------------------------------

-- 6a. Policy select untuk anon harus SUDAH HILANG.
--     Kalau baris ini masih muncul, drop policy gagal.
select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('orders', 'order_items')
order by tablename, policyname;
-- Tidak boleh ada policy dengan cmd='SELECT' dan roles={anon}.
-- Yang boleh: orders_staff_select & order_items_staff_select (staff).

-- 6b. Cek cepat dari sisi anon.
select has_table_privilege('anon', 'public.orders', 'select') as anon_bisa_select_orders;
-- Harus FALSE.

-- 6c. Function baru harus ada.
select proname
from pg_proc
where proname in (
  'get_order_by_id', 'get_order_items', 'get_order_payment_state',
  'list_recent_registrations', 'mark_registrations_seen'
);

-- 6d. Ambil UUID satu pesanan untuk tes manual (tempel ke langkah 6e).
select id from public.orders order by created_at desc limit 1;

-- 6e. TES: RPC pesanan harus jalan, tapi daftar tidak boleh bocor.
--     Ganti <uuid-dari-6d> dengan UUID di atas.
--
--   select * from public.get_order_by_id('<uuid-dari-6d>');   -- harus 1 baris
--   select count(*) from public.get_order_by_id(gen_random_uuid()); -- harus 0
--
--  Lalu tes sebagai ANON lewat PostgREST / dashboard anon:
--   select count(*) from orders;
--   -> harus ERROR "permission denied for table orders"

-- ============================================================================
-- [14/17] asal: supabase/migrations/20261019-pgcrypto-search-path.sql
-- ============================================================================

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

-- ============================================================================
-- [15/17] asal: supabase/migrations/20261019-fix-staff-insert-id.sql
-- ============================================================================

-- =========================================================
-- MIGRASI: 2026-10-19 - auth.users tidak bisa di-insert tanpa kolom id
--
-- GEJALA:
--   Daftar karyawan baru di /daftar dan di dashboard Karyawan gagal
--   dengan: null value in column "id" of relation "users" violates
--   not-null constraint.
--
-- AKAR MASALAH:
--   create_staff_account() dan register_staff_account() sama-sama
--   meng-INSERT ke auth.users tanpa menyebut kolom id. GoTrue membuat
--   UUID di sisi aplikasi saat login, jadi kolom itu TIDAK punya DEFAULT
--   di database. Hasilnya: setiap INSERT gagal.
--
--   Catatan: pesan error Postgres menyebut "relation users" tanpa nama
--   schema, jadi yang bermasalah adalah auth.users, bukan tabel public.
--
-- PERBAIKAN:
--   Kedua fungsi dibuat ulang dengan kolom id diisi gen_random_uuid().
--
--   gen_random_uuid() aman: sejak Postgres 13 fungsi itu BUILT-IN di
--   pg_catalog, bukan extension. Tetap ketemu berapa pun search_path
--   fungsi.
--
-- search_path SENGAJA dibiarkan public, extensions (hasil perbaikan
-- 20261019-pgcrypto-search-path.sql). Kalau ikut dibalik ke public,
--   gen_salt() tidak ketemu dan daftar karyawan gagal lagi, tapi dengan
--   error yang lebih awal.
--
-- Badannya fungsi TIDAK diubah selain baris id. Disalin apa adanya dari
-- 20261017-create-staff.sql supaya tidak ada selisih lain yang tidak
-- sengaja.
--
-- Data: tidak ada yang perlu dibersih. Tidak satu pun INSERT pernah
-- berhasil sebelum migrasi ini, semuanya gagal di kolom id.
-- =========================================================
-- =========================================================


create or replace function public.create_staff_account(
  p_username text,
  p_password text,
  p_full_name text default null
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user_id uuid;
  v_email   text;
  v_hash    text;
begin
  perform public._bd_require_owner();

  if p_username is null or btrim(p_username) = '' then
    raise exception 'Username wajib diisi.';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password minimal 6 karakter.';
  end if;

  -- Username dipakai sebagai email internal dengan suffix '@cafe.internal',
  -- sama seperti akun owner. Email tidak pernah dikirim ke mana pun.
  v_email := lower(btrim(p_username)) || '@cafe.internal';

  if exists (select 1 from public.profiles where username = btrim(p_username)) then
    raise exception 'Username % sudah dipakai.', p_username;
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Username % sudah dipakai.', p_username;
  end if;

  -- Password di-hash dengan bcrypt (cost 10, default Supabase).
  -- `crypt()` menghasilkan string $2a$/$2b$ yang persis format yang
  -- diharapkan func verify_password() bawaan Supabase Auth.
  v_hash := crypt(p_password, gen_salt('bf'));

  -- 2a) Baris di auth.users
  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role
  )
  values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    v_email,
    v_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('username', btrim(p_username)),
    'authenticated',
    'authenticated'
  )
  returning id into v_user_id;

  -- 2b) Trigger Supabase Auth membuat baris di public.profiles otomatis
  --     dengan role default 'kasir', jadi tidak perlu insert manual di sini.
  --     Tapi kalau trigger-nya belum terpasang (mis. di project lama), tetap
  --     pastikan barisnya ada.
  if not exists (select 1 from public.profiles where id = v_user_id) then
    insert into public.profiles (id, username, full_name, role)
    values (
      v_user_id,
      btrim(p_username),
      nullif(btrim(coalesce(p_full_name, '')), ''),
      'kasir'
    );
  else
    update public.profiles
       set full_name = nullif(btrim(coalesce(p_full_name, '')), '')
     where id = v_user_id
       and full_name is null;
  end if;

  -- Jaring pengaman role.
  --
  -- Fungsi ini tidak pernah menerima role dari pemanggil, jadi satu-satunya
  -- cara baris di atas berakhir punya role selain kasir adalah trigger di
  -- auth.users yang membuat baris profile dengan nilai yang salah. Repo ini
  -- tidak punya trigger seperti itu, tapi database bisa saja berbeda dari
  -- yang tertulis di sini, dan kalau begitu cabang update di atas hanya
  -- menyentuh full_name, bukan role.
  --
  -- v_user_id adalah uuid yang baru dibuat di fungsi ini, jadi aman untuk
  -- dipaksa tanpa syarat.
  update public.profiles
     set role = 'kasir'
   where id = v_user_id;

  -- 2c) Catat jejak pendaftaran supaya owner bisa melihat siapa yang masuk.
  --     Source 'owner' karena dipanggil dari dashboard Karyawan.
  --     Fungsi log-nya dibuat di 20261017-lock-down-orders-rls.sql.
  perform public._bd_log_registration(
    v_user_id,
    btrim(p_username),
    nullif(btrim(coalesce(p_full_name, '')), ''),
    'owner'
  );

  return v_user_id;
end;
$$;

create or replace function public.register_staff_account(
  p_username text,
  p_password text,
  p_full_name text
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user_id uuid;
  v_email   text;
  v_hash    text;
  v_clean   text;
begin
  v_clean := lower(btrim(coalesce(p_username, '')));

  if length(v_clean) < 3 then
    raise exception 'Username minimal 3 karakter.';
  end if;
  if length(v_clean) > 30 then
    raise exception 'Username maksimal 30 karakter.';
  end if;
  if v_clean !~ '^[a-z0-9._-]+$' then
    raise exception 'Username hanya boleh huruf kecil, angka, titik, _ dan -.';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password minimal 6 karakter.';
  end if;
  if btrim(coalesce(p_full_name, '')) = '' then
    raise exception 'Nama lengkap wajib diisi.';
  end if;

  v_email := v_clean || '@cafe.internal';

  if exists (select 1 from public.profiles where username = v_clean) then
    raise exception 'Username % sudah dipakai. Coba yang lain.', v_clean;
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Username % sudah dipakai. Coba yang lain.', v_clean;
  end if;

  v_hash := crypt(p_password, gen_salt('bf'));

  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role
  )
  values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    v_email,
    v_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('username', v_clean),
    'authenticated',
    'authenticated'
  )
  returning id into v_user_id;

  -- Role di-hardcode 'kasir' di sini. Kalau trigger auth sudah membuat
  -- baris profile dengan default 'kasir', baris itu dipakai; kalau belum,
  -- kita insert sendiri.
  if exists (select 1 from public.profiles where id = v_user_id) then
    update public.profiles
       set full_name = btrim(p_full_name)
     where id = v_user_id;
  else
    insert into public.profiles (id, username, full_name, role)
    values (v_user_id, v_clean, btrim(p_full_name), 'kasir');
  end if;

  -- Jaring pengaman role.
  --
  -- Fungsi ini tidak pernah menerima role dari pemanggil, jadi satu-satunya
  -- cara baris di atas berakhir punya role selain kasir adalah trigger di
  -- auth.users yang membuat baris profile dengan nilai yang salah. Repo ini
  -- tidak punya trigger seperti itu, tapi database bisa saja berbeda dari
  -- yang tertulis di sini, dan kalau begitu cabang update di atas hanya
  -- menyentuh full_name, bukan role.
  --
  -- v_user_id adalah uuid yang baru dibuat di fungsi ini, jadi aman untuk
  -- dipaksa tanpa syarat.
  update public.profiles
     set role = 'kasir'
   where id = v_user_id;

  -- Catat jejak pendaftaran. Source 'self_register' karena berasal dari
  -- halaman /daftar yang terbuka untuk umum — ini yang perlu diawasi owner.
  perform public._bd_log_registration(
    v_user_id,
    v_clean,
    btrim(p_full_name),
    'self_register'
  );

  return v_user_id;
end;
$$;

-- ============================================================================
-- [16/17] asal: supabase/migrations/20261019-fix-staff-auth-identities.sql
-- ============================================================================

-- =========================================================
-- MIGRASI: 2026-10-19 - Karyawan tidak bisa login: tanpa auth.identities
--
-- GEJALA:
--   Karyawan hasil daftar (boykeren, boytampan) selalu gagal login
--   dengan "Username atau password salah", padahal passwordnya benar.
--
-- BUKTI (hasil cek-identitas-karyawan.sql):
--   boy123@cafe.internal  owner  jumlah_identity = 1   bisa login
--   boytampan@cafe.internal kasir jumlah_identity = 0   tidak bisa
--   boykeren@cafe.internal  kasir jumlah_identity = 0   tidak bisa
--
-- AKAR MASALAH:
--   Akun owner dibuat lewat Supabase Admin API
--   (scripts/seed-owner.ts memakai auth.admin.createUser), dan API itu
--   membuat baris auth.identities secara otomatis.
--
--   Dua akun kasir dibuat lewat INSERT mentah ke auth.users. GoTrue
--   tidak pernah melihat proses itu, jadi tidak ada baris
--   auth.identities. GoTrue modern memakai tabel itu saat memverifikasi
--   login, sehingga password yang benar tetap ditolak.
--
-- PERBAIKAN:
--   1. Mengisi auth.identities untuk akun kasir yang sudah terlanjur
--      dibuat dan belum punya identitas.
--   2. Membuat kedua fungsi pendaftaran ikut menyisipkan baris
--      identitas, supaya karyawan berikutnya langsung bisa login.
--
-- NILAI BUKTI BUKAN KARANGAN:
--   Bentuk baris disalin dari identitas milik akun owner, satu-satunya
--   akun yang login-nya sudah terbukti jalan di database ini:
--     provider       'email'
--     provider_id    user_id sebagai teks
--     identity_data  sub, email, email_verified false, phone_verified
--                    false
--     email          DIHITUNG OTOMATIS dari identity_data, jadi tidak
--                    boleh diisi manual. Memisinya sendiri menghasilkan:
--                    ERROR 428C9 cannot insert a non-DEFAULT value into
--                    column "email"
--   created_at, updated_at, dan last_sign_in_at diisi now(), sama
--   seperti baris owner. id memakai gen_random_uuid(), sesuai default
--   kolomnya di database ini.
--
-- TIDAK ADA perubahan pada password, role, atau profil. Satu-satunya
-- kolom yang disentuh di luar auth.identities adalah tidak ada.
-- =========================================================


-- ---------------------------------------------------------
-- 1. Perbaiki akun yang sudah terlanjur dibuat
-- ---------------------------------------------------------
-- Dua akun (boykeren, boytampan) sudah ada di auth.users tapi tidak
-- punya baris auth.identities, jadi tidak bisa login sama sekali.
--
-- Idempoten: hanya mengisi akun yang identitasnya memang belum ada.
-- Akun owner yang identitasnya sudah benar TIDAK tersentuh.
insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  u.id::text,
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', false,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
from auth.users u
where u.email like '%@cafe.internal'
  and not exists (
    select 1 from auth.identities i where i.user_id = u.id
  );


-- ---------------------------------------------------------
-- 2. Buat pendaftaran berikutnya langsung menyertakan identitas
-- ---------------------------------------------------------
-- Tanpa bagian ini, setiap karyawan baru harus menjalankan migrasi
-- ini secara manual. Bagian 1 hanya menutup akun yang sudah ada.
--
create or replace function public.create_staff_account(
  p_username text,
  p_password text,
  p_full_name text default null
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user_id uuid;
  v_email   text;
  v_hash    text;
begin
  perform public._bd_require_owner();

  if p_username is null or btrim(p_username) = '' then
    raise exception 'Username wajib diisi.';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password minimal 6 karakter.';
  end if;

  -- Username dipakai sebagai email internal dengan suffix '@cafe.internal',
  -- sama seperti akun owner. Email tidak pernah dikirim ke mana pun.
  v_email := lower(btrim(p_username)) || '@cafe.internal';

  if exists (select 1 from public.profiles where username = btrim(p_username)) then
    raise exception 'Username % sudah dipakai.', p_username;
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Username % sudah dipakai.', p_username;
  end if;

  -- Password di-hash dengan bcrypt (cost 10, default Supabase).
  -- `crypt()` menghasilkan string $2a$/$2b$ yang persis format yang
  -- diharapkan func verify_password() bawaan Supabase Auth.
  v_hash := crypt(p_password, gen_salt('bf'));

  -- 2a) Baris di auth.users
  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role
  )
  values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    v_email,
    v_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('username', btrim(p_username)),
    'authenticated',
    'authenticated'
  )
  returning id into v_user_id;

  -- Baris di auth.identities.
  --
  -- GoTrue MEMBUTUKH baris ini untuk memverifikasi login. Menebaknya
  -- dari auth.users saja tidak cukup: akun yang dibuat lewat INSERT
  -- mentah tidak pernah dibuatkan baris ini, dan akibatnya password yang
  -- benar pun ditolak dengan pesan 'Invalid login credentials'.
  --
  -- Nilai di bawah disalin apa adanya dari baris identitas milik akun
  -- owner, satu-satunya akun yang login-nya sudah terbukti jalan:
  -- provider 'email', provider_id berisi user_id sebagai teks,
  -- identity_data berisi sub, email, email_verified false, dan
  -- phone_verified false. Tidak ada satu pun nilai yang dikarang.
  insert into auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    v_user_id::text,
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', false,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  );

  -- 2b) Trigger Supabase Auth membuat baris di public.profiles otomatis
  --     dengan role default 'kasir', jadi tidak perlu insert manual di sini.
  --     Tapi kalau trigger-nya belum terpasang (mis. di project lama), tetap
  --     pastikan barisnya ada.
  if not exists (select 1 from public.profiles where id = v_user_id) then
    insert into public.profiles (id, username, full_name, role)
    values (
      v_user_id,
      btrim(p_username),
      nullif(btrim(coalesce(p_full_name, '')), ''),
      'kasir'
    );
  else
    update public.profiles
       set full_name = nullif(btrim(coalesce(p_full_name, '')), '')
     where id = v_user_id
       and full_name is null;
  end if;

  -- Jaring pengaman role.
  --
  -- Fungsi ini tidak pernah menerima role dari pemanggil, jadi satu-satunya
  -- cara baris di atas berakhir punya role selain kasir adalah trigger di
  -- auth.users yang membuat baris profile dengan nilai yang salah. Repo ini
  -- tidak punya trigger seperti itu, tapi database bisa saja berbeda dari
  -- yang tertulis di sini, dan kalau begitu cabang update di atas hanya
  -- menyentuh full_name, bukan role.
  --
  -- v_user_id adalah uuid yang baru dibuat di fungsi ini, jadi aman untuk
  -- dipaksa tanpa syarat.
  update public.profiles
     set role = 'kasir'
   where id = v_user_id;

  -- 2c) Catat jejak pendaftaran supaya owner bisa melihat siapa yang masuk.
  --     Source 'owner' karena dipanggil dari dashboard Karyawan.
  --     Fungsi log-nya dibuat di 20261017-lock-down-orders-rls.sql.
  perform public._bd_log_registration(
    v_user_id,
    btrim(p_username),
    nullif(btrim(coalesce(p_full_name, '')), ''),
    'owner'
  );

  return v_user_id;
end;
$$;

create or replace function public.register_staff_account(
  p_username text,
  p_password text,
  p_full_name text
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user_id uuid;
  v_email   text;
  v_hash    text;
  v_clean   text;
begin
  v_clean := lower(btrim(coalesce(p_username, '')));

  if length(v_clean) < 3 then
    raise exception 'Username minimal 3 karakter.';
  end if;
  if length(v_clean) > 30 then
    raise exception 'Username maksimal 30 karakter.';
  end if;
  if v_clean !~ '^[a-z0-9._-]+$' then
    raise exception 'Username hanya boleh huruf kecil, angka, titik, _ dan -.';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password minimal 6 karakter.';
  end if;
  if btrim(coalesce(p_full_name, '')) = '' then
    raise exception 'Nama lengkap wajib diisi.';
  end if;

  v_email := v_clean || '@cafe.internal';

  if exists (select 1 from public.profiles where username = v_clean) then
    raise exception 'Username % sudah dipakai. Coba yang lain.', v_clean;
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Username % sudah dipakai. Coba yang lain.', v_clean;
  end if;

  v_hash := crypt(p_password, gen_salt('bf'));

  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role
  )
  values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    v_email,
    v_hash,
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('username', v_clean),
    'authenticated',
    'authenticated'
  )
  returning id into v_user_id;

  -- Baris di auth.identities.
  --
  -- GoTrue MEMBUTUKH baris ini untuk memverifikasi login. Menebaknya
  -- dari auth.users saja tidak cukup: akun yang dibuat lewat INSERT
  -- mentah tidak pernah dibuatkan baris ini, dan akibatnya password yang
  -- benar pun ditolak dengan pesan 'Invalid login credentials'.
  --
  -- Nilai di bawah disalin apa adanya dari baris identitas milik akun
  -- owner, satu-satunya akun yang login-nya sudah terbukti jalan:
  -- provider 'email', provider_id berisi user_id sebagai teks,
  -- identity_data berisi sub, email, email_verified false, dan
  -- phone_verified false. Tidak ada satu pun nilai yang dikarang.
  insert into auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    v_user_id::text,
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', false,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  );

  -- Role di-hardcode 'kasir' di sini. Kalau trigger auth sudah membuat
  -- baris profile dengan default 'kasir', baris itu dipakai; kalau belum,
  -- kita insert sendiri.
  if exists (select 1 from public.profiles where id = v_user_id) then
    update public.profiles
       set full_name = btrim(p_full_name)
     where id = v_user_id;
  else
    insert into public.profiles (id, username, full_name, role)
    values (v_user_id, v_clean, btrim(p_full_name), 'kasir');
  end if;

  -- Jaring pengaman role.
  --
  -- Fungsi ini tidak pernah menerima role dari pemanggil, jadi satu-satunya
  -- cara baris di atas berakhir punya role selain kasir adalah trigger di
  -- auth.users yang membuat baris profile dengan nilai yang salah. Repo ini
  -- tidak punya trigger seperti itu, tapi database bisa saja berbeda dari
  -- yang tertulis di sini, dan kalau begitu cabang update di atas hanya
  -- menyentuh full_name, bukan role.
  --
  -- v_user_id adalah uuid yang baru dibuat di fungsi ini, jadi aman untuk
  -- dipaksa tanpa syarat.
  update public.profiles
     set role = 'kasir'
   where id = v_user_id;

  -- Catat jejak pendaftaran. Source 'self_register' karena berasal dari
  -- halaman /daftar yang terbuka untuk umum — ini yang perlu diawasi owner.
  perform public._bd_log_registration(
    v_user_id,
    v_clean,
    btrim(p_full_name),
    'self_register'
  );

  return v_user_id;
end;
$$;

-- ============================================================================
-- [17/17] asal: supabase/migrations/20261019-fix-null-token-columns.sql
-- ============================================================================

-- =========================================================
-- MIGRASI: 2026-10-19 - GoTrue tidak bisa membaca baris kasir: kolom token NULL
--
-- GEJALA:
--   Login SEMUA akun kasir gagal: 500 "Database error querying schema",
--   bahkan sebelum password benar-benar dihitung. Akun owner selalu sehat.
--
-- BUKTI ASLI (log Auth Supabase, dicari lewat error_id):
--   error finding user: sql: Scan error on column index 3,
--   name "confirmation token": converting NULL to string is unsupported
--
--   Ditempel tabel proyek → Kode GoTrue menerima error ini bukan saat
--   INSERT, tapi saat MENYCAN baris: GoTrue membaca kolom token itu sebagai
--   "string pasti terisi" (bukan NULL-able). Scan gagal -> generic 500.
--
-- PERBANDINGAN BARIS (cek-500-deep.sql):
--   Baris owner dibuat lewat Supabase Admin API - semua kolom token terisi
--   string kosong ''. Baris kasir dibuat lewat INSERT manual (fungsi
--   pendaftaran) yang TIDAK menyebut kolom-kolom ini - hasilnya NULL.
--
--     kolom                  owner   kasir(salah)
--     confirmation_token     ''      NULL  <-- kolom index 3 di pesan scan
--     email_change           ''      NULL
--     recovery_token         ''      NULL
--     email_change_token_new ''      NULL
--     created_at / updated_at  ada   NULL (timestamp juga harus ada)
--
--   Kolom yang memang sah NULL tidak disentuh: phone, banned_until,
--   last_sign_in_at (belum pernah login), semua *_sent_at, phone_confirmed_at,
--   is_super_admin. Begitulah bentuk baris milik user yang baru dibuat
--   Supabase sendiri.
--
-- PERBAIKAN:
--   1. Mengisi kolom yang bermasalah pada baris yang sudah terlanjur dibuat,
--      hanya bila kolomnya memang masih NULL (idempoten; baris owner yang
--      sudah berisi '' tidak tersentuh).
--   2. Kedua fungsi pendaftaran ditulis ulang supaya INSERT sejak awal
--      mengisi kolom-kolom ini, jadi karyawan berikutnya langsung sah.
--
-- YANG TIDAK BERUBAH: password (hash tidak disentuh), role, profil,
-- auth.identities.
-- =========================================================

-- ---------------------------------------------------------
-- 1) BACKFILL baris yang sudah ada
-- ---------------------------------------------------------

-- Kolom teks yang GoTrue baca sebagai string mantap.
update auth.users
   set confirmation_token = '',
       recovery_token = '',
       email_change = '',
       email_change_token_new = ''
 where confirmation_token is null
    or recovery_token is null
    or email_change is null
    or email_change_token_new is null;

-- created_at / updated_at: diarsir di sini dari confirmed_at (siap dipakai,
-- semua baris kasir punya confirmed_at dari pendaftarannya). Baris owner
-- tidak tersentuh karena tidak memenuhi syarat (created_at sudah ada).
update auth.users
   set created_at = confirmed_at,
       updated_at = confirmed_at
 where created_at is null
   and confirmed_at is not null;

-- ---------------------------------------------------------
-- 2) Fungsi pendaftaran versi lengkap
--
--    Disalin dari 20261019-fix-staff-auth-identities.sql (yang sudah
--    menyertakan baris auth.identities), lalu kolom INSERT auth.users
--    ditambah: created_at, updated_at, email_change, recovery_token,
--    confirmation_token, email_change_token_new.
--    id tetap gen_random_uuid() (perbaikan 20261019-fix-staff-insert-id).
-- ---------------------------------------------------------

create or replace function public.create_staff_account(
  p_username text,
  p_password text,
  p_full_name text default null
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user_id uuid;
  v_email   text;
  v_hash    text;
begin
  perform public._bd_require_owner();

  if p_username is null or btrim(p_username) = '' then
    raise exception 'Username wajib diisi.';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password minimal 6 karakter.';
  end if;

  -- Username dipakai sebagai email internal dengan suffix '@cafe.internal',
  -- sama seperti akun owner. Email tidak pernah dikirim ke mana pun.
  v_email := lower(btrim(p_username)) || '@cafe.internal';

  if exists (select 1 from public.profiles where username = btrim(p_username)) then
    raise exception 'Username % sudah dipakai.', p_username;
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Username % sudah dipakai.', p_username;
  end if;

  -- Password di-hash dengan bcrypt (cost 10).
  v_hash := crypt(p_password, gen_salt('bf'));

  -- 2a) Baris di auth.users - kolom tokennya WAJIB disebut dengan ''.
  --     Tanpa itu, GoTrue gagal scan (NULL string) dan login 500.
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmed_at,
    last_sign_in_at,
    created_at,
    updated_at,
    email_change,
    email_change_token_new,
    recovery_token,
    confirmation_token,
    raw_app_meta_data,
    raw_user_meta_data
  )
  values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    v_hash,
    now(),
    now(),
    null,
    now(),
    now(),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('username', btrim(p_username))
  )
  returning id into v_user_id;

  -- Baris di auth.identities (wajib: GoTrue memverifikasi login lewat sini).
  insert into auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    v_user_id::text,
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', false,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  );

  -- 2b) public.profiles: trigger membuat baris dengan role default 'kasir';
  --     kalau belum ada, buat sendiri.
  if not exists (select 1 from public.profiles where id = v_user_id) then
    insert into public.profiles (id, username, full_name, role)
    values (
      v_user_id,
      btrim(p_username),
      nullif(btrim(coalesce(p_full_name, '')), ''),
      'kasir'
    );
  else
    update public.profiles
       set full_name = nullif(btrim(coalesce(p_full_name, '')), '')
     where id = v_user_id
       and full_name is null;
  end if;

  -- Jaring penganalisis role: pastikan barisnya kasir walau trigger berbeda.
  update public.profiles set role = 'kasir' where id = v_user_id;

  -- 2c) Catat jejak pendaftaran (source 'owner').
  perform public._bd_log_registration(
    v_user_id,
    btrim(p_username),
    nullif(btrim(coalesce(p_full_name, '')), ''),
    'owner'
  );

  return v_user_id;
end;
$$;

create or replace function public.register_staff_account(
  p_username text,
  p_password text,
  p_full_name text
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user_id uuid;
  v_email   text;
  v_hash    text;
  v_clean   text;
begin
  v_clean := lower(btrim(coalesce(p_username, '')));

  if length(v_clean) < 3 then
    raise exception 'Username minimal 3 karakter.';
  end if;
  if length(v_clean) > 30 then
    raise exception 'Username maksimal 30 karakter.';
  end if;
  if v_clean !~ '^[a-z0-9._-]+$' then
    raise exception 'Username hanya boleh huruf kecil, angka, titik, _ dan -.';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password minimal 6 karakter.';
  end if;
  if btrim(coalesce(p_full_name, '')) = '' then
    raise exception 'Nama lengkap wajib diisi.';
  end if;

  v_email := v_clean || '@cafe.internal';

  if exists (select 1 from public.profiles where username = v_clean) then
    raise exception 'Username % sudah dipakai. Coba yang lain.', v_clean;
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Username % sudah dipakai. Coba yang lain.', v_clean;
  end if;

  v_hash := crypt(p_password, gen_salt('bf'));

  -- INSERT lengkap - alasan yang sama dengan create_staff_account di atas.
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmed_at,
    last_sign_in_at,
    created_at,
    updated_at,
    email_change,
    email_change_token_new,
    recovery_token,
    confirmation_token,
    raw_app_meta_data,
    raw_user_meta_data
  )
  values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    v_hash,
    now(),
    now(),
    null,
    now(),
    now(),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('username', v_clean)
  )
  returning id into v_user_id;

  -- Baris di auth.identities (wajib).
  insert into auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    v_user_id::text,
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', false,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  );

  -- Role di-hardcode 'kasir'.
  if exists (select 1 from public.profiles where id = v_user_id) then
    update public.profiles
       set full_name = btrim(p_full_name)
     where id = v_user_id;
  else
    insert into public.profiles (id, username, full_name, role)
    values (v_user_id, v_clean, btrim(p_full_name), 'kasir');
  end if;

  update public.profiles set role = 'kasir' where id = v_user_id;

  -- Jejak pendaftaran (source 'self_register').
  perform public._bd_log_registration(
    v_user_id,
    v_clean,
    btrim(p_full_name),
    'self_register'
  );

  return v_user_id;
end;
$$;

-- ---------------------------------------------------------
-- 3) VERIFIKASI - semuanya harus 0
-- ---------------------------------------------------------
select
  count(*) filter (where confirmation_token is null)         as konfirmasi_null,
  count(*) filter (where recovery_token is null)             as recovery_null,
  count(*) filter (where email_change is null)               as email_change_null,
  count(*) filter (where email_change_token_new is null)     as token_baru_null,
  count(*) filter (where created_at is null)                 as created_null,
  count(*) filter (where updated_at is null)                 as updated_null
from auth.users
where email like '%@cafe.internal';
