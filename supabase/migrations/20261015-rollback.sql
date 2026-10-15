-- =========================================================
-- MIGRASI ROLLBACK — MEMBATALKAN SEMUA YANG DIUBAH
--
-- File   : supabase/migrations/20261015-rollback.sql
-- Kapan  : kalau hasil 20261015-fix-customizations-and-order-number.sql
--          tidak sesuai harapan.
-- Syarat : file 20261015-backup-menu-customization.sql SUDAH dijalankan.
--
-- Efek: database kembali persis seperti sebelum migrasi.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Kembalikan nilai customization_options dari backup
-- ---------------------------------------------------------
update public.menu_items mi
set customization_options = b.customization_options
from public._bak_menu_customization_20261015 b
where b.id = mi.id
  and mi.customization_options is distinct from b.customization_options;

-- 2. Hapus trigger + function nomor pesanan
drop trigger if exists trg_orders_order_number on public.orders;
drop function if exists public.trg_orders_set_order_number();
drop function if exists public.next_order_number();

-- 3. Kembalikan default lama order_number persis seperti semula
--    (nilai diambil dari tabel backup, bukan diketik ulang manual)
do $$
declare
  v_default text;
begin
  select note_value into v_default
    from public._bak_schema_notes_20261015
   where note_key = 'orders.order_number.default';

  if v_default is null or v_default = '::text' then
    -- belum pernah ada default (mis. sudah pernah di-drop sebelumnya)
    raise notice 'Tidak ada default lama tersimpan, order_number dibiarkan tanpa default.';
  else
    execute format(
      'alter table public.orders alter column order_number set default %s',
      v_default
    );
    raise notice 'Default order_number berhasil dipulihkan: %', v_default;
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 4. Verifikasi: semua menu_items harus kembali ke nilai awal
-- ---------------------------------------------------------
select
  mi.name,
  mi.customization_options as nilai_sekarang,
  b.customization_options  as nilai_awal,
  (mi.customization_options is not distinct from b.customization_options) as sudah_sama
from public.menu_items mi
join public._bak_menu_customization_20261015 b on b.id = mi.id
where mi.customization_options is distinct from b.customization_options;

-- Kalau query di atas mengembalikan 0 baris -> rollback BERHASIL.

-- ---------------------------------------------------------
-- 5. (Opsional) Hapus tabel backup kalau sudah tidak diperlukan
-- ---------------------------------------------------------
-- drop table if exists public._bak_menu_customization_20261015;
-- drop table if exists public._bak_schema_notes_20261015;
