-- =========================================================
-- ROLLBACK: 2026-10-17 — Perbaiki penomoran antrean yang bentrok
--
-- ⚠️ Mengembalikan fungsi next_order_number() ke versi LAMA yang memakai
--    `count(*) + 1`. Versi itulah yang menyebabkan error:
--      duplicate key value violates unique constraint "orders_order_number_key"
--
--    Kalau rollback ini dijalankan, konfirmasi pembayaran bisa kembali gagal
--    dengan nomor antrean yang bentrok. Jalankan hanya kalau versi baru
--    membuat masalah lain.
--
-- CARA PAKAI: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- =========================================================

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
-- VERIFIKASI: fungsi sudah kembali ke versi lama
-- ---------------------------------------------------------
select pg_get_functiondef('public.next_order_number()'::regprocedure);
-- Harus memuat "count(*)::int + 1".
