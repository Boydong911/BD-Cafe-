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
