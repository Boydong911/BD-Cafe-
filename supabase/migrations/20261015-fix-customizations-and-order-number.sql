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
