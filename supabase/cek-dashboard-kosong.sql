-- =========================================================
-- CEK DIAGNOSIS — JALANKAN INI DI SUPABASE SQL EDITOR
--
-- Pertanyaan: kenapa kartu omzet / profit di dashboard owner kosong?
--
-- Kemungkinan besar: memang BELUM ADA pesanan di database. Semua yang
-- pernah dibuat selama ini adalah menu, kategori, dan meja — belum ada
-- satu pun order yangselesai pembayaran. Tanpa order, get_sales_report()
-- mengembalikan nol baris, dan dashboard menampilkan Rp 0.
--
-- Jalankan query di bawah untuk memastikannya.
-- =========================================================

-- 1) Berapa pesanan yang sudah ada?
select
  count(*)                                            as total_pesanan,
  count(*) filter (where status <> 'cancelled')       as tidak_dibatalkan,
  count(*) filter (where payment_status = 'paid')     as sudah_bayar,
  min(created_at)                                     as pesanan_terlama,
  max(created_at)                                     as pesanan_terbaru
from public.orders;

-- Kalau total_pesanan = 0, itu jawabannya: belum ada pesanan sama sekali.
-- Buat satu pesanan dulu lewat halaman kasir / alur checkout, lalu
-- refresh dashboard owner.

-- 2) Kalau ADA pesanan, cek kenapa tidak muncul di laporan.
--    Ini memanggil function yang sama dengan yang dipakai dashboard.
select *
from public.get_sales_report('day', now() - interval '90 days', now())
order by bucket;

-- Kalau hasil di sini kosong padahal poin 1 berisi data, kemungkinan besar
-- SEMUA order berstatus 'cancelled' (function-nya memfilter
-- `status <> 'cancelled'`).

-- 3) Cek top menu — biasanya sinkron dengan poin 2.
select *
from public.get_top_menu(now() - interval '90 days', now(), 5);

-- 4) Verifikasi migrasi WIB benar-benar sudah jalan.
--    Kalau bucket-nya jam 00:00 UTC, berarti migrasi BELUM dijalankan
--    dan "hari ini" masih bergeser 7 jam.
select
  bucket,
  extract(hour from bucket at time zone 'UTC') as jam_utc
from public.get_sales_report('day', now() - interval '7 days', now())
order by bucket;
-- jam_utc harus 17 (atau 16/15 untuk zona yang berbeda), BUKAN 0.
-- Kalau 0, jalankan 20261016-sales-report-wib.sql.
