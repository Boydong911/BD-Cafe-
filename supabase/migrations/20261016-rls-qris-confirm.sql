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
