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
