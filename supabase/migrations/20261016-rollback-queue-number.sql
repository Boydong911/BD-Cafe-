-- =========================================================
-- MIGRASI ROLLBACK — Nomor antrean kembali ke versi 15-10
--
-- File   : supabase/migrations/20261016-rollback-queue-number.sql
-- Efek   : order_number kembali diisi SAAT pesanan dibuat (acak 4 digit),
--          bukan saat konfirmasi.
-- Catatan: nomor antrean yang SUDAH TERBUAT tidak dihapus — data riwayat
--          pesanan lama tetap utuh.
-- =========================================================

-- 1. Hapus trigger konfirmasi + generator
drop trigger if exists trg_orders_order_number on public.orders;
drop function if exists public.trg_orders_set_order_number();
drop function if exists public.next_order_number();

-- 2. Kembalikan default acak seperti semula
alter table public.orders alter column order_number
  set default ('ORD-' || to_char(now(), 'YYYYMMDD') || '-' ||
               lpad(floor(random() * 10000)::text, 4, '0'));

-- 3. Pesanan yang belum punya nomor (menunggu konfirmasi) diisi acak,
--    sisanya dibiarkan apa adanya.
update public.orders
set order_number = 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' ||
                  lpad(floor(random() * 10000)::text, 4, '0')
where order_number is null;

-- 4. Kembalikan constraint NOT NULL
alter table public.orders alter column order_number set not null;

-- 5. Verifikasi: tidak boleh ada nomor NULL / kembar
select count(*) filter (where order_number is null) as masih_kosong
from public.orders;

select order_number, count(*) as jumlah
from public.orders
group by order_number
having count(*) > 1;
-- Query di atas harus mengembalikan 0 baris.
