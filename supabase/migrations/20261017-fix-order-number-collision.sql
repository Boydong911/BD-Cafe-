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
